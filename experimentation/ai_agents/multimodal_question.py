#!/usr/bin/env python3
"""
Multi-modal Question Support
=============================
Support for questions with images, code snippets, LaTeX, and diagrams.
Integrates with Gemini Vision for image-based questions.
"""

import os
import base64
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class MediaContent:
    """A piece of media content for a question."""
    media_type: str  # "image", "code", "latex", "diagram", "table"
    content: str  # Base64 for images, raw text for others
    alt_text: Optional[str] = None
    language: Optional[str] = None  # For code: "python", "java", etc.
    caption: Optional[str] = None


@dataclass
class MultiModalQuestion:
    """A question with multi-modal content."""
    id: str
    prompt: str
    options: List[str]
    correct_answer: str
    concept: str
    difficulty: float
    
    # Multi-modal content
    media: List[MediaContent] = field(default_factory=list)
    
    # Optional structured content
    code_snippet: Optional[str] = None
    latex_equations: Optional[List[str]] = None
    mermaid_diagram: Optional[str] = None
    table_data: Optional[Dict[str, Any]] = None
    
    # Metadata
    requires_image_understanding: bool = False
    explanation: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "prompt": self.prompt,
            "options": self.options,
            "correct_answer": self.correct_answer,
            "concept": self.concept,
            "difficulty": self.difficulty,
            "media": [
                {
                    "type": m.media_type,
                    "content": m.content[:100] + "..." if m.media_type == "image" else m.content,
                    "alt_text": m.alt_text
                }
                for m in self.media
            ],
            "code_snippet": self.code_snippet,
            "latex_equations": self.latex_equations,
            "mermaid_diagram": self.mermaid_diagram,
            "requires_image_understanding": self.requires_image_understanding
        }
    
    def to_html(self) -> str:
        """Convert to HTML for display."""
        html_parts = [f"<div class='question'><p><strong>{self.prompt}</strong></p>"]
        
        # Add media
        for media in self.media:
            if media.media_type == "image":
                html_parts.append(
                    f"<img src='data:image/png;base64,{media.content}' "
                    f"alt='{media.alt_text or 'Question image'}' />"
                )
            elif media.media_type == "code":
                lang = media.language or "python"
                html_parts.append(f"<pre><code class='{lang}'>{media.content}</code></pre>")
            elif media.media_type == "latex":
                html_parts.append(f"<div class='latex'>$${media.content}$$</div>")
        
        # Add code snippet if present
        if self.code_snippet:
            html_parts.append(f"<pre><code>{self.code_snippet}</code></pre>")
        
        # Add LaTeX equations
        if self.latex_equations:
            for eq in self.latex_equations:
                html_parts.append(f"<div class='latex'>$${eq}$$</div>")
        
        # Add Mermaid diagram
        if self.mermaid_diagram:
            html_parts.append(f"<div class='mermaid'>{self.mermaid_diagram}</div>")
        
        # Add options
        html_parts.append("<ul class='options'>")
        for opt in self.options:
            html_parts.append(f"<li>{opt}</li>")
        html_parts.append("</ul></div>")
        
        return "\n".join(html_parts)
    
    def to_markdown(self) -> str:
        """Convert to Markdown for display."""
        md_parts = [f"**{self.prompt}**\n"]
        
        # Add code
        if self.code_snippet:
            md_parts.append(f"\n```python\n{self.code_snippet}\n```\n")
        
        # Add LaTeX
        if self.latex_equations:
            for eq in self.latex_equations:
                md_parts.append(f"\n$${eq}$$\n")
        
        # Add Mermaid
        if self.mermaid_diagram:
            md_parts.append(f"\n```mermaid\n{self.mermaid_diagram}\n```\n")
        
        # Add options
        md_parts.append("\n")
        for opt in self.options:
            md_parts.append(f"- {opt}\n")
        
        return "".join(md_parts)


class MultiModalQuestionGenerator:
    """
    Generates multi-modal questions using LLM.
    Supports various content types.
    """
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
    
    def generate_question_with_code(
        self,
        concept: str,
        language: str = "python",
        difficulty: float = 0.5
    ) -> MultiModalQuestion:
        """
        Generate a question that includes a code snippet.
        
        Args:
            concept: The concept to test
            language: Programming language for the code
            difficulty: Target difficulty 0-1
            
        Returns:
            MultiModalQuestion with code snippet
        """
        if not self.model:
            return self._create_sample_code_question(concept, language, difficulty)
        
        prompt = f"""Generate a multiple choice question about {concept} that includes a {language} code snippet.

Difficulty: {difficulty:.0%}

Return JSON:
{{
    "prompt": "Question text (should reference the code below)",
    "code_snippet": "actual {language} code (3-10 lines)",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A/B/C/D",
    "explanation": "Why the correct answer is right"
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                return MultiModalQuestion(
                    id=f"code_{concept}_{datetime.now().timestamp()}",
                    prompt=result.get("prompt", ""),
                    options=result.get("options", []),
                    correct_answer=result.get("correct_answer", "A"),
                    concept=concept,
                    difficulty=difficulty,
                    code_snippet=result.get("code_snippet"),
                    explanation=result.get("explanation")
                )
        except Exception as e:
            print(f"Code question generation error: {e}")
        
        return self._create_sample_code_question(concept, language, difficulty)
    
    def generate_question_with_diagram(
        self,
        concept: str,
        diagram_type: str = "graph",
        difficulty: float = 0.5
    ) -> MultiModalQuestion:
        """
        Generate a question with a Mermaid diagram.
        
        Args:
            concept: The concept to test
            diagram_type: "graph", "flowchart", "tree", "sequence"
            difficulty: Target difficulty 0-1
            
        Returns:
            MultiModalQuestion with Mermaid diagram
        """
        if not self.model:
            return self._create_sample_diagram_question(concept, diagram_type, difficulty)
        
        prompt = f"""Generate a multiple choice question about {concept} that includes a {diagram_type} diagram.

The diagram should be in Mermaid syntax.
Difficulty: {difficulty:.0%}

Return JSON:
{{
    "prompt": "Question text (should reference the diagram)",
    "mermaid_diagram": "valid mermaid syntax for the diagram",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A/B/C/D",
    "explanation": "Why the correct answer is right"
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                return MultiModalQuestion(
                    id=f"diagram_{concept}_{datetime.now().timestamp()}",
                    prompt=result.get("prompt", ""),
                    options=result.get("options", []),
                    correct_answer=result.get("correct_answer", "A"),
                    concept=concept,
                    difficulty=difficulty,
                    mermaid_diagram=result.get("mermaid_diagram"),
                    explanation=result.get("explanation")
                )
        except Exception as e:
            print(f"Diagram question generation error: {e}")
        
        return self._create_sample_diagram_question(concept, diagram_type, difficulty)
    
    def generate_question_with_latex(
        self,
        concept: str,
        difficulty: float = 0.5
    ) -> MultiModalQuestion:
        """
        Generate a question with LaTeX equations.
        """
        if not self.model:
            return self._create_sample_latex_question(concept, difficulty)
        
        prompt = f"""Generate a multiple choice question about {concept} that includes mathematical notation.

Use LaTeX for any mathematical expressions.
Difficulty: {difficulty:.0%}

Return JSON:
{{
    "prompt": "Question text",
    "latex_equations": ["equation1", "equation2"],
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A/B/C/D",
    "explanation": "Why the correct answer is right"
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                return MultiModalQuestion(
                    id=f"latex_{concept}_{datetime.now().timestamp()}",
                    prompt=result.get("prompt", ""),
                    options=result.get("options", []),
                    correct_answer=result.get("correct_answer", "A"),
                    concept=concept,
                    difficulty=difficulty,
                    latex_equations=result.get("latex_equations"),
                    explanation=result.get("explanation")
                )
        except Exception as e:
            print(f"LaTeX question generation error: {e}")
        
        return self._create_sample_latex_question(concept, difficulty)
    
    def _create_sample_code_question(
        self,
        concept: str,
        language: str,
        difficulty: float
    ) -> MultiModalQuestion:
        """Create a sample code question without LLM."""
        return MultiModalQuestion(
            id=f"sample_code_{concept}",
            prompt="What is the output of this code?",
            options=[
                "A. [1, 2, 3]",
                "B. [3, 2, 1]",
                "C. Error",
                "D. None"
            ],
            correct_answer="B",
            concept=concept,
            difficulty=difficulty,
            code_snippet="lst = [1, 2, 3]\nlst.reverse()\nprint(lst)"
        )
    
    def _create_sample_diagram_question(
        self,
        concept: str,
        diagram_type: str,
        difficulty: float
    ) -> MultiModalQuestion:
        """Create a sample diagram question without LLM."""
        return MultiModalQuestion(
            id=f"sample_diagram_{concept}",
            prompt="How many edges are in this graph?",
            options=["A. 3", "B. 4", "C. 5", "D. 6"],
            correct_answer="C",
            concept=concept,
            difficulty=difficulty,
            mermaid_diagram="""graph LR
    A --- B
    B --- C
    C --- D
    D --- A
    A --- C"""
        )
    
    def _create_sample_latex_question(
        self,
        concept: str,
        difficulty: float
    ) -> MultiModalQuestion:
        """Create a sample LaTeX question without LLM."""
        return MultiModalQuestion(
            id=f"sample_latex_{concept}",
            prompt="Simplify the following expression:",
            options=[
                r"A. $\frac{1}{n}$",
                r"B. $n$",
                r"C. $n^2$",
                r"D. $\sqrt{n}$"
            ],
            correct_answer="A",
            concept=concept,
            difficulty=difficulty,
            latex_equations=[r"\sum_{i=1}^{n} \frac{1}{n^2}"]
        )


# Singleton instance
multimodal_generator = MultiModalQuestionGenerator()
