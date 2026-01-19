"""
Reasoning Student - LLM-Powered Student Agent for Peer Instruction

This module implements students that use LLM chain-of-thought reasoning
to answer questions relative to their knowledge state and misconceptions.
Students can engage in debates and genuinely update beliefs.
"""

import os
import json
import random
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class Misconception(Enum):
    """Common CS 70 misconceptions for graph concepts."""
    BFS_USES_STACK = "BFS uses a stack (LIFO) instead of queue (FIFO)"
    DFS_USES_QUEUE = "DFS uses a queue (FIFO) instead of stack (LIFO)"
    STRONGLY_CONNECTED_UNDIRECTED = "Strongly connected means no cycles"
    DIJKSTRA_NEGATIVE_OK = "Dijkstra's works with negative edges"
    TOPO_SORT_UNIQUE = "Topological sort always gives unique ordering"
    MST_SHORTEST_PATH = "MST edges are always shortest paths"


# Persona templates with knowledge gaps - TUNED FOR MORE DEBATES
PERSONA_TEMPLATES = {
    "novice": {
        "description": "A struggling student who often confuses basic concepts and has many misconceptions",
        "knowledge_level": 0.25,  # Lowered from 0.3
        "confidence_bias": 0.1,   # Slightly overconfident despite low knowledge
        "susceptibility_to_persuasion": 0.8,
        "common_misconceptions": [
            Misconception.BFS_USES_STACK,
            Misconception.DFS_USES_QUEUE,
            Misconception.STRONGLY_CONNECTED_UNDIRECTED
        ]
    },
    "average": {
        "description": "An average student with decent understanding but several gaps",
        "knowledge_level": 0.45,  # Lowered from 0.55
        "confidence_bias": 0.05,
        "susceptibility_to_persuasion": 0.55,
        "common_misconceptions": [
            Misconception.DIJKSTRA_NEGATIVE_OK,
            Misconception.TOPO_SORT_UNIQUE
        ]
    },
    "competent": {
        "description": "A decent student who sometimes gets things right",
        "knowledge_level": 0.65,  # Lowered from 0.75
        "confidence_bias": 0.1,
        "susceptibility_to_persuasion": 0.35,
        "common_misconceptions": [
            Misconception.MST_SHORTEST_PATH  # Even competent students have some gaps
        ]
    },
    "overconfident": {
        "description": "A student who thinks they know more than they do and argues confidently even when wrong",
        "knowledge_level": 0.4,   # Lowered from 0.5
        "confidence_bias": 0.4,   # Even more overconfident
        "susceptibility_to_persuasion": 0.15,  # Very hard to convince
        "common_misconceptions": [
            Misconception.MST_SHORTEST_PATH,
            Misconception.TOPO_SORT_UNIQUE,
            Misconception.DIJKSTRA_NEGATIVE_OK
        ]
    }
}


@dataclass
class ReasoningChain:
    """Represents a student's chain of thought reasoning."""
    steps: List[str]
    conclusion: str
    confidence: float
    misconceptions_used: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "steps": self.steps,
            "conclusion": self.conclusion,
            "confidence": self.confidence,
            "misconceptions_used": self.misconceptions_used
        }
    
    def to_string(self) -> str:
        return " → ".join(self.steps) + f" → Therefore: {self.conclusion}"


@dataclass
class DebatePosition:
    """A student's position in a debate."""
    answer: str
    reasoning_chain: ReasoningChain
    confidence: float
    turn: int = 0


@dataclass
class ReasoningStudent:
    """
    LLM-powered student that reasons through problems with chain-of-thought.
    
    Unlike the stochastic SimulatedStudent, this agent:
    - Uses LLM to generate actual reasoning based on its knowledge state
    - Has specific misconceptions that affect its reasoning
    - Can engage in debates and may genuinely update beliefs
    - Tracks reasoning evolution over time
    """
    
    id: int
    name: str
    persona_type: str
    knowledge_state: Dict[str, Any] = field(default_factory=dict)
    active_misconceptions: List[Misconception] = field(default_factory=list)
    debate_history: List[Dict] = field(default_factory=list)
    
    # From persona template
    knowledge_level: float = 0.5
    confidence_bias: float = 0.0
    susceptibility_to_persuasion: float = 0.5
    
    _model: Any = field(default=None, repr=False)
    _api_key: Optional[str] = field(default=None, repr=False)
    
    def __post_init__(self):
        """Initialize model and apply persona template."""
        self._api_key = os.getenv("GEMINI_API_KEY")
        if GEMINI_AVAILABLE and self._api_key:
            try:
                genai.configure(api_key=self._api_key)
                self._model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                self._model = None
        
        # Apply persona template
        if self.persona_type in PERSONA_TEMPLATES:
            template = PERSONA_TEMPLATES[self.persona_type]
            self.knowledge_level = template["knowledge_level"]
            self.confidence_bias = template["confidence_bias"]
            self.susceptibility_to_persuasion = template["susceptibility_to_persuasion"]
            
            # Apply misconceptions based on persona - HIGH RATE for more debates
            for misconception in template.get("common_misconceptions", []):
                if random.random() < 0.95:  # 95% chance to have each misconception (was 70%)
                    self.active_misconceptions.append(misconception)
    
    def reason_about_question(
        self,
        question: Dict[str, Any]
    ) -> Tuple[str, ReasoningChain]:
        """
        Use LLM to reason through a question based on knowledge state.
        
        Args:
            question: Dict with prompt, options, concept, correct_answer
            
        Returns:
            Tuple of (selected_answer, reasoning_chain)
        """
        concept = question.get("concept", "unknown")
        prompt_text = question.get("prompt", question.get("question_prompt", ""))
        options = question.get("options", ["A", "B", "C", "D"])
        correct_answer = question.get("correct_answer", "A")
        
        # Build knowledge context including misconceptions
        knowledge_context = self._build_knowledge_context(concept)
        
        if self._model:
            return self._llm_reasoning(question, knowledge_context)
        else:
            return self._fallback_reasoning(question, knowledge_context)
    
    def _build_knowledge_context(self, concept: str) -> str:
        """Build a description of what this student 'knows' (including misconceptions)."""
        context_parts = []
        
        # General knowledge level
        if self.knowledge_level < 0.4:
            context_parts.append("You have a shaky understanding of this topic.")
        elif self.knowledge_level < 0.6:
            context_parts.append("You have moderate understanding of this topic.")
        else:
            context_parts.append("You have strong understanding of this topic.")
        
        # Active misconceptions
        for misconception in self.active_misconceptions:
            if self._misconception_applies_to_concept(misconception, concept):
                context_parts.append(f"You believe: {misconception.value}")
        
        return " ".join(context_parts)
    
    def _misconception_applies_to_concept(self, misconception: Misconception, concept: str) -> bool:
        """Check if a misconception is relevant to the current concept."""
        relevance_map = {
            Misconception.BFS_USES_STACK: ["bfs", "breadth", "traversal"],
            Misconception.DFS_USES_QUEUE: ["dfs", "depth", "traversal"],
            Misconception.STRONGLY_CONNECTED_UNDIRECTED: ["connected", "strongly", "graph"],
            Misconception.DIJKSTRA_NEGATIVE_OK: ["dijkstra", "shortest", "path"],
            Misconception.TOPO_SORT_UNIQUE: ["topological", "sort", "dag"],
            Misconception.MST_SHORTEST_PATH: ["mst", "spanning", "tree"]
        }
        
        keywords = relevance_map.get(misconception, [])
        concept_lower = concept.lower()
        return any(kw in concept_lower for kw in keywords)
    
    def _llm_reasoning(
        self,
        question: Dict[str, Any],
        knowledge_context: str
    ) -> Tuple[str, ReasoningChain]:
        """Generate reasoning using LLM."""
        prompt_text = question.get("prompt", question.get("question_prompt", ""))
        options = question.get("options", ["A", "B", "C", "D"])
        concept = question.get("concept", "unknown")
        
        # Get active misconceptions for this concept
        relevant_misconceptions = [
            m for m in self.active_misconceptions 
            if self._misconception_applies_to_concept(m, concept)
        ]
        
        # Build misconception instruction - CRITICAL for making students wrong
        if relevant_misconceptions:
            misconception_instruction = f"""
CRITICAL - YOU HAVE THE FOLLOWING MISCONCEPTIONS (you believe these are TRUE facts):
{chr(10).join(f'- {m.value}' for m in relevant_misconceptions)}

You MUST reason using these beliefs as if they are correct. Do NOT second-guess them.
Your answer MUST be consistent with these beliefs, even if it leads to a wrong answer.
"""
        else:
            misconception_instruction = ""
        
        system_prompt = f"""You are a CS 70 student with the following characteristics:
{PERSONA_TEMPLATES.get(self.persona_type, {}).get('description', 'An average student')}

Your current knowledge state: {knowledge_context}
{misconception_instruction}
You must reason through this problem step by step and arrive at an answer.
Base your reasoning ONLY on what you know (including any misconceptions listed above).

Respond in this exact JSON format:
{{
    "reasoning_steps": ["step 1", "step 2", "step 3"],
    "conclusion": "your final reasoning",
    "answer": "A/B/C/D",
    "confidence": 0.0-1.0
}}
"""
        
        user_prompt = f"""Question: {prompt_text}

Options:
{chr(10).join(f'{chr(65+i)}. {opt}' if not opt.startswith(chr(65+i)) else opt for i, opt in enumerate(options))}

Think through this step by step based on your knowledge, then give your answer."""

        try:
            response = self._model.generate_content(
                system_prompt + "\n\n" + user_prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text)
            
            reasoning_chain = ReasoningChain(
                steps=result.get("reasoning_steps", ["I thought about it"]),
                conclusion=result.get("conclusion", "Based on my reasoning"),
                confidence=min(1.0, max(0.0, result.get("confidence", 0.5) + self.confidence_bias)),
                misconceptions_used=[m.value for m in self.active_misconceptions if self._misconception_applies_to_concept(m, question.get("concept", ""))]
            )
            
            return result.get("answer", "A"), reasoning_chain
            
        except Exception as e:
            return self._fallback_reasoning(question, knowledge_context)
    
    def _fallback_reasoning(
        self,
        question: Dict[str, Any],
        knowledge_context: str
    ) -> Tuple[str, ReasoningChain]:
        """Fallback reasoning without LLM."""
        options = question.get("options", ["A", "B", "C", "D"])
        correct_answer = question.get("correct_answer", "A")
        concept = question.get("concept", "unknown")
        
        # Check if misconception would lead to wrong answer
        has_relevant_misconception = any(
            self._misconception_applies_to_concept(m, concept)
            for m in self.active_misconceptions
        )
        
        # Probability of correct answer
        p_correct = self.knowledge_level
        if has_relevant_misconception:
            p_correct *= 0.3  # Much lower if has misconception
        
        is_correct = random.random() < p_correct
        
        if is_correct:
            answer = correct_answer
            steps = [
                f"I recall the definition of {concept}",
                "Applying that knowledge to this question",
                f"The answer should be {answer}"
            ]
        else:
            wrong_options = [o for o in options if not o.startswith(correct_answer[0])]
            answer = random.choice(wrong_options) if wrong_options else options[-1]
            
            if has_relevant_misconception:
                misconception = [m for m in self.active_misconceptions 
                               if self._misconception_applies_to_concept(m, concept)][0]
                steps = [
                    f"Based on what I remember about {concept}",
                    f"I believe that {misconception.value}",
                    f"So the answer must be {answer}"
                ]
            else:
                steps = [
                    f"I'm not entirely sure about {concept}",
                    "Going with my best guess",
                    f"I think it's {answer}"
                ]
        
        confidence = self.knowledge_level + self.confidence_bias + random.gauss(0, 0.1)
        confidence = max(0.1, min(1.0, confidence))
        
        return answer, ReasoningChain(
            steps=steps,
            conclusion=f"My answer is {answer}",
            confidence=confidence,
            misconceptions_used=[m.value for m in self.active_misconceptions if self._misconception_applies_to_concept(m, concept)]
        )
    
    def debate(
        self,
        opponent_position: DebatePosition,
        question: Dict[str, Any],
        my_current_position: DebatePosition
    ) -> Tuple[DebatePosition, bool]:
        """
        Engage in a debate turn. May update belief based on opponent's argument.
        
        Args:
            opponent_position: The opponent's current position and reasoning
            question: The question being debated
            my_current_position: My current position
            
        Returns:
            Tuple of (new_position, changed_mind)
        """
        if self._model:
            return self._llm_debate(opponent_position, question, my_current_position)
        else:
            return self._fallback_debate(opponent_position, question, my_current_position)
    
    def _llm_debate(
        self,
        opponent_position: DebatePosition,
        question: Dict[str, Any],
        my_current_position: DebatePosition
    ) -> Tuple[DebatePosition, bool]:
        """Handle debate turn with LLM."""
        prompt = f"""You are debating a classmate about a CS 70 question.

Question: {question.get('prompt', question.get('question_prompt', ''))}

YOUR position: {my_current_position.answer}
Your reasoning: {my_current_position.reasoning_chain.to_string()}
Your confidence: {my_current_position.confidence:.0%}

CLASSMATE'S position: {opponent_position.answer}
Their reasoning: {opponent_position.reasoning_chain.to_string()}
Their confidence: {opponent_position.confidence:.0%}

Your personality: {PERSONA_TEMPLATES.get(self.persona_type, {}).get('description', 'Average student')}
Your susceptibility to being convinced: {self.susceptibility_to_persuasion:.0%}

Based on their argument, you may:
1. MAINTAIN your position if you think you're right
2. CHANGE to their position if their argument is more convincing

Respond in JSON:
{{
    "my_response": "Your counter-argument or acceptance (1-2 sentences)",
    "new_answer": "A/B/C/D",
    "new_reasoning_steps": ["step1", "step2"],
    "new_confidence": 0.0-1.0,
    "changed_mind": true/false
}}
"""
        
        try:
            response = self._model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text)
            changed = result.get("changed_mind", False)
            
            new_chain = ReasoningChain(
                steps=result.get("new_reasoning_steps", my_current_position.reasoning_chain.steps),
                conclusion=result.get("my_response", my_current_position.reasoning_chain.conclusion),
                confidence=result.get("new_confidence", my_current_position.confidence)
            )
            
            new_position = DebatePosition(
                answer=result.get("new_answer", my_current_position.answer),
                reasoning_chain=new_chain,
                confidence=result.get("new_confidence", my_current_position.confidence),
                turn=my_current_position.turn + 1
            )
            
            return new_position, changed
            
        except Exception:
            return self._fallback_debate(opponent_position, question, my_current_position)
    
    def _fallback_debate(
        self,
        opponent_position: DebatePosition,
        question: Dict[str, Any],
        my_current_position: DebatePosition
    ) -> Tuple[DebatePosition, bool]:
        """Fallback debate logic without LLM."""
        # Simple heuristic: change mind if opponent is more confident and we're susceptible
        confidence_diff = opponent_position.confidence - my_current_position.confidence
        
        change_probability = self.susceptibility_to_persuasion * max(0, confidence_diff)
        changed_mind = random.random() < change_probability
        
        if changed_mind:
            new_position = DebatePosition(
                answer=opponent_position.answer,
                reasoning_chain=ReasoningChain(
                    steps=["After hearing my classmate's argument", "I think they make a good point"],
                    conclusion=f"I changed my answer to {opponent_position.answer}",
                    confidence=my_current_position.confidence + 0.1
                ),
                confidence=my_current_position.confidence + 0.1,
                turn=my_current_position.turn + 1
            )
        else:
            new_position = DebatePosition(
                answer=my_current_position.answer,
                reasoning_chain=ReasoningChain(
                    steps=my_current_position.reasoning_chain.steps + ["I still believe my reasoning is correct"],
                    conclusion=f"Sticking with {my_current_position.answer}",
                    confidence=my_current_position.confidence
                ),
                confidence=my_current_position.confidence,
                turn=my_current_position.turn + 1
            )
        
        return new_position, changed_mind
    
    def update_knowledge(self, concept: str, correct_explanation: str, was_correct: bool) -> float:
        """
        Update knowledge state after seeing the correct answer.
        
        Returns the learning gain.
        """
        old_level = self.knowledge_level
        
        if not was_correct:
            # Learn from mistake
            learning_rate = 0.1 * self.susceptibility_to_persuasion
            self.knowledge_level = min(1.0, self.knowledge_level + learning_rate)
            
            # Possibly correct misconceptions
            misconceptions_to_remove = []
            for m in self.active_misconceptions:
                if self._misconception_applies_to_concept(m, concept):
                    if random.random() < 0.6:  # 60% chance to correct misconception
                        misconceptions_to_remove.append(m)
            
            for m in misconceptions_to_remove:
                self.active_misconceptions.remove(m)
        
        return self.knowledge_level - old_level


def generate_reasoning_students(
    n: int,
    concepts: List[str],
    distribution: str = "realistic"
) -> List[ReasoningStudent]:
    """
    Generate a cohort of reasoning students with diverse personas.
    
    Args:
        n: Number of students
        concepts: Concepts being covered (for misconception assignment)
        distribution: "realistic", "struggling", "advanced"
        
    Returns:
        List of ReasoningStudent instances
    """
    # Persona distribution based on class type
    if distribution == "struggling":
        persona_weights = {"novice": 0.5, "average": 0.3, "overconfident": 0.2}
    elif distribution == "advanced":
        persona_weights = {"novice": 0.1, "average": 0.3, "competent": 0.5, "overconfident": 0.1}
    else:  # realistic
        persona_weights = {"novice": 0.2, "average": 0.4, "competent": 0.25, "overconfident": 0.15}
    
    personas = list(persona_weights.keys())
    weights = list(persona_weights.values())
    
    students = []
    for i in range(n):
        persona_type = random.choices(personas, weights=weights)[0]
        
        student = ReasoningStudent(
            id=i + 1,
            name=f"Student_{i + 1}",
            persona_type=persona_type,
            knowledge_state={concept: random.uniform(0.3, 0.8) for concept in concepts}
        )
        students.append(student)
    
    return students
