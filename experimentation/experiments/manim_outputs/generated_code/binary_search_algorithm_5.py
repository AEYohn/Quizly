from manim import *

class BinarySearchAlgorithm(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene 1: Introduction to Binary Search (7.0s)
        title = Text("Binary Search Algorithm", font_size=48, color=primary_color)
        description = Text("Efficiently find an element in a sorted list.", font_size=30, color=WHITE)
        sorted_data_note = Text("Requires sorted data!", font_size=30, color=accent_color)
        VGroup(title, description, sorted_data_note).arrange(DOWN)

        self.play(Write(title), run_time=2)
        self.play(FadeIn(description), run_time=2)
        self.play(FadeIn(sorted_data_note), run_time=1)
        self.wait(2)
        self.play(FadeOut(title, description, sorted_data_note))

        # Scene 2: Visualizing the Sorted Array (12.0s)
        array_size = 10
        rectangles = VGroup(*[Rectangle(width=0.5, height=i + 1, color=primary_color, fill_opacity=0.7) for i in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1)
        rectangles.move_to(ORIGIN)

        number_line = NumberLine(x_range=[0, array_size - 1, 1], length=rectangles.width, color=secondary_color)
        number_line.next_to(rectangles, DOWN, buff=0.5)

        indices = VGroup(*[MathTex(str(i), color=WHITE).scale(0.7).next_to(rectangles[i], UP, buff=0.1) for i in range(array_size)])

        self.play(Create(rectangles), run_time=4)
        self.play(Create(number_line), run_time=2)
        self.play(Write(indices), run_time=3)
        self.wait(3)
        self.play(FadeOut(rectangles, number_line, indices))

        # Scene 3: Initialization: Low, High, and Mid (10.0s)
        rectangles = VGroup(*[Rectangle(width=0.5, height=i + 1, color=primary_color, fill_opacity=0.7) for i in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)

        low_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[0], DOWN)
        low_text = MathTex("Low", color=secondary_color).next_to(low_arrow, DOWN)

        high_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[-1], DOWN)
        high_text = MathTex("High", color=secondary_color).next_to(high_arrow, DOWN)

        mid_index = array_size // 2
        mid_arrow = Arrow(DOWN, UP, color=accent_color).next_to(rectangles[mid_index], DOWN)
        mid_text = MathTex("Mid", color=accent_color).next_to(mid_arrow, DOWN)

        mid_equation = MathTex(r"Mid = \frac{Low + High}{2}", color=WHITE).to_edge(UP)

        self.play(Create(rectangles), run_time=2)
        self.play(Create(low_arrow), Write(low_text), run_time=1)
        self.play(Create(high_arrow), Write(high_text), run_time=1)
        self.play(Create(mid_arrow), Write(mid_text), run_time=1)
        self.play(Write(mid_equation), run_time=2)
        self.wait(3)
        self.play(FadeOut(rectangles, low_arrow, low_text, high_arrow, high_text, mid_arrow, mid_text, mid_equation))

        # Scene 4: Comparison and Interval Reduction (15.0s)
        rectangles = VGroup(*[Rectangle(width=0.5, height=i + 1, color=primary_color, fill_opacity=0.7) for i in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)
        target_value = 7
        target_text = Text(f"Target = {target_value}", color=WHITE).to_edge(UP)
        self.play(Create(rectangles), Write(target_text))

        low_index = 0
        high_index = array_size - 1
        mid_index = (low_index + high_index) // 2

        low_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[low_index], DOWN)
        low_text = MathTex("Low", color=secondary_color).next_to(low_arrow, DOWN)
        high_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[high_index], DOWN)
        high_text = MathTex("High", color=secondary_color).next_to(high_arrow, DOWN)
        mid_arrow = Arrow(DOWN, UP, color=accent_color).next_to(rectangles[mid_index], DOWN)
        mid_text = MathTex("Mid", color=accent_color).next_to(mid_arrow, DOWN)

        self.play(Create(low_arrow), Write(low_text), Create(high_arrow), Write(high_text), Create(mid_arrow), Write(mid_text))

        comparison_result = Text(f"Comparing {target_value} with {mid_index + 1}", color=WHITE).next_to(mid_arrow, UP)
        self.play(Write(comparison_result))
        self.wait(2)

        if target_value > mid_index + 1:
            self.play(
                Transform(low_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN)),
                Transform(low_text, MathTex("Low", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(low_index, mid_index + 1)])
            )
            low_index = mid_index + 1
            self.wait(3)
        else:
            self.play(
                Transform(high_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN)),
                Transform(high_text, MathTex("High", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(mid_index, high_index + 1)])
            )
            high_index = mid_index - 1
            self.wait(3)

        self.play(FadeOut(comparison_result, target_text))
        self.wait(2)

        # Scene 5: Iteration and Shrinking Search Space (13.0s)
        rectangles = VGroup(*[Rectangle(width=0.5, height=i + 1, color=primary_color, fill_opacity=0.7) for i in range(array_size)])
        rectangles.arrange(RIGHT, buff=0.1).move_to(ORIGIN)
        target_value = 7
        target_text = Text(f"Target = {target_value}", color=WHITE).to_edge(UP)
        self.play(Create(rectangles), Write(target_text))

        low_index = 0
        high_index = array_size - 1
        mid_index = (low_index + high_index) // 2

        low_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[low_index], DOWN)
        low_text = MathTex("Low", color=secondary_color).next_to(low_arrow, DOWN)
        high_arrow = Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[high_index], DOWN)
        high_text = MathTex("High", color=secondary_color).next_to(high_arrow, DOWN)
        mid_arrow = Arrow(DOWN, UP, color=accent_color).next_to(rectangles[mid_index], DOWN)
        mid_text = MathTex("Mid", color=accent_color).next_to(mid_arrow, DOWN)

        self.play(Create(low_arrow), Write(low_text), Create(high_arrow), Write(high_text), Create(mid_arrow), Write(mid_text))

        comparison_result = Text(f"Comparing {target_value} with {mid_index + 1}", color=WHITE).next_to(mid_arrow, UP)
        self.play(Write(comparison_result))
        self.wait(1)

        if target_value > mid_index + 1:
            self.play(
                Transform(low_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN)),
                Transform(low_text, MathTex("Low", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(low_index, mid_index + 1)])
            )
            low_index = mid_index + 1
            self.wait(1)
        else:
            self.play(
                Transform(high_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN)),
                Transform(high_text, MathTex("High", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(mid_index, high_index + 1)])
            )
            high_index = mid_index - 1
            self.wait(1)
        self.play(FadeOut(comparison_result))

        mid_index = (low_index + high_index) // 2
        comparison_result = Text(f"Comparing {target_value} with {mid_index + 1}", color=WHITE).next_to(mid_arrow, UP)

        self.play(
            Transform(mid_arrow, Arrow(DOWN, UP, color=accent_color).next_to(rectangles[mid_index], DOWN)),
            Transform(mid_text, MathTex("Mid", color=accent_color).next_to(Arrow(DOWN, UP, color=accent_color).next_to(rectangles[mid_index], DOWN), DOWN)),
            Write(comparison_result)
        )
        self.wait(1)

        if target_value > mid_index + 1:
            self.play(
                Transform(low_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN)),
                Transform(low_text, MathTex("Low", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index + 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(low_index, mid_index + 1)])
            )
            low_index = mid_index + 1
            self.wait(1)
        else:
            self.play(
                Transform(high_arrow, Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN)),
                Transform(high_text, MathTex("High", color=secondary_color).next_to(Arrow(DOWN, UP, color=secondary_color).next_to(rectangles[mid_index - 1], DOWN), DOWN)),
                FadeOut(*[rectangles[i] for i in range(mid_index, high_index + 1)])
            )
            high_index = mid_index - 1
            self.wait(1)
        self.play(FadeOut(comparison_result))

        self.wait(5)
        self.play(FadeOut(rectangles, low_arrow, low_text, high_arrow, high_text, mid_arrow, mid_text, target_text))

        # Scene 6: Logarithmic Time Complexity (10.0s)
        complexity_equation = MathTex(r"O(\log n)", color=WHITE).to_edge(UP)
        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 5, 1],
            axis_config={"include_numbers": True},
            tips=False,
        )
        axes.center()
        logarithmic_graph = axes.plot(lambda x: np.log(x + 1), color=secondary_color, x_range=[0, 9])

        self.play(Write(complexity_equation), run_time=2)
        self.play(Create(axes), run_time=2)
        self.play(Create(logarithmic_graph), run_time=3)
        self.wait(3)
        self.play(FadeOut(complexity_equation, axes, logarithmic_graph))

        # Scene 7: Visual Comparison: Logarithmic vs Linear (8.0s)
        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 10, 1],
            axis_config={"include_numbers": True},
            tips=False,
        ).center()

        logarithmic_graph = axes.plot(lambda x: np.log(x + 1), color=secondary_color, x_range=[0, 9])
        linear_graph = axes.plot(lambda x: x, color=primary_color, x_range=[0, 9])
        log_label = MathTex(r"O(\log n)", color=secondary_color).next_to(logarithmic_graph, RIGHT)
        linear_label = MathTex(r"O(n)", color=primary_color).next_to(linear_graph, RIGHT)

        self.play(Create(axes), run_time=2)
        self.play(Create(logarithmic_graph), Create(linear_graph), Write(log_label), Write(linear_label), run_time=3)
        self.wait(3)
        self.play(FadeOut(axes, logarithmic_graph, linear_graph, log_label, linear_label))

        # Scene 8: Summary and Conclusion (10.0s)
        summary_title = Text("Binary Search Summary", font_size=48, color=primary_color)
        point1 = Text("- Efficient for sorted data", font_size=30, color=WHITE)
        point2 = Text("- Divides search space in half", font_size=30, color=WHITE)
        point3 = Text("- Logarithmic time complexity: O(log n)", font_size=30, color=WHITE)
        VGroup(summary_title, point1, point2, point3).arrange(DOWN)

        self.play(Write(summary_title), run_time=2)
        self.play(FadeIn(point1), run_time=1)
        self.play(FadeIn(point2), run_time=1)
        self.play(FadeIn(point3), run_time=1)
        self.wait(5)
        self.play(FadeOut(summary_title, point1, point2, point3))