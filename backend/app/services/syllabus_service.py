"""
Syllabus Service — AI-generated skill tree for subjects.
Uses Gemini to decompose subjects into units → topics → concepts.
Caches results in SyllabusCache table.
"""

import os
import json
from typing import Optional, Dict, Any

from ..utils.llm_utils import call_gemini_with_timeout

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from ..db_models import SyllabusCache, SubjectResource

try:
    import google.generativeai as genai

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    SYLLABUS_MODEL = genai.GenerativeModel("gemini-2.0-flash")
else:
    SYLLABUS_MODEL = None


# ---------------------------------------------------------------------------
# Hardcoded fallbacks for common subjects
# ---------------------------------------------------------------------------

FALLBACK_TREES: Dict[str, Dict[str, Any]] = {
    "Physics": {
        "subject": "Physics",
        "units": [
            {
                "id": "mechanics",
                "name": "Mechanics",
                "order": 1,
                "icon": "⚙️",
                "topics": [
                    {"id": "newtons_laws", "name": "Newton's Laws", "order": 1, "concepts": ["inertia", "F=ma", "action-reaction"], "prerequisites": [], "estimated_minutes": 5},
                    {"id": "projectile_motion", "name": "Projectile Motion", "order": 2, "concepts": ["trajectory", "range", "velocity components"], "prerequisites": ["newtons_laws"], "estimated_minutes": 7},
                    {"id": "work_energy", "name": "Work & Energy", "order": 3, "concepts": ["kinetic energy", "potential energy", "conservation of energy"], "prerequisites": ["newtons_laws"], "estimated_minutes": 6},
                ],
            },
            {
                "id": "thermodynamics",
                "name": "Thermodynamics",
                "order": 2,
                "icon": "🌡️",
                "topics": [
                    {"id": "temperature_heat", "name": "Temperature & Heat", "order": 1, "concepts": ["thermal equilibrium", "specific heat", "heat transfer"], "prerequisites": [], "estimated_minutes": 6},
                    {"id": "laws_of_thermo", "name": "Laws of Thermodynamics", "order": 2, "concepts": ["first law", "second law", "entropy"], "prerequisites": ["temperature_heat"], "estimated_minutes": 8},
                ],
            },
            {
                "id": "electromagnetism",
                "name": "Electromagnetism",
                "order": 3,
                "icon": "🔌",
                "topics": [
                    {"id": "electric_charge", "name": "Electric Charge & Force", "order": 1, "concepts": ["Coulomb's law", "electric field", "charge conservation"], "prerequisites": [], "estimated_minutes": 6},
                    {"id": "circuits", "name": "Circuits", "order": 2, "concepts": ["Ohm's law", "series circuits", "parallel circuits"], "prerequisites": ["electric_charge"], "estimated_minutes": 7},
                    {"id": "magnetism", "name": "Magnetism", "order": 3, "concepts": ["magnetic fields", "electromagnetic induction", "Faraday's law"], "prerequisites": ["circuits"], "estimated_minutes": 8},
                ],
            },
            {
                "id": "waves",
                "name": "Waves & Optics",
                "order": 4,
                "icon": "🌊",
                "topics": [
                    {"id": "wave_properties", "name": "Wave Properties", "order": 1, "concepts": ["wavelength", "frequency", "amplitude"], "prerequisites": [], "estimated_minutes": 5},
                    {"id": "sound", "name": "Sound Waves", "order": 2, "concepts": ["resonance", "Doppler effect", "intensity"], "prerequisites": ["wave_properties"], "estimated_minutes": 6},
                    {"id": "light_optics", "name": "Light & Optics", "order": 3, "concepts": ["reflection", "refraction", "lenses"], "prerequisites": ["wave_properties"], "estimated_minutes": 7},
                ],
            },
        ],
    },
}


class SyllabusService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_document_context(self, subject: str, student_id: Optional[str] = None) -> Optional[str]:
        """Load uploaded resource summaries for prompt injection."""
        query = select(SubjectResource).where(
            SubjectResource.subject == subject
        )
        if student_id:
            query = query.where(
                (SubjectResource.student_id == student_id) | (SubjectResource.student_id.is_(None))
            )
        result = await self.db.execute(query)
        resources = result.scalars().all()
        if not resources:
            return None
        parts = [f"From {r.file_name}: {r.key_content}" for r in resources]
        return "\n\n".join(parts)[:3000]

    async def get_or_generate(
        self, subject: str, student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Return cached syllabus or generate a new one."""
        # Check cache first
        cached = await self._get_cached(subject, student_id)
        if cached:
            return cached

        # Load document context from uploaded resources
        doc_context = await self._get_document_context(subject, student_id)

        # Generate
        tree = await self.generate_syllabus(subject, document_context=doc_context)

        # Use AI-cleaned subject name from the generated tree (not raw input)
        clean_subject = tree.get("subject", subject)
        if len(clean_subject) > 80:
            # AI didn't clean it — extract first meaningful line
            clean_subject = clean_subject.split("\n")[0].split("\t")[0].strip()[:80]

        # Update tree to use clean subject
        tree["subject"] = clean_subject

        # Cache it with the clean name
        cache_entry = SyllabusCache(
            subject=clean_subject,
            student_id=student_id,
            tree_json=tree,
        )
        self.db.add(cache_entry)
        await self.db.commit()

        return tree

    async def _get_cached(
        self, subject: str, student_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Look up cached syllabus. Tries exact match, then student-agnostic."""
        # Try exact match with student_id first (case-insensitive)
        if student_id:
            query = (
                select(SyllabusCache)
                .where(func.lower(SyllabusCache.subject) == subject.lower(), SyllabusCache.student_id == student_id)
                .order_by(SyllabusCache.created_at.desc())
                .limit(1)
            )
            result = await self.db.execute(query)
            entry = result.scalars().first()
            if entry:
                return entry.tree_json

        # Fall back to any matching subject (global or other student, case-insensitive)
        query = (
            select(SyllabusCache)
            .where(func.lower(SyllabusCache.subject) == subject.lower())
            .order_by(SyllabusCache.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        entry = result.scalars().first()
        if entry:
            return entry.tree_json
        return None

    async def generate_syllabus(self, subject: str, document_context: Optional[str] = None) -> Dict[str, Any]:
        """Generate a skill tree via Gemini, with fallback."""
        if SYLLABUS_MODEL:
            try:
                return await self._generate_with_llm(subject, document_context=document_context)
            except Exception:
                pass

        # Fallback: check hardcoded trees
        normalized = subject.strip().title()
        for key, tree in FALLBACK_TREES.items():
            if key.lower() == normalized.lower():
                return tree

        # Generic fallback for unknown subjects
        return self._generic_fallback(subject)

    async def _generate_with_llm(self, subject: str, document_context: Optional[str] = None) -> Dict[str, Any]:
        """Call Gemini to decompose subject into skill tree."""
        doc_block = ""
        if document_context:
            doc_block = f"""
STUDENT'S COURSE MATERIALS (align the tree with this content):
{document_context[:2000]}

"""
        prompt = f"""Decompose this academic subject into a learning skill tree.

SUBJECT: {subject}
{doc_block}
Return a JSON skill tree with this structure:
{{
  "subject": "{subject}",
  "units": [
    {{
      "id": "mechanics",
      "name": "Mechanics",
      "order": 1,
      "icon": "⚙️",
      "topics": [
        {{
          "id": "newtons_laws",
          "name": "Newton's Laws",
          "order": 1,
          "concepts": ["inertia", "F=ma", "action-reaction"],
          "prerequisites": [],
          "estimated_minutes": 5
        }},
        {{
          "id": "projectile_motion",
          "name": "Projectile Motion",
          "order": 2,
          "concepts": ["trajectory", "range", "components"],
          "prerequisites": ["newtons_laws"],
          "estimated_minutes": 7
        }}
      ]
    }}
  ]
}}

Rules:
- 4-6 units per subject
- 3-5 topics per unit
- Each topic has 2-5 specific concepts
- Prerequisites reference topic IDs within the same subject
- Order topics so prerequisites come first
- Use a relevant emoji for each unit icon
- Use snake_case for all IDs"""

        response = await call_gemini_with_timeout(
            SYLLABUS_MODEL, prompt,
            generation_config={"response_mime_type": "application/json"},
            context={"agent": "syllabus_service", "operation": "generate_syllabus"},
        )
        if response is None:
            raise RuntimeError("Gemini call returned None")
        tree = json.loads(response.text)

        # Validate structure
        if "subject" not in tree or "units" not in tree:
            raise ValueError("Invalid tree structure from LLM")

        return tree

    def _generic_fallback(self, subject: str) -> Dict[str, Any]:
        """Generate a minimal placeholder tree for any subject."""
        return {
            "subject": subject,
            "units": [
                {
                    "id": "fundamentals",
                    "name": "Fundamentals",
                    "order": 1,
                    "icon": "📚",
                    "topics": [
                        {
                            "id": "introduction",
                            "name": f"Introduction to {subject}",
                            "order": 1,
                            "concepts": ["key terms", "core principles", "history"],
                            "prerequisites": [],
                            "estimated_minutes": 5,
                        },
                        {
                            "id": "core_concepts",
                            "name": "Core Concepts",
                            "order": 2,
                            "concepts": ["main ideas", "frameworks", "applications"],
                            "prerequisites": ["introduction"],
                            "estimated_minutes": 7,
                        },
                    ],
                },
                {
                    "id": "applications",
                    "name": "Applications",
                    "order": 2,
                    "icon": "🔬",
                    "topics": [
                        {
                            "id": "practical_skills",
                            "name": "Practical Skills",
                            "order": 1,
                            "concepts": ["problem solving", "analysis", "critical thinking"],
                            "prerequisites": ["core_concepts"],
                            "estimated_minutes": 8,
                        },
                    ],
                },
            ],
        }
