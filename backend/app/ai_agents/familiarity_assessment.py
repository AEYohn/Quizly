"""
Familiarity Assessment Agent — Self-Rating + Diagnostic Quiz

Two parts:
A) Self-rating generation (pure data transform, no LLM)
B) Diagnostic quiz generation (reuses QuestionBankGenerator)
"""

from typing import Dict, Any, List, Optional

from .question_generator import QuestionBankGenerator


class FamiliarityAssessmentAgent:
    """
    Generates assessment materials for initial familiarity estimation.
    """

    def __init__(self):
        self.question_gen = QuestionBankGenerator()

    def generate_self_rating_items(
        self, syllabus_tree: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Extract all concepts from syllabus tree for self-rating.

        Args:
            syllabus_tree: Full syllabus tree with units -> topics -> concepts

        Returns:
            List of {concept, topic_id, topic_name, unit_name} for frontend to render
        """
        items = []
        for unit in syllabus_tree.get("units", []):
            unit_name = unit.get("name", "Unknown Unit")
            for topic in unit.get("topics", []):
                topic_id = topic.get("id", "")
                topic_name = topic.get("name", "Unknown Topic")
                for concept in topic.get("concepts", []):
                    items.append({
                        "concept": concept,
                        "topic_id": topic_id,
                        "topic_name": topic_name,
                        "unit_name": unit_name,
                    })
        return items

    def generate_diagnostic_quiz(
        self,
        concepts_with_ratings: List[Dict[str, Any]],
        count: int = 6,
    ) -> List[Dict[str, Any]]:
        """
        Generate diagnostic MCQs for concepts in the uncertain zone (rating 2-4).

        Args:
            concepts_with_ratings: List of {concept, rating} from self-rating
            count: Number of diagnostic questions

        Returns:
            List of MCQ question dicts
        """
        # Filter to uncertain zone (ratings 2-4)
        uncertain = [
            c for c in concepts_with_ratings
            if 2 <= c.get("rating", 3) <= 4
        ]

        # If not enough uncertain, include some from edges
        if len(uncertain) < count:
            others = [c for c in concepts_with_ratings if c not in uncertain]
            # Prefer those closest to the uncertain boundary
            others.sort(key=lambda x: abs(x.get("rating", 3) - 3))
            uncertain.extend(others[:count - len(uncertain)])

        # Take up to `count` concepts
        selected = uncertain[:count]

        questions = []
        for item in selected:
            concept_name = item.get("concept", "")
            rating = item.get("rating", 3)

            # Difficulty based on self-rating
            if rating <= 2:
                difficulty = 0.3  # Easy question — verify they truly don't know
            elif rating >= 4:
                difficulty = 0.7  # Hard question — verify they truly do know
            else:
                difficulty = 0.5  # Medium

            concept_dict = {
                "id": concept_name.lower().replace(" ", "_"),
                "name": concept_name,
                "topics": [],
                "misconceptions": [],
            }

            question = self.question_gen.generate_question(
                concept_dict,
                difficulty=difficulty,
                question_type="conceptual",
            )

            # Skip LLM fallback placeholders
            if question.get("llm_required"):
                continue

            question["diagnostic_concept"] = concept_name
            question["self_rating"] = rating
            questions.append(question)

        return questions
