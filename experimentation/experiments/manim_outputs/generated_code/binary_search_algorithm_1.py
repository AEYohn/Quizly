from manim import *

class BinarySearchAlgorithm(Scene):
    def construct(self):
        # Scene 1: Introduction: The Power of Binary Search (7.0s)
        title = Text("Binary Search: Efficiency Unleashed", font_size=48, color=BLUE)
        intro_text = Text("A faster way to find elements in sorted data.", font_size=30)
        prereq_text = Text("Prerequisite: Sorted Data", font_size=30, color=YELLOW).next_to(intro_text, DOWN, buff=0.5)
        intro_group = VGroup(title, intro_text, prereq_text).to_edge(UP)
        self.play(Write(title))
        self.wait(1)
        self.play(FadeIn(intro_text))
        self.play(FadeIn(prereq_text))
        self.wait(3)
        self.play(FadeOut(intro_group))
        self.wait(1)

        # Scene 2: Sorted Data: The Foundation (10.0s)
        array_size = 10
        rectangles = VGroup(*[Rectangle(width=0.7, height=0.5, color=WHITE, fill_color=BLUE, fill_opacity=0.7) for _ in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1)
        rectangles.move_to(ORIGIN)

        numbers = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
        number_labels = VGroup(*[MathTex(str(num)).move_to(rect.get_center()) for num, rect in zip(numbers, rectangles)])

        index_labels = VGroup(*[MathTex(str(i)).next_to(rect, DOWN, buff=0.1) for i, rect in enumerate(rectangles)])

        sorted_text = Text("Sorted Array", font_size=36, color=GREEN).to_edge(UP)
        self.play(Create(rectangles), Write(sorted_text))
        self.play(Write(number_labels), Write(index_labels))
        self.wait(4)
        must_sorted_text = Text("Data must be sorted!", font_size=42, color=RED).to_edge(DOWN)
        self.play(FadeIn(must_sorted_text))
        self.wait(4)
        self.play(FadeOut(rectangles, number_labels, index_labels, sorted_text, must_sorted_text))

        # Scene 3: Divide and Conquer: The Core Idea (15.0s)
        rectangles = VGroup(*[Rectangle(width=0.7, height=0.5, color=WHITE, fill_color=BLUE, fill_opacity=0.7) for _ in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)
        number_labels = VGroup(*[MathTex(str(num)).move_to(rect.get_center()) for num, rect in zip(numbers, rectangles)])
        self.play(Create(rectangles), Write(number_labels))

        left_line = Line(rectangles[0].get_corner(UP + LEFT), rectangles[0].get_corner(DOWN + LEFT), color=YELLOW)
        right_line = Line(rectangles[-1].get_corner(UP + RIGHT), rectangles[-1].get_corner(DOWN + RIGHT), color=YELLOW)
        self.play(Create(left_line), Create(right_line))

        divide_text = Text("Divide and Conquer", font_size=42, color=GREEN).to_edge(UP)
        self.play(Write(divide_text))
        self.wait(1)

        arrow = Arrow(UP, DOWN, color=ORANGE).next_to(rectangles[array_size // 2], UP)
        self.play(GrowArrow(arrow))
        self.play(Indicate(rectangles[array_size // 2], color=RED))
        self.wait(2)

        self.play(ShowPassingFlash(rectangles[:array_size // 2].copy().set_color(RED), run_time=1.5))
        self.wait(1)

        self.play(FadeOut(arrow))
        new_left_line = Line(rectangles[array_size // 2 + 1].get_corner(UP + LEFT), rectangles[array_size // 2 + 1].get_corner(DOWN + LEFT), color=YELLOW)
        self.play(Transform(left_line, new_left_line))
        self.wait(4)
        self.play(FadeOut(left_line, right_line, rectangles, number_labels, divide_text))
        self.wait(1)

        # Scene 4: Midpoint Calculation and Comparison (18.0s)
        midpoint_formula = MathTex("mid", "=", "left", "+", "\\frac{(right - left)}{2}").to_edge(UP)
        self.play(Write(midpoint_formula))
        self.wait(2)

        array_size = 7
        numbers = [2, 5, 7, 11, 13, 17, 19]
        rectangles = VGroup(*[Rectangle(width=0.7, height=0.5, color=WHITE, fill_color=BLUE, fill_opacity=0.7) for _ in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)
        number_labels = VGroup(*[MathTex(str(num)).move_to(rect.get_center()) for num, rect in zip(numbers, rectangles)])
        self.play(Create(rectangles), Write(number_labels))
        left_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[0].get_corner(DOWN))
        right_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[-1].get_corner(DOWN))

        self.play(Create(left_pointer), Create(right_pointer))
        self.wait(2)

        mid_index = array_size // 2
        mid_pointer = Arrow(UP, DOWN, color=RED).next_to(rectangles[mid_index], UP)
        self.play(Create(mid_pointer))
        self.play(Indicate(rectangles[mid_index], color=RED))

        comparison_text = Text("Compare value at midpoint with target", font_size=30).to_edge(DOWN)
        self.play(FadeIn(comparison_text))
        self.wait(4)

        new_left_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[mid_index + 1].get_corner(DOWN))

        self.play(Transform(left_pointer, new_left_pointer))
        self.wait(4)

        self.play(FadeOut(midpoint_formula, left_pointer, right_pointer, mid_pointer, rectangles, number_labels, comparison_text))
        self.wait(1)

        # Scene 5: Iterative Reduction of Search Space (15.0s)
        array_size = 7
        numbers = [2, 5, 7, 11, 13, 17, 19]
        rectangles = VGroup(*[Rectangle(width=0.7, height=0.5, color=WHITE, fill_color=BLUE, fill_opacity=0.7) for _ in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)
        number_labels = VGroup(*[MathTex(str(num)).move_to(rect.get_center()) for num, rect in zip(numbers, rectangles)])
        self.play(Create(rectangles), Write(number_labels))

        left_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[0].get_corner(DOWN))
        right_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[-1].get_corner(DOWN))

        self.play(Create(left_pointer), Create(right_pointer))
        self.wait(1)

        highlight_rect = SurroundingRectangle(rectangles[:], color=GREEN, buff=0.1)
        self.play(Create(highlight_rect))
        self.wait(1)

        new_highlight_rect = SurroundingRectangle(rectangles[4:], color=GREEN, buff=0.1)
        self.play(Transform(highlight_rect, new_highlight_rect))

        arrow_left = Arrow(rectangles[2].get_corner(UP), rectangles[2].get_corner(DOWN), color=RED)
        self.play(Create(arrow_left))

        discard_text = Text("Discard left half", font_size=24, color=RED).next_to(arrow_left, LEFT)
        self.play(FadeIn(discard_text))
        self.wait(3)

        new_left_pointer = Triangle(color=YELLOW, fill_opacity=1).scale(0.2).move_to(rectangles[4].get_corner(DOWN))
        self.play(Transform(left_pointer, new_left_pointer))

        new_highlight_rect2 = SurroundingRectangle(rectangles[4:], color=GREEN, buff=0.1)
        self.play(Transform(highlight_rect, new_highlight_rect2))

        self.wait(5)
        self.play(FadeOut(highlight_rect, arrow_left, discard_text, left_pointer, right_pointer, rectangles, number_labels))
        self.wait(1)

        # Scene 6: Binary Search vs. Linear Search (15.0s)
        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 5, 1],
            axis_config={"include_numbers": True},
            tips=False
        ).move_to(LEFT * 3)

        linear_graph = axes.plot(lambda x: x / 2, color=RED)
        log_graph = axes.plot(lambda x: np.log2(x + 1), color=GREEN)

        linear_label = MathTex("O(n)").next_to(linear_graph, RIGHT)
        log_label = MathTex("O(\\log n)").next_to(log_graph, RIGHT)

        graph_title = Text("Binary Search vs. Linear Search", font_size=36).to_edge(UP)

        self.play(Create(axes), Write(graph_title))
        self.play(DrawBorderThenFill(linear_graph), Write(linear_label))
        self.play(DrawBorderThenFill(log_graph), Write(log_label))

        comparison_text = Text("Binary search scales much better!", font_size=30, color=YELLOW).to_edge(DOWN)
        self.play(Write(comparison_text))
        self.wait(5)

        self.play(FadeOut(axes, linear_graph, log_graph, linear_label, log_label, graph_title, comparison_text))
        self.wait(1)

        # Scene 7: Time Complexity: O(log n) (10.0s)
        complexity_formula = MathTex("O(\\log n)", font_size=72, color=GREEN).move_to(UP)
        complexity_text = Text("Logarithmic time complexity", font_size=42).next_to(complexity_formula, DOWN, buff=1)
        implications_text = Text("Efficient even with large datasets", font_size=30, color=YELLOW).next_to(complexity_text, DOWN, buff=0.5)

        self.play(Write(complexity_formula))
        self.wait(1)
        self.play(Indicate(complexity_formula, color=BLUE))
        self.play(FadeIn(complexity_text))
        self.play(FadeIn(implications_text))
        self.wait(5)
        self.play(FadeOut(complexity_formula, complexity_text, implications_text))
        self.wait(1)