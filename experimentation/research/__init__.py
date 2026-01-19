"""
Research Module
================
Tools for research experiments and A/B testing.
"""

from .ab_testing import (
    ABTestFramework,
    Experiment,
    ABResult,
    ab_testing
)

__all__ = [
    "ABTestFramework",
    "Experiment",
    "ABResult",
    "ab_testing",
]
