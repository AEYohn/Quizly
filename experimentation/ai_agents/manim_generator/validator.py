"""
Manim Code Validator - Validates generated Manim code.

Performs multiple levels of validation:
1. Python syntax check
2. Manim-specific structure validation
3. Import verification
4. Optional: Actual import test (if manim is installed)
"""

import ast
import re
from typing import List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    """Result of code validation."""
    is_valid: bool
    syntax_valid: bool
    structure_valid: bool
    imports_valid: bool
    manim_runnable: Optional[bool] = None  # None if not tested
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


class ManimValidator:
    """
    Validates Manim code for correctness and best practices.
    """

    # Known Manim classes and functions
    MANIM_CLASSES = {
        # Mobjects
        "Mobject", "VMobject", "VGroup", "Group",
        "Text", "MathTex", "Tex", "Title", "Paragraph",
        "Circle", "Square", "Rectangle", "Triangle", "Polygon",
        "Line", "Arrow", "DoubleArrow", "Vector", "Dot",
        "Arc", "Ellipse", "Annulus", "Sector",
        "NumberLine", "Axes", "CoordinateSystem", "NumberPlane",
        "Graph", "DiGraph",
        "Table", "Matrix", "DecimalNumber", "Integer",
        "Brace", "BraceBetweenPoints", "BraceLabel",
        "SVGMobject", "ImageMobject",
        # Scenes
        "Scene", "MovingCameraScene", "ZoomedScene", "ThreeDScene",
        # 3D
        "ThreeDAxes", "Surface", "Sphere", "Cube", "Cylinder", "Cone",
    }

    MANIM_ANIMATIONS = {
        # Creation
        "Create", "Write", "DrawBorderThenFill", "ShowCreation",
        "FadeIn", "FadeOut", "GrowFromCenter", "GrowFromPoint",
        "GrowArrow", "GrowFromEdge", "SpinInFromNothing",
        # Transformation
        "Transform", "ReplacementTransform", "TransformMatchingShapes",
        "TransformMatchingTex", "MoveToTarget", "ApplyMethod",
        "ApplyFunction", "ApplyMatrix",
        # Indication
        "Indicate", "Circumscribe", "Flash", "ShowPassingFlash",
        "FocusOn", "Wiggle",
        # Movement
        "MoveAlongPath", "Rotate", "Homotopy",
        # Composition
        "AnimationGroup", "Succession", "LaggedStart", "LaggedStartMap",
        # Others
        "Wait", "Uncreate", "Unwrite", "ShrinkToCenter",
    }

    MANIM_CONSTANTS = {
        # Directions
        "UP", "DOWN", "LEFT", "RIGHT", "ORIGIN",
        "UL", "UR", "DL", "DR",
        "OUT", "IN",
        # Colors
        "WHITE", "BLACK", "GREY", "GRAY",
        "RED", "GREEN", "BLUE", "YELLOW",
        "ORANGE", "PINK", "PURPLE", "TEAL",
        "GOLD", "MAROON", "LIGHT_GRAY", "DARK_GRAY",
        "RED_A", "RED_B", "RED_C", "RED_D", "RED_E",
        "BLUE_A", "BLUE_B", "BLUE_C", "BLUE_D", "BLUE_E",
        "GREEN_A", "GREEN_B", "GREEN_C", "GREEN_D", "GREEN_E",
        # Other
        "PI", "TAU", "DEGREES",
        "DEFAULT_FONT_SIZE",
    }

    def __init__(self, check_imports: bool = False):
        """
        Initialize validator.

        Args:
            check_imports: If True, attempt to actually import manim and test the code
        """
        self.check_imports = check_imports

    def validate(self, code: str) -> ValidationResult:
        """
        Validate Manim code.

        Args:
            code: Python code string to validate

        Returns:
            ValidationResult with detailed validation information
        """
        errors = []
        warnings = []
        suggestions = []

        # 1. Syntax validation
        syntax_valid, syntax_errors = self._check_syntax(code)
        errors.extend(syntax_errors)

        # 2. Structure validation
        structure_valid, structure_errors, structure_warnings = self._check_structure(code)
        errors.extend(structure_errors)
        warnings.extend(structure_warnings)

        # 3. Import validation
        imports_valid, import_errors, import_warnings = self._check_imports(code)
        errors.extend(import_errors)
        warnings.extend(import_warnings)

        # 4. Best practices check
        practice_suggestions = self._check_best_practices(code)
        suggestions.extend(practice_suggestions)

        # 5. Optional: Actual manim import test
        manim_runnable = None
        if self.check_imports and syntax_valid:
            manim_runnable, manim_errors = self._test_manim_import(code)
            errors.extend(manim_errors)

        is_valid = syntax_valid and structure_valid and imports_valid

        return ValidationResult(
            is_valid=is_valid,
            syntax_valid=syntax_valid,
            structure_valid=structure_valid,
            imports_valid=imports_valid,
            manim_runnable=manim_runnable,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )

    def _check_syntax(self, code: str) -> Tuple[bool, List[str]]:
        """Check Python syntax."""
        errors = []
        try:
            ast.parse(code)
            return True, []
        except SyntaxError as e:
            errors.append(f"Syntax error at line {e.lineno}: {e.msg}")
            return False, errors

    def _check_structure(self, code: str) -> Tuple[bool, List[str], List[str]]:
        """Check Manim-specific structure."""
        errors = []
        warnings = []

        # Check for Scene class
        if not re.search(r'class\s+\w+\s*\([^)]*Scene[^)]*\)', code):
            errors.append("No Scene class found. Code must define a class inheriting from Scene.")

        # Check for construct method
        if 'def construct(self' not in code:
            errors.append("No construct method found. Scene classes must have a construct(self) method.")

        # Check for at least one animation
        if 'self.play(' not in code and 'self.wait(' not in code:
            warnings.append("No animations found. Consider adding self.play() or self.wait() calls.")

        # Check for proper indentation in construct
        construct_match = re.search(r'def construct\(self\):\s*\n((?:\s+.*\n)*)', code)
        if construct_match:
            body = construct_match.group(1)
            if body.strip() and not body.startswith('        ') and not body.startswith('\t\t'):
                if body.startswith('    ') or body.startswith('\t'):
                    pass  # Single indent is okay
                else:
                    warnings.append("Unusual indentation in construct method.")

        return len(errors) == 0, errors, warnings

    def _check_imports(self, code: str) -> Tuple[bool, List[str], List[str]]:
        """Check for proper imports."""
        errors = []
        warnings = []

        # Check for manim import
        has_manim_import = (
            'from manim import' in code or
            'import manim' in code
        )

        if not has_manim_import:
            errors.append("Missing manim import. Add 'from manim import *' at the top.")

        # Check if using wildcard import (recommended for manim)
        if 'from manim import *' not in code and 'import manim' not in code:
            # Check if specific imports are used
            if 'from manim import' in code:
                pass  # Specific imports are fine
            else:
                warnings.append("Consider using 'from manim import *' for convenience.")

        return len(errors) == 0, errors, warnings

    def _check_best_practices(self, code: str) -> List[str]:
        """Check for best practices and provide suggestions."""
        suggestions = []

        # Check for raw backslashes in MathTex (common issue)
        if re.search(r'MathTex\s*\([^)]*\\[^\\]', code):
            suggestions.append("Use double backslashes (\\\\) in MathTex for LaTeX commands.")

        # Check for very long construct method
        construct_match = re.search(r'def construct\(self\):\s*\n((?:.*\n)*?)(?=\n\s*def |\Z)', code)
        if construct_match:
            lines = construct_match.group(1).count('\n')
            if lines > 100:
                suggestions.append("Consider breaking construct() into helper methods for readability.")

        # Check for missing wait at end
        if not code.rstrip().endswith('self.wait()'):
            if 'self.wait(' not in code[-200:]:  # Check last 200 chars
                suggestions.append("Consider adding self.wait() at the end to pause before video ends.")

        # Check for hardcoded positions
        position_count = len(re.findall(r'move_to\s*\(\s*\[[\d\s\.,\-]+\]', code))
        if position_count > 5:
            suggestions.append("Consider using relative positioning (.next_to(), .to_edge()) instead of hardcoded coordinates.")

        return suggestions

    def _test_manim_import(self, code: str) -> Tuple[bool, List[str]]:
        """Actually try to import the code with manim."""
        errors = []
        try:
            # Try to import manim
            import manim  # noqa
            # Try to execute the code in a restricted namespace
            namespace = {}
            exec("from manim import *", namespace)
            exec(code, namespace)
            return True, []
        except ImportError:
            errors.append("Manim is not installed. Install with: pip install manim")
            return None, errors
        except Exception as e:
            errors.append(f"Runtime error: {str(e)}")
            return False, errors

    def quick_validate(self, code: str) -> Tuple[bool, List[str]]:
        """
        Quick validation that only checks syntax and basic structure.

        Args:
            code: Python code to validate

        Returns:
            Tuple of (is_valid, errors)
        """
        result = self.validate(code)
        return result.is_valid, result.errors


if __name__ == "__main__":
    # Test the validator
    validator = ManimValidator()

    # Valid code
    valid_code = '''
from manim import *

class TestScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        self.play(Create(circle))
        self.wait()
'''

    # Invalid code
    invalid_code = '''
class BrokenScene:
    def construct(self):
        # Missing manim import and Scene inheritance
        circle = Circle()
        self.play(Create(circle))
'''

    print("Testing Manim Validator...")

    print("\n--- Valid Code ---")
    result = validator.validate(valid_code)
    print(f"Valid: {result.is_valid}")
    print(f"Errors: {result.errors}")
    print(f"Warnings: {result.warnings}")

    print("\n--- Invalid Code ---")
    result = validator.validate(invalid_code)
    print(f"Valid: {result.is_valid}")
    print(f"Errors: {result.errors}")
    print(f"Warnings: {result.warnings}")
