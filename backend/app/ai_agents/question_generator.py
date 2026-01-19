"""
Question Bank Generator - LLM-Powered Question Creation

Generates complete question banks for peer instruction experiments
with full, educational content (not placeholder text).
"""

import os
import json
import time
import random
from pathlib import Path
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def shuffle_options(question: Dict) -> Dict:
    """Shuffle options and update correct_answer to match new position."""
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
    
    correct_text = option_texts[correct_idx]
    
    # Shuffle the option texts
    random.shuffle(option_texts)
    
    # Find new position of correct answer
    new_correct_idx = option_texts.index(correct_text)
    new_correct_letter = chr(ord('A') + new_correct_idx)
    
    # Rebuild options with letter prefixes
    new_options = [f"{chr(ord('A') + i)}. {text}" for i, text in enumerate(option_texts)]
    
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
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")
    
    def generate_question(
        self,
        concept: Dict[str, Any],
        difficulty: float = 0.5,
        previous_prompts: List[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a single question for a concept using LLM.
        
        Args:
            concept: Concept dict with id, name, topics, misconceptions
            difficulty: 0.0-1.0 difficulty level
            previous_prompts: List of previous question prompts to avoid repetition
            
        Returns:
            Question dict with prompt, options, correct_answer, explanation
        """
        if not self.model:
            return self._fallback_question(concept, difficulty)
        
        difficulty_label = "easy" if difficulty < 0.4 else "medium" if difficulty < 0.7 else "hard"
        
        prev_context = ""
        if previous_prompts:
            prev_context = f"\n\nAvoid these previously asked questions:\n" + "\n".join(f"- {p}" for p in previous_prompts[-5:])
        
        prompt = f"""You are an expert educator creating a peer instruction question for a course.

CONCEPT: {concept['name']}
RELATED TOPICS: {', '.join(concept.get('topics', []))}
COMMON STUDENT MISCONCEPTIONS: {', '.join(concept.get('misconceptions', []))}
DIFFICULTY: {difficulty_label} ({difficulty:.1f}/1.0)
{prev_context}

Create a SPECIFIC, EDUCATIONAL multiple choice question for this concept.

CRITICAL REQUIREMENTS:
1. Questions must have SPECIFIC content - real details, concrete examples, actual scenarios
2. Options must be REAL answers (specific values, concrete choices, TRUE/FALSE about specific claims)
3. At least one distractor should exploit a listed misconception
4. Include detailed explanation

Return ONLY valid JSON matching this structure:
{{
    "prompt": "Specific educational question",
    "options": ["A. Specific option", "B. Specific option", "C. Specific option", "D. Specific option"],
    "correct_answer": "A",
    "explanation": "Detailed explanation of why A is correct and why others are wrong",
    "common_traps": ["What makes wrong options tempting"]
}}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text)
            
            # Validate the question has real content
            if self._validate_question(result):
                result["id"] = f"q_{concept['id']}_{hash(result['prompt']) % 10000}"
                result["concept"] = concept["id"]
                result["difficulty"] = difficulty
                # Shuffle options to randomize correct answer position
                return shuffle_options(result)
            
        except Exception as e:
            print(f"LLM question generation failed: {e}")
        
        return self._fallback_question(concept, difficulty)
    
    def _validate_question(self, question: Dict) -> bool:
        """Check if question has real educational content (not placeholders)."""
        prompt = question.get("prompt", "")
        options = question.get("options", [])
        
        # Check for placeholder patterns
        placeholder_patterns = [
            "correct understanding of",
            "common misconception about",
            "overgeneralization of",
            "confusion with a related",
            "which of the following best describes"
        ]
        
        prompt_lower = prompt.lower()
        if any(pattern in prompt_lower for pattern in placeholder_patterns):
            return False
        
        # Check options for placeholder patterns
        for opt in options:
            opt_lower = opt.lower()
            if any(pattern in opt_lower for pattern in placeholder_patterns):
                return False
        
        # Ensure we have enough options
        if len(options) < 4:
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
    
    def generate_course_questions(
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
                
                q = self.generate_question(concept, diff, previous_prompts)
                questions.append(q)
                previous_prompts.append(q.get("prompt", ""))
                
                # Rate limiting
                if self.model:
                    time.sleep(0.3)
        
        return questions
    
    # Keep old name as alias for backwards compatibility
    def generate_cs70_questions(self, num_per_concept: int = 1, concepts: List[Dict] = None) -> List[Dict]:
        """Deprecated - use generate_course_questions instead."""
        if concepts is None:
            raise ValueError("concepts parameter is now required. Pass a list of concept dicts.")
        return self.generate_course_questions(concepts, num_per_concept)
    
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
                print(f"Failed to load cache: {e}")
        
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
            print(f"Failed to save cache: {e}")
        
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
    q = gen.generate_question(CS70_CONCEPTS[0], difficulty=0.5)
    print(f"\nGenerated question:")
    print(f"  Prompt: {q['prompt']}")
    print(f"  Options: {q['options']}")
    print(f"  Answer: {q['correct_answer']}")
    print(f"  Explanation: {q['explanation'][:100]}...")
    
    print("\n\nGenerating full question bank...")
    questions = gen.generate_cs70_questions(num_per_concept=1)
    print(f"Generated {len(questions)} questions")
    
    for q in questions[:3]:
        print(f"\n{q['concept']}: {q['prompt'][:80]}...")
