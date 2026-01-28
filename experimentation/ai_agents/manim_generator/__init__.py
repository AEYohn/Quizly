"""
Manim Animation Generator Module

A 3-agent pipeline using Gemini for generating educational Manim animations
from natural language descriptions.

Pipeline:
1. Concept Agent - Breaks down topic, identifies prerequisites, key equations
2. Scene Planner - Plans animation timeline, scenes, Manim objects
3. Code Generator - Generates executable Manim Python code
"""

from .concept_agent import ConceptAgent, ConceptBreakdown
from .scene_planner import ScenePlanner, AnimationScene, ScenePlan
from .code_generator import CodeGenerator, ManimCode
from .validator import ManimValidator
from .pipeline import ManimPipeline, PipelineResult

__all__ = [
    # Agents
    "ConceptAgent",
    "ScenePlanner",
    "CodeGenerator",
    "ManimValidator",
    "ManimPipeline",

    # Data structures
    "ConceptBreakdown",
    "AnimationScene",
    "ScenePlan",
    "ManimCode",
    "PipelineResult",
]
