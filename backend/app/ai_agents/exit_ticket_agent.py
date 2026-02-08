"""
Exit Ticket Agent
Generates personalized end-of-session micro-lessons, homework questions, and study packets.

Uses proven prompt engineering techniques:
1. Chain-of-thought reasoning - analyze patterns before generating content
2. Few-shot examples - show expected output format
3. Structured data - provide ALL available context
4. Role prompting - position AI as expert learning scientist
5. Output constraints - specific JSON schema with validation
"""

import json
import os
from typing import Dict, Any, Optional, List

from ..utils.llm_utils import call_gemini_with_timeout

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class ExitTicketAgent:
    """
    AI agent that generates personalized exit tickets.

    Analyzes student performance to create targeted micro-lessons
    focusing on each student's weakest concepts.  When the LLM is
    available it produces a comprehensive study packet (study notes,
    practice questions, flashcards, misconception analysis).  When the
    LLM is unavailable it falls back to a deterministic placeholder.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_exit_ticket(
        self,
        student_name: str,
        target_concept: str,
        session_accuracy: float,
        responses: List[Dict[str, Any]],
        concepts: List[str],
        peer_discussion_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive, personalized exit ticket / study packet.

        Args:
            student_name: Display name of the student.
            target_concept: The weakest concept identified for this student.
            session_accuracy: Overall accuracy (0.0-1.0) for the session.
            responses: Raw list of student response dicts from the session.
            concepts: All concepts covered in the session.
            peer_discussion_data: Optional summary from a peer discussion.

        Returns:
            Dict matching the route-level exit-ticket schema (target_concept,
            study_notes, micro_lesson, encouragement, question,
            practice_questions, flashcards, misconceptions).
        """
        if self.model:
            return await self._generate_with_gemini(
                student_name=student_name,
                target_concept=target_concept,
                session_accuracy=session_accuracy,
                responses=responses,
                concepts=concepts,
                peer_discussion_data=peer_discussion_data,
            )
        return self._fallback_exit_ticket(
            student_name=student_name,
            target_concept=target_concept,
            session_accuracy=session_accuracy,
            responses=responses,
        )

    async def batch_generate(
        self,
        student_responses: Dict[int, List[Dict[str, Any]]],
        concepts: List[str],
    ) -> List[Dict[str, Any]]:
        """Generate exit tickets for multiple students."""
        tickets = []
        for student_id, responses in student_responses.items():
            # Calculate per-student accuracy
            total = len(responses)
            correct = sum(1 for r in responses if r.get("is_correct", False))
            accuracy = correct / total if total > 0 else 0.0

            # Pick weakest concept
            target_concept = self._find_weakest_concept(responses, concepts)

            ticket = await self.generate_exit_ticket(
                student_name=str(student_id),
                target_concept=target_concept,
                session_accuracy=accuracy,
                responses=responses,
                concepts=concepts,
            )
            tickets.append(ticket)
        return tickets

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_weakest_concept(
        responses: List[Dict[str, Any]],
        concepts: List[str],
    ) -> str:
        """Return the concept with the lowest accuracy."""
        concept_stats: Dict[str, Dict[str, int]] = {}
        for r in responses:
            concept = r.get("concept", concepts[0] if concepts else "General")
            if concept not in concept_stats:
                concept_stats[concept] = {"correct": 0, "total": 0}
            concept_stats[concept]["total"] += 1
            if r.get("is_correct", False):
                concept_stats[concept]["correct"] += 1

        target = concepts[0] if concepts else "General"
        lowest = 1.0
        for concept, stats in concept_stats.items():
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            if acc < lowest:
                lowest = acc
                target = concept
        return target

    # ------------------------------------------------------------------
    # Gemini generation (comprehensive prompt)
    # ------------------------------------------------------------------

    async def _generate_with_gemini(
        self,
        student_name: str,
        target_concept: str,
        session_accuracy: float,
        responses: List[Dict[str, Any]],
        concepts: List[str],
        peer_discussion_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build a comprehensive prompt and call Gemini to produce a full
        study packet (micro-lesson, practice questions, flashcards, etc.).
        """

        # ----- Step 1: Build detailed context from student responses -----

        response_context = ""
        total_time_ms = 0
        questions_with_reasoning = 0
        questions_with_peer_discussion = 0

        for i, r in enumerate(responses, 1):
            status = "CORRECT" if r.get("is_correct", False) else "INCORRECT"
            conf = r.get("confidence", 50)
            conf_label = (
                "very confident" if conf >= 80
                else "somewhat confident" if conf >= 50
                else "uncertain"
            )

            response_context += f"\n\n--- QUESTION {i} ---"
            response_context += f"\nSTATUS: {status}"
            response_context += f"\nCONFIDENCE: {conf}% ({conf_label})"
            response_context += f"\nQUESTION: {r.get('question_text', 'N/A')}"

            if r.get("options"):
                response_context += "\nOPTIONS:"
                for opt_key, opt_val in r.get("options", {}).items():
                    marker = ">" if opt_key == r.get("student_answer", "")[:1] else " "
                    response_context += f"\n  {marker} {opt_key}: {opt_val}"

            response_context += f"\nSTUDENT CHOSE: {r.get('student_answer', 'N/A')}"

            if not r.get("is_correct", False):
                response_context += f"\nCORRECT ANSWER: {r.get('correct_answer', 'N/A')}"

            time_ms = r.get("time_taken_ms", 0)
            if time_ms:
                total_time_ms += time_ms
                time_label = (
                    "very quick" if time_ms < 5000
                    else "thoughtful" if time_ms < 20000
                    else "struggled"
                )
                response_context += f"\nTIME TAKEN: {time_ms / 1000:.1f}s ({time_label})"

            if r.get("reasoning"):
                questions_with_reasoning += 1
                response_context += f'\nSTUDENT\'S REASONING: "{r.get("reasoning")}"'

            if r.get("had_peer_discussion"):
                questions_with_peer_discussion += 1
                response_context += "\n[Had peer discussion on this question]"

        # ----- Step 2: Compute analytics / patterns -----

        wrong_answers = [r for r in responses if not r.get("is_correct", False)]
        high_confidence_wrong = [r for r in wrong_answers if r.get("confidence", 50) >= 70]
        low_confidence_correct = [
            r for r in responses
            if r.get("is_correct", False) and r.get("confidence", 50) < 40
        ]

        patterns: List[str] = []
        if high_confidence_wrong:
            patterns.append(
                f"HIGH-CONFIDENCE ERRORS: {len(high_confidence_wrong)} questions "
                "where student was confident but wrong"
            )
        if low_confidence_correct:
            patterns.append(
                f"UNDERCONFIDENCE: {len(low_confidence_correct)} questions "
                "where student was unsure but correct"
            )
        if wrong_answers and questions_with_reasoning < len(wrong_answers) / 2:
            patterns.append(
                "LIMITED REASONING: Student provided little explanation for their answers"
            )

        avg_time = (total_time_ms / len(responses) / 1000) if responses else 0
        if avg_time and avg_time < 5:
            patterns.append(
                f"RUSHED: Average {avg_time:.1f}s per question - may be rushing through"
            )
        elif avg_time > 30:
            patterns.append(
                f"STRUGGLING: Average {avg_time:.1f}s per question - finding material difficult"
            )

        patterns_text = (
            "\n".join(f"- {p}" for p in patterns)
            if patterns
            else "No specific patterns detected"
        )

        # ----- Step 3: Peer discussion context -----

        discussion_context = ""
        if peer_discussion_data:
            discussion_context = (
                "\n\n"
                "PEER DISCUSSION INSIGHTS (Student discussed with AI tutor)\n"
                f"Summary: {peer_discussion_data.get('summary', 'N/A')}\n"
                f"Key Insights: {', '.join(peer_discussion_data.get('key_insights', [])) or 'None recorded'}\n"
                f"Misconceptions Identified: {', '.join(peer_discussion_data.get('misconceptions_identified', [])) or 'None identified'}\n"
                f"Understanding Improved: {peer_discussion_data.get('understanding_improved', 'Unknown')}"
            )

        # ----- Step 4: Determine complexity -----

        if session_accuracy >= 0.8:
            num_practice = 5
            difficulty = "challenging extension"
        elif session_accuracy >= 0.5:
            num_practice = 6
            difficulty = "reinforcement and slight challenge"
        else:
            num_practice = 8
            difficulty = "foundational practice building up"

        num_flashcards = 3 if session_accuracy >= 0.7 else 4 if session_accuracy >= 0.4 else 5

        # ----- Step 5: Assemble prompt -----

        prompt = f"""You are an expert learning scientist creating a COMPREHENSIVE personalized study packet for a student. This is NOT a quick check - it's their homework and study guide based on their quiz performance.

STUDENT PROFILE
Name: {student_name}
Topic Area: {target_concept}
Session Accuracy: {session_accuracy * 100:.0f}% ({sum(1 for r in responses if r.get('is_correct', False))}/{len(responses)} correct)
Questions with reasoning provided: {questions_with_reasoning}/{len(responses)}
Questions with peer discussion: {questions_with_peer_discussion}/{len(responses)}
Average response time: {avg_time:.1f}s per question

DETECTED LEARNING PATTERNS
{patterns_text}

DETAILED PERFORMANCE LOG (MOST IMPORTANT - Analyze carefully!)
{response_context}
{discussion_context}

YOUR TASK: Create a COMPREHENSIVE Study Packet

This student needs {difficulty} questions. Generate:

1. PERSONALIZED STUDY NOTES (study_notes object)
   Create detailed, structured notes covering:
   - Key concepts they need to master (based on their errors)
   - Common pitfalls to avoid (from their specific mistakes)
   - Step-by-step strategies for this topic
   - Memory tricks or mnemonics where helpful

2. QUICK REVIEW (micro_lesson - 4-6 sentences)
   - Directly address their SPECIFIC errors
   - Reference their actual wrong answers
   - Explain the correct approach

3. HOMEWORK QUESTIONS ({num_practice} practice questions)
   This is their homework - generate EXACTLY {num_practice} varied questions:
   - Questions 1-2: Foundation (easier versions of what they missed)
   - Questions 3-4: Core practice (similar difficulty to quiz)
   - Questions 5+: Extension (slightly harder applications)

   Each question MUST have 4 options and target their specific gaps.

4. FLASHCARDS ({num_flashcards} cards)
   Key terms and concepts for memorization

5. MISCONCEPTION ANALYSIS
   Identify and correct their specific misunderstandings

CRITICAL: Generate EXACTLY {num_practice} practice questions. This is homework, not just a check.

Return ONLY valid JSON:
{{
    "target_concept": "Specific concept to master",
    "study_notes": {{
        "key_concepts": [
            "First key concept they need to understand...",
            "Second key concept...",
            "Third key concept..."
        ],
        "common_mistakes": [
            "Mistake 1: Description and how to avoid it",
            "Mistake 2: Description and how to avoid it"
        ],
        "strategies": [
            "Strategy 1: Step-by-step approach for this topic",
            "Strategy 2: Another helpful technique"
        ],
        "memory_tips": [
            "Tip 1: Mnemonic or memory aid",
            "Tip 2: Another helpful trick"
        ]
    }},
    "micro_lesson": "4-6 sentence personalized explanation addressing THEIR specific errors...",
    "encouragement": "Brief encouraging message...",
    "practice_questions": [
        {{
            "prompt": "Question 1 (Foundation level)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "A",
            "hint": "Guiding hint",
            "explanation": "Why correct and connection to their mistake",
            "difficulty": "foundation"
        }},
        {{
            "prompt": "Question 2 (Foundation level)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "B",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "foundation"
        }},
        {{
            "prompt": "Question 3 (Core practice)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "C",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "core"
        }},
        {{
            "prompt": "Question 4 (Core practice)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "D",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "core"
        }},
        {{
            "prompt": "Question 5+ (Extension)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "A",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "extension"
        }}
    ],
    "flashcards": [
        {{"front": "Term/concept?", "back": "Clear explanation"}}
    ],
    "misconceptions": [
        {{
            "type": "Misconception name",
            "description": "What student incorrectly believes",
            "correction": "Correct understanding"
        }}
    ]
}}"""

        try:
            response = await call_gemini_with_timeout(
                self.model,
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.7,
                    "max_output_tokens": 4096,
                },
                context={"agent": "exit_ticket", "operation": "generate_exit_ticket"},
            )

            if response is None:
                return self._fallback_exit_ticket(
                    student_name, target_concept, session_accuracy, responses,
                )

            response_text = response.text.strip()
            result = json.loads(response_text)

            # Handle array response (Gemini sometimes returns array)
            if isinstance(result, list):
                result = result[0] if result else {}

            # Extract first question for backwards compatibility
            practice_questions = result.get("practice_questions", [])
            first_question = practice_questions[0] if practice_questions else {
                "prompt": result.get("question", {}).get("prompt", ""),
                "options": result.get("question", {}).get("options", []),
                "correct_answer": result.get("question", {}).get("correct_answer", "A"),
                "hint": result.get("question", {}).get("hint", ""),
            }

            return {
                "target_concept": result.get("target_concept", target_concept),
                "study_notes": result.get("study_notes", {}),
                "micro_lesson": result.get("micro_lesson", ""),
                "encouragement": result.get("encouragement", ""),
                "question": first_question,
                "practice_questions": practice_questions,
                "flashcards": result.get("flashcards", []),
                "misconceptions": result.get("misconceptions", []),
            }

        except json.JSONDecodeError as e:
            print(f"JSON parse error in exit ticket: {e}")
            return self._fallback_exit_ticket(
                student_name, target_concept, session_accuracy, responses,
            )
        except Exception as e:
            print(f"Gemini exit ticket generation error: {e}")
            return self._fallback_exit_ticket(
                student_name, target_concept, session_accuracy, responses,
            )

    # ------------------------------------------------------------------
    # Fallback (no LLM available)
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_exit_ticket(
        student_name: str,
        target_concept: str,
        session_accuracy: float,
        responses: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Deterministic fallback when the LLM is unavailable.

        Returns a minimal but structurally valid exit ticket so that the
        calling route can persist it without changes.
        """
        wrong = [r for r in responses if not r.get("is_correct", False)]
        wrong_summary = ""
        if wrong:
            wrong_summary = (
                f" You missed {len(wrong)} question(s) related to {target_concept}."
                " Review the core definitions and try to identify why each"
                " wrong answer was incorrect."
            )

        micro_lesson = (
            f"Let's review {target_concept}. Your accuracy this session was "
            f"{session_accuracy * 100:.0f}%.{wrong_summary}"
        )

        return {
            "target_concept": target_concept,
            "study_notes": {},
            "micro_lesson": micro_lesson,
            "encouragement": (
                f"Keep going, {student_name}! Every mistake is a learning opportunity."
            ),
            "question": {
                "prompt": f"Which of the following best describes {target_concept}?",
                "options": [
                    f"A) A core principle of {target_concept}",
                    "B) An unrelated concept",
                    f"C) A common misconception about {target_concept}",
                    "D) None of the above",
                ],
                "correct_answer": "A",
                "hint": f"Think about the fundamental definition of {target_concept}.",
            },
            "practice_questions": [],
            "flashcards": [],
            "misconceptions": [],
        }
