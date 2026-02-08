"""
Learning Orchestrator — The Conductor
Multi-agent pipeline: Retrieve → Plan → Quiz → Assess → Refine → (Teach/Discuss/Quiz)

Coordinates existing agents in a Retrieve → Plan → Render → Refine loop inspired
by Paper Banana's agentic architecture. Each agent has a single job; the
conductor decides which agent runs next.
"""

import os
import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout

from ..db_models import (
    LearningSession,
    ConceptMastery,
    StudentMisconception,
)
from ..services.adaptive_learning_service import AdaptiveLearningService
from ..ai_agents.question_generator import QuestionBankGenerator
from ..ai_agents.misconception_tagger import MisconceptionTagger
from ..ai_agents.exit_ticket_agent import ExitTicketAgent

try:
    import google.generativeai as genai

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    PLANNER_MODEL = genai.GenerativeModel("gemini-2.0-flash")
else:
    PLANNER_MODEL = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Session State (stored as JSON in LearningSession.state_json)
# ---------------------------------------------------------------------------

@dataclass
class SessionState:
    """Full state of an active learning session."""

    # Schema version
    version: int = 1

    # Plan
    concepts: List[str] = field(default_factory=list)
    concept_order: List[str] = field(default_factory=list)
    current_concept_idx: int = 0
    difficulty: float = 0.5

    # Tracking
    answers_since_refine: int = 0
    consecutive_correct: int = 0
    consecutive_wrong: int = 0
    concept_attempts: Dict[str, int] = field(default_factory=dict)
    concept_correct: Dict[str, int] = field(default_factory=dict)

    # Current question
    current_question: Optional[Dict[str, Any]] = None
    previous_prompts: List[str] = field(default_factory=list)

    # Discussion state (for inline Socratic)
    discussion_history: List[Dict[str, str]] = field(default_factory=list)
    discussion_phase: Optional[str] = None  # probing, hinting, etc.

    # Refine tracking
    strategy: str = "adaptive"  # adaptive, teach_first, drill
    teaching_approach: str = "socratic"  # socratic, direct, example

    def _cap_lists(self) -> None:
        """Enforce size caps on unbounded lists before serialization."""
        if len(self.previous_prompts) > 50:
            self.previous_prompts = self.previous_prompts[-25:]
        if len(self.discussion_history) > 100:
            self.discussion_history = self.discussion_history[-50:]

    def to_dict(self) -> Dict[str, Any]:
        self._cap_lists()
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionState":
        if not data:
            return cls()
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class LearningOrchestrator:
    """
    Conductor that coordinates the multi-agent learning pipeline.

    Agents used:
    - Retrieve: AdaptiveLearningService (mastery, spaced rep, misconceptions)
    - Plan: Gemini-driven session planner
    - Quiz: QuestionBankGenerator
    - Assess: MisconceptionTagger + confidence logic
    - Teach: ExitTicketAgent (repurposed for inline micro-lessons)
    - Discuss: SmartPeerService (Socratic dialogue)
    - Refine: Self-critique loop (every 3-5 answers)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.adaptive = AdaptiveLearningService(db)
        self.question_gen = QuestionBankGenerator()
        self.misconception_tagger = MisconceptionTagger()
        self.exit_ticket_agent = ExitTicketAgent()

    # ===================================================================
    # RETRIEVE agent
    # ===================================================================

    async def _retrieve(self, student_name: str, topic: str) -> Dict[str, Any]:
        """Fetch student's mastery, misconceptions, and review queue."""
        # Mastery data
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name
        )
        result = await self.db.execute(query)
        mastery_rows = list(result.scalars().all())

        mastery = {
            m.concept: {
                "score": m.mastery_score,
                "attempts": m.total_attempts,
                "correct": m.correct_attempts,
            }
            for m in mastery_rows
        }

        # Misconceptions
        query = select(StudentMisconception).where(
            and_(
                StudentMisconception.student_name == student_name,
                StudentMisconception.is_resolved == False,  # noqa: E712
            )
        )
        result = await self.db.execute(query)
        misconceptions = [
            {
                "concept": m.concept,
                "misconception": m.misconception,
                "count": m.occurrence_count,
            }
            for m in result.scalars().all()
        ]

        # Due reviews
        due_reviews = await self.adaptive.get_due_reviews(student_name)
        review_concepts = [r.concept for r in due_reviews]

        return {
            "mastery": mastery,
            "misconceptions": misconceptions,
            "review_concepts": review_concepts,
        }

    # ===================================================================
    # PLAN agent
    # ===================================================================

    async def _plan(
        self, topic: str, student_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Design a learning session: concepts, order, difficulty."""
        mastery = student_data.get("mastery", {})
        misconceptions = student_data.get("misconceptions", [])
        review_concepts = student_data.get("review_concepts", [])

        if PLANNER_MODEL:
            return await self._plan_with_llm(
                topic, mastery, misconceptions, review_concepts
            )
        return self._plan_fallback(topic, mastery, review_concepts)

    async def _plan_with_llm(
        self,
        topic: str,
        mastery: Dict,
        misconceptions: List,
        review_concepts: List,
    ) -> Dict[str, Any]:
        prompt = f"""You are a learning session planner. Create a session plan for a student.

TOPIC: {topic}

STUDENT'S EXISTING MASTERY:
{json.dumps(mastery, indent=2) if mastery else "No prior data — new student."}

ACTIVE MISCONCEPTIONS:
{json.dumps(misconceptions, indent=2) if misconceptions else "None detected."}

CONCEPTS DUE FOR REVIEW:
{json.dumps(review_concepts) if review_concepts else "None due."}

Create a learning plan with 3-6 concepts to cover in order. Prioritize:
1. Concepts due for review (spaced repetition)
2. Concepts with active misconceptions (remediation)
3. Weak concepts (low mastery)
4. New concepts to explore

Return JSON:
{{
    "concepts": ["concept1", "concept2", "concept3"],
    "starting_difficulty": 0.3-0.7,
    "session_type": "diagnostic|remediation|exploration|review",
    "rationale": "Brief explanation of the plan"
}}"""

        try:
            response = await call_gemini_with_timeout(
                PLANNER_MODEL, prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "learning_orchestrator", "operation": "plan_with_llm"},
            )
            if response is None:
                return self._plan_fallback(topic, mastery, review_concepts)
            plan = json.loads(response.text)
            return {
                "concepts": plan.get("concepts", [topic]),
                "starting_difficulty": plan.get("starting_difficulty", 0.5),
                "session_type": plan.get("session_type", "exploration"),
                "rationale": plan.get("rationale", ""),
            }
        except Exception as e:
            capture_exception(e, context={"service": "learning_orchestrator", "operation": "plan_with_llm"})
            log_error(logger, "plan_with_llm failed", error=str(e))
            return self._plan_fallback(topic, mastery, review_concepts)

    def _plan_fallback(
        self, topic: str, mastery: Dict, review_concepts: List
    ) -> Dict[str, Any]:
        # Simple fallback: topic as single concept
        concepts = []
        if review_concepts:
            concepts.extend(review_concepts[:2])
        concepts.append(topic)
        return {
            "concepts": concepts,
            "starting_difficulty": 0.4,
            "session_type": "exploration",
            "rationale": "Default plan — LLM unavailable.",
        }

    # ===================================================================
    # QUIZ agent
    # ===================================================================

    async def _generate_question(
        self, concept: str, difficulty: float, previous_prompts: List[str],
        target_misconception: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a question for a concept."""
        concept_dict = {
            "id": concept.lower().replace(" ", "_"),
            "name": concept,
            "topics": [],
            "misconceptions": [target_misconception] if target_misconception else [],
        }
        question = await self.question_gen.generate_question(
            concept_dict,
            difficulty=difficulty,
            previous_prompts=previous_prompts,
            target_misconception=target_misconception,
        )
        return question

    # ===================================================================
    # ASSESS agent
    # ===================================================================

    async def _assess(
        self,
        state: SessionState,
        answer: str,
        confidence: int,
        student_name: str,
    ) -> Dict[str, Any]:
        """Grade answer, classify misconception, update mastery."""
        question = state.current_question
        if not question:
            return {"is_correct": False, "error": "No current question"}

        correct_answer = question.get("correct_answer", "")
        is_correct = answer.strip().upper() == correct_answer.strip().upper()
        concept = question.get("concept", state.concept_order[state.current_concept_idx] if state.concept_order else "unknown")

        # Update mastery
        await self.adaptive.update_mastery(student_name, concept, is_correct, confidence)

        # Track in state
        state.concept_attempts[concept] = state.concept_attempts.get(concept, 0) + 1
        if is_correct:
            state.concept_correct[concept] = state.concept_correct.get(concept, 0) + 1
            state.consecutive_correct += 1
            state.consecutive_wrong = 0
        else:
            state.consecutive_correct = 0
            state.consecutive_wrong += 1

        state.answers_since_refine += 1

        # Misconception tagging for wrong answers
        misconception_data = None
        if not is_correct:
            try:
                result = await self.misconception_tagger.tag_response(
                    student_id=0,
                    question=question,
                    student_answer=answer,
                    student_reasoning="",
                    correct_answer=correct_answer,
                    correct_explanation=question.get("explanation"),
                )
                misconception_data = result.to_dict()
                # Track persistent misconception
                if result.description and result.confidence > 0.3:
                    await self.adaptive.track_misconception(
                        student_name, concept, result.description
                    )
            except Exception as e:
                capture_exception(e, context={"service": "learning_orchestrator", "operation": "misconception_tagging"})
                log_error(logger, "misconception_tagging failed", error=str(e))

        # Confidence-correctness quadrant
        high_confidence = confidence >= 70
        quadrant = ""
        if is_correct and high_confidence:
            quadrant = "confident_correct"
        elif is_correct and not high_confidence:
            quadrant = "uncertain_correct"
        elif not is_correct and high_confidence:
            quadrant = "confident_incorrect"
        else:
            quadrant = "uncertain_incorrect"

        return {
            "is_correct": is_correct,
            "correct_answer": correct_answer,
            "explanation": question.get("explanation", ""),
            "confidence": confidence,
            "quadrant": quadrant,
            "misconception": misconception_data,
            "concept": concept,
        }

    # ===================================================================
    # REFINE agent (self-critique loop)
    # ===================================================================

    def _refine(self, state: SessionState, assessment: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate session effectiveness and adjust strategy.
        Runs every 3-5 answers (or after significant events).
        """
        should_refine = state.answers_since_refine >= 3

        if not should_refine:
            return {"action": "continue", "changes": []}

        state.answers_since_refine = 0
        changes = []

        concept = assessment.get("concept", "")
        attempts = state.concept_attempts.get(concept, 0)
        correct = state.concept_correct.get(concept, 0)
        accuracy = correct / attempts if attempts > 0 else 0

        # Check: concept mastered?
        if state.consecutive_correct >= 3 and accuracy >= 0.75:
            changes.append("concept_mastered")
            # Move to next concept
            if state.current_concept_idx < len(state.concept_order) - 1:
                state.current_concept_idx += 1
                state.consecutive_correct = 0
                state.difficulty = max(0.3, state.difficulty - 0.1)

        # Check: difficulty too hard?
        if state.consecutive_wrong >= 3:
            state.difficulty = max(0.2, state.difficulty - 0.15)
            if state.teaching_approach == "socratic":
                state.teaching_approach = "direct"
            changes.append("difficulty_decreased")

        # Check: difficulty too easy?
        if state.consecutive_correct >= 4 and state.difficulty < 0.8:
            state.difficulty = min(0.9, state.difficulty + 0.15)
            changes.append("difficulty_increased")

        # Check: stuck on same misconception?
        if assessment.get("misconception") and attempts >= 3 and accuracy < 0.4:
            state.strategy = "teach_first"
            changes.append("switch_to_teach_first")

        # Check: fatigue (many questions answered)
        total_answered = sum(state.concept_attempts.values())
        if total_answered >= 12:
            changes.append("suggest_wrap_up")

        return {"action": "refined", "changes": changes}

    # ===================================================================
    # TEACH agent
    # ===================================================================

    async def _generate_micro_lesson(
        self, concept: str, misconception: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Generate an inline micro-lesson for a concept."""
        responses = []
        if misconception:
            responses.append(
                {
                    "concept": concept,
                    "is_correct": False,
                    "misconception": misconception.get("description", ""),
                }
            )
        ticket = await self.exit_ticket_agent.generate_exit_ticket(
            student_id=0,
            session_responses=responses,
            concepts=[concept],
        )
        return {
            "title": f"Let's review: {concept}",
            "content": ticket.get("micro_lesson", f"Let's explore {concept} together."),
            "concept": concept,
        }

    # ===================================================================
    # DECIDE: what happens next after assessment + refine
    # ===================================================================

    async def _decide_next_action(
        self,
        assessment: Dict[str, Any],
        refine_result: Dict[str, Any],
        state: SessionState,
    ) -> Dict[str, Any]:
        """
        Decision tree driven by Assess + Refine results.
        Returns { action, message, content?, agent }
        """
        quadrant = assessment.get("quadrant", "")
        changes = refine_result.get("changes", [])
        concept = assessment.get("concept", "")
        explanation = assessment.get("explanation", "")

        # Wrap-up signal
        if "suggest_wrap_up" in changes:
            return {
                "action": "wrap_up",
                "message": "You've been working hard! Let's wrap up this session and review what you've learned.",
                "agent": "refine",
            }

        # Concept mastered
        if "concept_mastered" in changes:
            next_concept = (
                state.concept_order[state.current_concept_idx]
                if state.current_concept_idx < len(state.concept_order)
                else None
            )
            msg = f"Great work! You've got a solid handle on **{concept}**."
            if next_concept:
                msg += f" Let's move on to **{next_concept}**."
            return {
                "action": "celebrate",
                "message": msg,
                "agent": "refine",
                "next_concept": next_concept,
            }

        # Teach-first strategy override
        if "switch_to_teach_first" in changes:
            lesson = await self._generate_micro_lesson(
                concept, assessment.get("misconception")
            )
            return {
                "action": "teach",
                "message": "Let me explain this a bit differently.",
                "lesson": lesson,
                "agent": "teach",
            }

        # Wrong + high confidence → Socratic discussion
        if quadrant == "confident_incorrect":
            return {
                "action": "discuss",
                "message": f"Hmm, that's not quite right. The correct answer is **{assessment['correct_answer']}**. You seemed pretty confident though — let's explore why you thought that.",
                "agent": "discuss",
                "concept": concept,
                "misconception": assessment.get("misconception"),
            }

        # Wrong + low confidence → Teach
        if quadrant == "uncertain_incorrect":
            lesson = await self._generate_micro_lesson(
                concept, assessment.get("misconception")
            )
            return {
                "action": "teach",
                "message": f"Not quite — the answer is **{assessment['correct_answer']}**. {explanation}\n\nLet me walk you through this.",
                "lesson": lesson,
                "agent": "teach",
            }

        # Right + low confidence → Brief reinforcement
        if quadrant == "uncertain_correct":
            return {
                "action": "question",
                "message": f"That's right! {explanation}\n\nYou weren't fully sure, but your instinct was correct. Let's build on that confidence.",
                "agent": "quiz",
            }

        # Right + high confidence → Move on, harder question
        if quadrant == "confident_correct":
            state.difficulty = min(0.9, state.difficulty + 0.05)
            return {
                "action": "question",
                "message": f"Correct! {explanation}",
                "agent": "quiz",
            }

        # Default: next question
        return {
            "action": "question",
            "message": "Let's continue.",
            "agent": "quiz",
        }

    # ===================================================================
    # PUBLIC API: start_session
    # ===================================================================

    async def start_session(
        self, student_name: str, topic: str, student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start a new learning session. Runs Retrieve → Plan, returns first question."""
        # RETRIEVE
        student_data = await self._retrieve(student_name, topic)

        # PLAN
        plan = await self._plan(topic, student_data)
        concepts = plan.get("concepts", [topic])

        # Create session state
        state = SessionState(
            concepts=concepts,
            concept_order=concepts,
            difficulty=plan.get("starting_difficulty", 0.5),
        )

        # Generate first diagnostic question
        first_concept = concepts[0] if concepts else topic
        question = await self._generate_question(
            first_concept, state.difficulty, []
        )
        state.current_question = question
        state.previous_prompts.append(question.get("prompt", ""))

        # Create DB record
        session = LearningSession(
            student_name=student_name,
            student_id=uuid.UUID(student_id) if student_id else None,
            topic=topic,
            phase="diagnostic",
            state_json=state.to_dict(),
            plan_json=plan,
            concepts_covered=concepts,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        # Build initial messages
        mastery_summary = ""
        if student_data["mastery"]:
            strong = [c for c, m in student_data["mastery"].items() if m["score"] >= 70]
            weak = [c for c, m in student_data["mastery"].items() if m["score"] < 40]
            if strong:
                mastery_summary += f"You're already strong in: **{', '.join(strong[:3])}**. "
            if weak:
                mastery_summary += f"Let's work on: **{', '.join(weak[:3])}**. "

        greeting = f"Let's learn about **{topic}**! "
        if mastery_summary:
            greeting += mastery_summary
        greeting += "\n\nI'll start with a few questions to see where you're at."

        plan_msg = f"**Session plan:** {plan.get('rationale', f'Covering {len(concepts)} concepts.')}"

        return {
            "session_id": str(session.id),
            "messages": [
                {"role": "ai", "content": greeting, "action": "plan_update", "agent": "plan"},
                {"role": "ai", "content": plan_msg, "action": "plan_update", "agent": "plan"},
            ],
            "question": {
                "id": question.get("id", ""),
                "prompt": question.get("prompt", ""),
                "options": question.get("options", []),
                "concept": first_concept,
                "difficulty": state.difficulty,
            },
            "plan": plan,
            "phase": "diagnostic",
        }

    # ===================================================================
    # PUBLIC API: process_answer
    # ===================================================================

    async def process_answer(
        self,
        session_id: str,
        answer: str,
        confidence: int = 50,
    ) -> Dict[str, Any]:
        """Process student answer: Assess → Refine → next action."""
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = SessionState.from_dict(session.state_json)

        # ASSESS
        assessment = await self._assess(state, answer, confidence, session.student_name)

        # Update session counters
        session.questions_answered += 1
        if assessment["is_correct"]:
            session.questions_correct += 1

        # Record question history
        try:
            from ..db_models_question_history import QuestionHistory
            current_q = state.current_question or {}
            qh = QuestionHistory(
                session_id=session.id,
                student_name=session.student_name,
                student_id=str(session.student_id) if session.student_id else None,
                prompt=current_q.get("prompt", ""),
                options=current_q.get("options", []),
                correct_answer=assessment["correct_answer"],
                explanation=assessment.get("explanation"),
                student_answer=answer,
                is_correct=assessment["is_correct"],
                confidence=confidence,
                concept=assessment.get("concept", ""),
                difficulty=state.difficulty,
                topic=session.topic,
                mode="learn",
            )
            self.db.add(qh)
        except Exception:
            pass  # Don't break answer flow for history recording

        # REFINE
        refine_result = self._refine(state, assessment)

        # DECIDE next action
        decision = await self._decide_next_action(assessment, refine_result, state)

        # If next action is a new question, generate it
        question_data = None
        if decision["action"] == "question":
            current_concept = (
                state.concept_order[state.current_concept_idx]
                if state.current_concept_idx < len(state.concept_order)
                else state.concepts[0] if state.concepts else session.topic
            )
            # Target misconception if one was detected
            target_misconception = None
            if assessment.get("misconception") and assessment["misconception"].get("description"):
                target_misconception = assessment["misconception"]["description"]

            question = await self._generate_question(
                current_concept,
                state.difficulty,
                state.previous_prompts,
                target_misconception,
            )
            state.current_question = question
            state.previous_prompts.append(question.get("prompt", ""))
            question_data = {
                "id": question.get("id", ""),
                "prompt": question.get("prompt", ""),
                "options": question.get("options", []),
                "concept": current_concept,
                "difficulty": state.difficulty,
            }

        # Handle celebration → next question
        if decision["action"] == "celebrate" and decision.get("next_concept"):
            next_concept = decision["next_concept"]
            question = await self._generate_question(
                next_concept, state.difficulty, state.previous_prompts
            )
            state.current_question = question
            state.previous_prompts.append(question.get("prompt", ""))
            question_data = {
                "id": question.get("id", ""),
                "prompt": question.get("prompt", ""),
                "options": question.get("options", []),
                "concept": next_concept,
                "difficulty": state.difficulty,
            }

        # Update phase
        if session.questions_answered >= 3 and session.phase == "diagnostic":
            session.phase = "learning"
        if decision["action"] == "wrap_up":
            session.phase = "ended"
            session.ended_at = utc_now()

        # Save state
        session.state_json = state.to_dict()
        await self.db.commit()

        return {
            "session_id": session_id,
            "assessment": {
                "is_correct": assessment["is_correct"],
                "correct_answer": assessment["correct_answer"],
                "explanation": assessment["explanation"],
                "quadrant": assessment["quadrant"],
            },
            "action": decision["action"],
            "message": decision["message"],
            "agent": decision.get("agent"),
            "question": question_data,
            "lesson": decision.get("lesson"),
            "phase": session.phase,
            "progress": {
                "questions_answered": session.questions_answered,
                "questions_correct": session.questions_correct,
                "accuracy": round(
                    session.questions_correct / max(1, session.questions_answered) * 100
                ),
                "current_concept": state.concept_order[state.current_concept_idx]
                if state.current_concept_idx < len(state.concept_order)
                else None,
                "concepts_remaining": max(
                    0, len(state.concept_order) - state.current_concept_idx - 1
                ),
            },
        }

    # ===================================================================
    # PUBLIC API: process_message (discussion)
    # ===================================================================

    async def process_message(
        self, session_id: str, message: str
    ) -> Dict[str, Any]:
        """Process a free-text message during discussion phase."""
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = SessionState.from_dict(session.state_json)

        # Use smart peer service for Socratic dialogue
        from ..services.smart_peer_service import generate_smart_peer_response

        question = state.current_question or {}
        correct_answer = question.get("correct_answer", "")

        # Build chat history from discussion_history
        chat_history = state.discussion_history.copy()
        chat_history.append({"role": "student", "content": message})

        try:
            response = await generate_smart_peer_response(
                question=question,
                student_answer="",
                student_reasoning=message,
                correct_answer=correct_answer,
                is_correct=False,
                chat_history=chat_history,
                player_id=session.student_name,
                confidence=50,
            )
            ai_message = response.get("message", "Let me think about that...")
            discussion_state = response.get("discussion_state", {})
        except Exception as e:
            capture_exception(e, context={"service": "learning_orchestrator", "operation": "process_discussion_message"})
            log_error(logger, "process_discussion_message failed", error=str(e))
            ai_message = "That's an interesting thought. Can you tell me more about your reasoning?"
            discussion_state = {}

        # Update state
        state.discussion_history.append({"role": "student", "content": message})
        state.discussion_history.append({"role": "ai", "content": ai_message})

        # Check if discussion should end (student understood)
        phase = discussion_state.get("phase", state.discussion_phase)
        state.discussion_phase = phase
        ready_for_retry = phase == "explaining" or response.get("ready_to_retry", False)

        session.state_json = state.to_dict()
        await self.db.commit()

        result: Dict[str, Any] = {
            "session_id": session_id,
            "action": "discuss",
            "message": ai_message,
            "agent": "discuss",
            "discussion_phase": phase,
        }

        if ready_for_retry:
            # Generate a retry question on the same concept
            concept = question.get("concept", session.topic)
            retry_q = await self._generate_question(
                concept, state.difficulty, state.previous_prompts
            )
            state.current_question = retry_q
            state.previous_prompts.append(retry_q.get("prompt", ""))
            state.discussion_history = []
            state.discussion_phase = None
            session.state_json = state.to_dict()
            await self.db.commit()

            result["ready_to_retry"] = True
            result["question"] = {
                "id": retry_q.get("id", ""),
                "prompt": retry_q.get("prompt", ""),
                "options": retry_q.get("options", []),
                "concept": concept,
                "difficulty": state.difficulty,
            }

        return result

    # ===================================================================
    # PUBLIC API: end_session
    # ===================================================================

    async def end_session(self, session_id: str) -> Dict[str, Any]:
        """End session: final Refine pass, mastery updates, spaced rep scheduling."""
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = SessionState.from_dict(session.state_json)
        session.phase = "ended"
        session.ended_at = utc_now()

        # Schedule spaced repetition for covered concepts
        for concept in state.concepts:
            attempts = state.concept_attempts.get(concept, 0)
            correct = state.concept_correct.get(concept, 0)
            if attempts > 0:
                accuracy = correct / attempts
                # Quality 0-5 for SM-2 algorithm
                quality = min(5, int(accuracy * 5))
                question_template = state.current_question or {"prompt": f"Review {concept}"}
                await self.adaptive.schedule_review(
                    session.student_name, concept, question_template, quality
                )

        session.state_json = state.to_dict()
        await self.db.commit()

        accuracy = (
            session.questions_correct / max(1, session.questions_answered) * 100
        )

        # Get updated mastery for covered concepts
        mastery_updates = []
        for concept in state.concepts:
            query = select(ConceptMastery).where(
                and_(
                    ConceptMastery.student_name == session.student_name,
                    ConceptMastery.concept == concept,
                )
            )
            result = await self.db.execute(query)
            m = result.scalars().first()
            if m:
                mastery_updates.append(
                    {"concept": concept, "score": round(m.mastery_score, 1)}
                )

        return {
            "session_id": session_id,
            "action": "wrap_up",
            "message": f"Session complete! You answered **{session.questions_answered}** questions with **{accuracy:.0f}%** accuracy.",
            "summary": {
                "questions_answered": session.questions_answered,
                "questions_correct": session.questions_correct,
                "accuracy": round(accuracy),
                "concepts_covered": state.concepts,
                "mastery_updates": mastery_updates,
                "duration_minutes": (
                    (session.ended_at - session.started_at).total_seconds() / 60
                    if session.ended_at and session.started_at
                    else 0
                ),
            },
        }

    # ===================================================================
    # Helpers
    # ===================================================================

    async def _get_session(self, session_id: str) -> Optional[LearningSession]:
        query = select(LearningSession).where(
            LearningSession.id == uuid.UUID(session_id)
        )
        result = await self.db.execute(query)
        return result.scalars().first()
