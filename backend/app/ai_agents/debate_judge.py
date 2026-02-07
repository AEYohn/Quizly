#!/usr/bin/env python3
"""
LLM Debate Judge
================
AI-powered evaluation of peer debate arguments.
Determines winner, identifies logical flaws, and provides feedback.
"""

import os
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)


@dataclass
class ArgumentAnalysis:
    """Analysis of a single student's argument."""
    student_id: int
    student_name: str
    answer: str
    argument_quality: float  # 0-1
    logical_soundness: float  # 0-1
    use_of_evidence: float  # 0-1
    clarity: float  # 0-1
    strengths: List[str]
    weaknesses: List[str]
    logical_flaws: List[str]


@dataclass
class JudgmentResult:
    """Complete judgment of a debate."""
    debate_id: str
    question_prompt: str
    correct_answer: str
    winner_id: Optional[int]
    winner_name: Optional[str]
    reasoning: str
    argument_analyses: Dict[int, ArgumentAnalysis]
    overall_assessment: str
    learning_recommendation: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "debate_id": self.debate_id,
            "winner_id": self.winner_id,
            "winner_name": self.winner_name,
            "reasoning": self.reasoning,
            "overall_assessment": self.overall_assessment,
            "learning_recommendation": self.learning_recommendation,
            "argument_analyses": {
                str(k): {
                    "student_id": v.student_id,
                    "student_name": v.student_name,
                    "answer": v.answer,
                    "argument_quality": v.argument_quality,
                    "strengths": v.strengths,
                    "weaknesses": v.weaknesses,
                    "logical_flaws": v.logical_flaws
                }
                for k, v in self.argument_analyses.items()
            },
            "timestamp": self.timestamp
        }


class DebateJudge:
    """
    LLM-powered judge that evaluates peer debate arguments.
    
    Capabilities:
    - Evaluate logical soundness of arguments
    - Identify which student made the stronger case
    - Detect logical flaws and misconceptions
    - Provide learning recommendations
    """
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
    
    async def evaluate_debate(
        self,
        debate_id: str,
        question: Dict[str, Any],
        student_a: Dict[str, Any],
        student_b: Dict[str, Any],
        debate_transcript: List[Dict[str, Any]]
    ) -> JudgmentResult:
        """
        Evaluate a completed debate between two students.
        
        Args:
            debate_id: Unique identifier for this debate
            question: Question dict with prompt, options, correct_answer
            student_a: Dict with id, name, initial_answer, final_answer, reasoning
            student_b: Dict with id, name, initial_answer, final_answer, reasoning
            debate_transcript: List of debate turns with speaker, argument
            
        Returns:
            JudgmentResult with winner, analyses, and recommendations
        """
        if not self.model:
            return self._fallback_judgment(debate_id, question, student_a, student_b)
        
        # Build transcript string
        transcript_text = ""
        for turn in debate_transcript:
            speaker = turn.get("speaker_name", f"Student {turn.get('speaker_id', '?')}")
            argument = turn.get("argument", "")
            changed = " [CHANGED MIND]" if turn.get("changed_mind") else ""
            transcript_text += f"{speaker}: {argument}{changed}\n\n"
        
        prompt = f"""You are an expert judge evaluating a peer instruction debate.

## Question
{question.get('prompt', 'N/A')}

## Options
{chr(10).join(question.get('options', []))}

## Correct Answer
{question.get('correct_answer', 'N/A')}

## Debaters

### Student A: {student_a.get('name', 'Unknown')}
- Initial Answer: {student_a.get('initial_answer', '?')}
- Final Answer: {student_a.get('final_answer', '?')}
- Initial Reasoning: {student_a.get('initial_reasoning', 'N/A')}

### Student B: {student_b.get('name', 'Unknown')}
- Initial Answer: {student_b.get('initial_answer', '?')}
- Final Answer: {student_b.get('final_answer', '?')}
- Initial Reasoning: {student_b.get('initial_reasoning', 'N/A')}

## Debate Transcript
{transcript_text if transcript_text else 'No transcript available'}

---

Evaluate this debate and return JSON:
{{
    "winner_id": {student_a.get('id', 0)} or {student_b.get('id', 0)} or null,
    "winner_reasoning": "Why this student won the debate",
    "student_a_analysis": {{
        "argument_quality": 0.0-1.0,
        "logical_soundness": 0.0-1.0,
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1"],
        "logical_flaws": ["flaw1"] or []
    }},
    "student_b_analysis": {{
        "argument_quality": 0.0-1.0,
        "logical_soundness": 0.0-1.0,
        "strengths": ["strength1"],
        "weaknesses": ["weakness1"],
        "logical_flaws": ["flaw1"] or []
    }},
    "overall_assessment": "Summary of the debate quality and outcome",
    "learning_recommendation": "What both students should review"
}}"""

        try:
            response = await call_gemini_with_timeout(
                self.model, prompt,
                context={"agent": "debate_judge", "operation": "evaluate_debate"},
            )
            if response is None:
                return self._fallback_judgment(debate_id, question, student_a, student_b)
            text = response.text.strip()
            
            # Extract JSON
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                # Build argument analyses
                analyses = {}
                
                a_analysis = result.get("student_a_analysis", {})
                analyses[student_a.get('id', 0)] = ArgumentAnalysis(
                    student_id=student_a.get('id', 0),
                    student_name=student_a.get('name', 'Student A'),
                    answer=student_a.get('final_answer', '?'),
                    argument_quality=a_analysis.get('argument_quality', 0.5),
                    logical_soundness=a_analysis.get('logical_soundness', 0.5),
                    use_of_evidence=0.5,
                    clarity=0.5,
                    strengths=a_analysis.get('strengths', []),
                    weaknesses=a_analysis.get('weaknesses', []),
                    logical_flaws=a_analysis.get('logical_flaws', [])
                )
                
                b_analysis = result.get("student_b_analysis", {})
                analyses[student_b.get('id', 0)] = ArgumentAnalysis(
                    student_id=student_b.get('id', 0),
                    student_name=student_b.get('name', 'Student B'),
                    answer=student_b.get('final_answer', '?'),
                    argument_quality=b_analysis.get('argument_quality', 0.5),
                    logical_soundness=b_analysis.get('logical_soundness', 0.5),
                    use_of_evidence=0.5,
                    clarity=0.5,
                    strengths=b_analysis.get('strengths', []),
                    weaknesses=b_analysis.get('weaknesses', []),
                    logical_flaws=b_analysis.get('logical_flaws', [])
                )
                
                winner_id = result.get("winner_id")
                winner_name = None
                if winner_id == student_a.get('id'):
                    winner_name = student_a.get('name')
                elif winner_id == student_b.get('id'):
                    winner_name = student_b.get('name')
                
                return JudgmentResult(
                    debate_id=debate_id,
                    question_prompt=question.get('prompt', ''),
                    correct_answer=question.get('correct_answer', ''),
                    winner_id=winner_id,
                    winner_name=winner_name,
                    reasoning=result.get('winner_reasoning', ''),
                    argument_analyses=analyses,
                    overall_assessment=result.get('overall_assessment', ''),
                    learning_recommendation=result.get('learning_recommendation', '')
                )
                
        except Exception as e:
            capture_exception(e, context={"service": "debate_judge", "operation": "evaluate_debate"})
            log_error(logger, "evaluate_debate failed", error=str(e))
        
        return self._fallback_judgment(debate_id, question, student_a, student_b)
    
    def _fallback_judgment(
        self,
        debate_id: str,
        question: Dict,
        student_a: Dict,
        student_b: Dict
    ) -> JudgmentResult:
        """Fallback judgment when LLM is unavailable."""
        correct = question.get('correct_answer', 'A')[0].upper()
        
        a_correct = student_a.get('final_answer', '?')[0].upper() == correct
        b_correct = student_b.get('final_answer', '?')[0].upper() == correct
        
        if a_correct and not b_correct:
            winner_id = student_a.get('id')
            winner_name = student_a.get('name')
            reasoning = f"{winner_name} arrived at the correct answer"
        elif b_correct and not a_correct:
            winner_id = student_b.get('id')
            winner_name = student_b.get('name')
            reasoning = f"{winner_name} arrived at the correct answer"
        else:
            winner_id = None
            winner_name = None
            reasoning = "Neither student clearly won the debate"
        
        return JudgmentResult(
            debate_id=debate_id,
            question_prompt=question.get('prompt', ''),
            correct_answer=question.get('correct_answer', ''),
            winner_id=winner_id,
            winner_name=winner_name,
            reasoning=reasoning,
            argument_analyses={},
            overall_assessment="Fallback judgment based on correctness",
            learning_recommendation="Review the correct explanation"
        )
    
    def summarize_class_debates(
        self,
        judgments: List[JudgmentResult]
    ) -> Dict[str, Any]:
        """
        Summarize multiple debate judgments for a class.
        
        Returns:
            Summary with win rates, common flaws, recommendations
        """
        if not judgments:
            return {"error": "No judgments to summarize"}
        
        total = len(judgments)
        has_winner = sum(1 for j in judgments if j.winner_id is not None)
        
        # Collect all logical flaws
        all_flaws = []
        for j in judgments:
            for analysis in j.argument_analyses.values():
                all_flaws.extend(analysis.logical_flaws)
        
        # Count flaw frequency
        flaw_counts = {}
        for flaw in all_flaws:
            flaw_counts[flaw] = flaw_counts.get(flaw, 0) + 1
        
        top_flaws = sorted(flaw_counts.items(), key=lambda x: -x[1])[:5]
        
        return {
            "total_debates": total,
            "debates_with_clear_winner": has_winner,
            "decisive_rate": has_winner / total if total > 0 else 0,
            "common_logical_flaws": top_flaws,
            "recommendations": [j.learning_recommendation for j in judgments if j.learning_recommendation]
        }


# Singleton instance
debate_judge = DebateJudge()
