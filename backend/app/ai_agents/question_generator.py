"""
Question Bank Generator - LLM-Powered Question Creation

Generates complete question banks for peer instruction experiments
with full, educational content (not placeholder text).
"""

import json
import time
import random
from pathlib import Path
from typing import Dict, Any, Optional, List

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout, GEMINI_AVAILABLE
from ..ai_cache import (
    cache_key_builder, hash_context, CachedPool, TTL_QUESTION_POOL,
)

logger = get_logger(__name__)


def shuffle_options(question: Dict) -> Dict:
    """Shuffle options and update correct_answer + explanation to match new positions."""
    import re

    options = question.get("options", [])
    correct_answer = question.get("correct_answer", "A")

    if not options or len(options) < 4:
        return question

    # Find the correct option text
    correct_idx = ord(correct_answer[0].upper()) - ord('A')
    if correct_idx < 0 or correct_idx >= len(options):
        return question

    # Strip the letter prefixes to get just the answer text
    option_texts = []
    for opt in options:
        if len(opt) > 2 and opt[1] == '.' and opt[2] == ' ':
            option_texts.append(opt[3:])
        elif len(opt) > 2 and opt[1] == ')' and opt[2] == ' ':
            option_texts.append(opt[3:])
        else:
            option_texts.append(opt)

    # Save original order for remapping
    original_order = list(option_texts)
    correct_text = option_texts[correct_idx]

    # Shuffle the option texts
    random.shuffle(option_texts)

    # Build old→new letter mapping
    letter_map = {}
    for old_idx, text in enumerate(original_order):
        new_idx = option_texts.index(text)
        old_letter = chr(ord('A') + old_idx)
        new_letter = chr(ord('A') + new_idx)
        letter_map[old_letter] = new_letter

    # Find new position of correct answer
    new_correct_idx = option_texts.index(correct_text)
    new_correct_letter = chr(ord('A') + new_correct_idx)

    # Rebuild options with letter prefixes
    new_options = [f"{chr(ord('A') + i)}. {text}" for i, text in enumerate(option_texts)]

    # Remap letter references in explanation so they match shuffled order
    explanation = question.get("explanation", "")
    if explanation and letter_map:
        # Use placeholders to avoid double-replacement (A→C then C→B)
        for old_letter, new_letter in letter_map.items():
            placeholder = f"__OPTION_{old_letter}__"
            # Match patterns like "Option A", "option A", "A.", "A)", "A is", "A:"
            explanation = re.sub(
                rf'\b(Option\s+){old_letter}\b',
                rf'\1{placeholder}',
                explanation,
                flags=re.IGNORECASE,
            )
            explanation = re.sub(
                rf'\b{old_letter}([.)\s:,])',
                rf'{placeholder}\1',
                explanation,
            )
        # Replace placeholders with final letters
        for old_letter, new_letter in letter_map.items():
            placeholder = f"__OPTION_{old_letter}__"
            explanation = explanation.replace(placeholder, new_letter)
        question["explanation"] = explanation

    # Also remap misconception_trap_option if present
    trap = question.get("misconception_trap_option", "")
    if trap and len(trap) == 1 and trap.upper() in letter_map:
        question["misconception_trap_option"] = letter_map[trap.upper()]

    # Update question
    question["options"] = new_options
    question["correct_answer"] = new_correct_letter

    return question


# NOTE: Concepts are now passed as parameters, not hardcoded.
# Example concept format:
# {
#     "id": "concept_identifier",
#     "name": "Human Readable Name",
#     "topics": ["subtopic1", "subtopic2"],
#     "misconceptions": ["common misconception 1", "common misconception 2"]
# }



class QuestionBankGenerator:
    """
    Generates complete question banks for peer instruction experiments.
    
    Uses Gemini LLM to create specific, educational questions with:
    - Real content (not placeholders)
    - Plausible distractors based on common misconceptions
    - Detailed explanations
    - Difficulty calibration
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.available = GEMINI_AVAILABLE
    
    async def generate_question(
        self,
        concept: Dict[str, Any],
        difficulty: float = 0.5,
        previous_prompts: List[str] = None,
        target_misconception: Optional[str] = None,
        question_type: str = "conceptual",
        context: Optional[str] = None,
        rich_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a single question for a concept using LLM.

        Args:
            concept: Concept dict with id, name, topics, misconceptions
            difficulty: 0.0-1.0 difficulty level
            previous_prompts: List of previous question prompts to avoid repetition
            target_misconception: Specific misconception to target (for adaptive remediation)
            question_type: Type of question - "conceptual", "application", "analysis", "transfer"
            context: Optional short context string
            rich_context: Optional extended context (up to 10000 chars) from resources/notes

        Returns:
            Question dict with prompt, options, correct_answer, explanation
        """
        if not self.available:
            return self._fallback_question(concept, difficulty)

        # --- Pool cache check ---
        ctx_hash = hash_context(rich_context or context)
        pool_key = cache_key_builder(
            "question", concept["name"],
            difficulty=difficulty, question_type=question_type,
            context_hash=ctx_hash,
        )
        cached = await CachedPool.get_one(pool_key)
        if cached and cached.get("prompt") not in (previous_prompts or []):
            logger.info("question_cache_hit", extra={"concept": concept["name"]})
            return shuffle_options(cached)
        # --- End cache check ---

        difficulty_label = "easy" if difficulty < 0.4 else "medium" if difficulty < 0.7 else "hard"
        
        prev_context = ""
        if previous_prompts:
            prev_context = "\n\nAvoid these previously asked questions:\n" + "\n".join(f"- {p}" for p in previous_prompts[-5:])
        
        # Enhanced misconception targeting
        misconception_instruction = ""
        if target_misconception:
            misconception_instruction = f"""
CRITICAL - TARGET MISCONCEPTION: {target_misconception}
Design the question to specifically expose and address this misconception.
Make one wrong option directly embody this misconception (the "trap" option).
The question scenario should make the misconception seem plausible."""
        
        # Question type guidance
        type_guidance = {
            "conceptual": "Test understanding of the core concept definition and principles.",
            "application": "Present a real-world scenario where students must apply the concept.",
            "analysis": "Require students to analyze a situation and identify underlying principles.",
            "transfer": "Present a novel context where the concept applies in an unexpected way."
        }.get(question_type, "Test understanding of the concept.")
        
        # Optional source material block — prefer rich_context over truncated context
        context_block = ""
        if rich_context and rich_context.strip():
            context_block = f"""
SOURCE MATERIAL (use this to ground your question in the actual course content):
{rich_context[:10000]}
"""
        elif context and context.strip():
            context_block = f"""
SOURCE MATERIAL (use this to ground your question in the actual course content):
{context[:2000]}
"""

        prompt = f"""You are an expert educator creating a peer instruction question for a course.

CONCEPT: {concept['name']}
RELATED TOPICS: {', '.join(concept.get('topics', []))}
COMMON STUDENT MISCONCEPTIONS: {', '.join(concept.get('misconceptions', []))}
DIFFICULTY: {difficulty_label} ({difficulty:.1f}/1.0)
QUESTION TYPE: {question_type.upper()} - {type_guidance}
{context_block}{misconception_instruction}
{prev_context}

Create a SPECIFIC, EDUCATIONAL multiple choice question for this concept.

CRITICAL REQUIREMENTS:
1. Questions must have SPECIFIC content - real details, concrete examples, actual scenarios
2. Options must be REAL answers (specific values, concrete choices, TRUE/FALSE about specific claims)
3. At least one distractor should exploit a listed misconception
4. Include detailed explanation
5. Identify which option is the "misconception trap" (the tempting wrong answer)

Return ONLY valid JSON matching this structure:
{{
    "prompt": "Specific educational question",
    "options": ["A. Specific option", "B. Specific option", "C. Specific option", "D. Specific option"],
    "correct_answer": "A",
    "explanation": "Detailed explanation of why A is correct and why others are wrong",
    "common_traps": ["What makes wrong options tempting"],
    "misconception_trap_option": "B",
    "target_misconception": "{target_misconception or 'general'}"
}}"""

        try:
            response = await call_gemini_with_timeout(
                prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "question_generator", "operation": "generate_question"},
            )
            if response is not None:
                result = json.loads(response.text)

                # Validate the question has real content
                if self._validate_question(result):
                    result["id"] = f"q_{concept['id']}_{hash(result['prompt']) % 10000}"
                    result["concept"] = concept["id"]
                    result["difficulty"] = difficulty
                    result["question_type"] = question_type
                    result["target_misconception"] = target_misconception
                    # Store pre-shuffle version in pool for answer-position variety
                    await CachedPool.add_to_pool(pool_key, result, TTL_QUESTION_POOL)
                    return shuffle_options(result)
        except Exception as e:
            capture_exception(e, context={"service": "question_generator", "operation": "generate_question"})
            log_error(logger, "generate_question failed", error=str(e))

        return self._fallback_question(concept, difficulty)
    
    def _validate_question(self, question: Dict) -> bool:
        """Check if question has real educational content (not placeholders)."""
        prompt = question.get("prompt", "")
        options = question.get("options", [])

        # Reject obvious placeholder/fallback markers
        if "[LLM Required]" in prompt or "[LLM required" in prompt:
            return False

        # Ensure we have enough options with real content
        if len(options) < 4:
            return False

        for opt in options:
            if "[LLM required" in opt or len(opt.strip()) < 5:
                return False

        return True
    
    def _fallback_question(self, concept: Dict, difficulty: float) -> Dict:
        """Fallback when LLM is unavailable - returns minimal placeholder."""
        # LLM is required for proper question generation
        # This returns a minimal result indicating the limitation
        concept_id = concept.get("id", "unknown")
        concept_name = concept.get("name", "Unknown Concept")
        
        return shuffle_options({
            "id": f"q_{concept_id}_llm_required",
            "concept": concept_id,
            "difficulty": difficulty,
            "prompt": f"[LLM Required] Question about {concept_name}",
            "options": [
                "A. [LLM required for option generation]",
                "B. [LLM required for option generation]",
                "C. [LLM required for option generation]",
                "D. [LLM required for option generation]"
            ],
            "correct_answer": "A",
            "explanation": f"LLM is required to generate educational content for {concept_name}.",
            "common_traps": [],
            "llm_required": True
        })
    
    async def generate_course_questions(
        self,
        concepts: List[Dict],
        num_per_concept: int = 1
    ) -> List[Dict]:
        """
        Generate a full set of questions for any course/topic.

        Args:
            concepts: List of concept dicts with id, name, topics, misconceptions
            num_per_concept: Number of questions per concept

        Returns:
            List of question dicts
        """
        if not concepts:
            raise ValueError("concepts parameter is required - pass a list of concept dicts")

        questions = []
        previous_prompts = []

        # Difficulty progression
        difficulties = [0.4, 0.55, 0.65, 0.75]

        for i, concept in enumerate(concepts):
            for j in range(num_per_concept):
                diff = difficulties[min(i + j, len(difficulties) - 1)]

                q = await self.generate_question(concept, diff, previous_prompts)
                questions.append(q)
                previous_prompts.append(q.get("prompt", ""))

        return questions

    # Keep old name as alias for backwards compatibility
    async def generate_cs70_questions(self, num_per_concept: int = 1, concepts: List[Dict] = None) -> List[Dict]:
        """Deprecated - use generate_course_questions instead."""
        if concepts is None:
            raise ValueError("concepts parameter is now required. Pass a list of concept dicts.")
        return await self.generate_course_questions(concepts, num_per_concept)
    
    def get_or_generate_questions(
        self,
        cache_path: str = None,
        regenerate: bool = False,
        num_per_concept: int = 1
    ) -> List[Dict]:
        """
        Load questions from cache or generate new ones.
        
        Args:
            cache_path: Path to cache file
            regenerate: Force regeneration even if cache exists
            num_per_concept: Questions per concept when generating
            
        Returns:
            List of question dicts
        """
        if cache_path is None:
            cache_path = Path(__file__).parent.parent / "experiments" / "question_bank.json"
        
        cache_path = Path(cache_path)
        
        # Try to load from cache
        if cache_path.exists() and not regenerate:
            try:
                with open(cache_path, 'r') as f:
                    data = json.load(f)
                    print(f"Loaded {len(data['questions'])} questions from cache")
                    return data["questions"]
            except Exception as e:
                capture_exception(e, context={"service": "question_generator", "operation": "load_cache"})
                log_error(logger, "load_cache failed", error=str(e))
        
        # Generate new questions
        print("Generating new questions with LLM...")
        questions = self.generate_cs70_questions(num_per_concept=num_per_concept)
        
        # Save to cache
        try:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, 'w') as f:
                json.dump({
                    "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "questions": questions
                }, f, indent=2)
            print(f"Saved {len(questions)} questions to cache")
        except Exception as e:
            capture_exception(e, context={"service": "question_generator", "operation": "save_cache"})
            log_error(logger, "save_cache failed", error=str(e))
        
        return questions


# Convenience function for quick generation
def generate_questions(num_per_concept: int = 1, regenerate: bool = False) -> List[Dict]:
    """Quick function to generate or load cached questions."""
    gen = QuestionBankGenerator()
    return gen.get_or_generate_questions(regenerate=regenerate, num_per_concept=num_per_concept)


if __name__ == "__main__":
    # Test question generation
    gen = QuestionBankGenerator()
    
    print("Testing single question generation...")
    q = gen.generate_question(CS70_CONCEPTS[0], difficulty=0.5)  # noqa: F821
    print("\nGenerated question:")
    print(f"  Prompt: {q['prompt']}")
    print(f"  Options: {q['options']}")
    print(f"  Answer: {q['correct_answer']}")
    print(f"  Explanation: {q['explanation'][:100]}...")
    
    print("\n\nGenerating full question bank...")
    questions = gen.generate_cs70_questions(num_per_concept=1)
    print(f"Generated {len(questions)} questions")
    
    for q in questions[:3]:
        print(f"\n{q['concept']}: {q['prompt'][:80]}...")
