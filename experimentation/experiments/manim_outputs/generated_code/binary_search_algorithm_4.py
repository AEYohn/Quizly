from manim import *

class BinarySearchVisualization(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene 1: What is Binary Search? (8.0s)
        title = Text("Binary Search", font_size=60, color=primary_color).to_edge(UP)
        definition = Text("Efficient search algorithm for sorted data.", font_size=36, color=WHITE)
        self.play(Write(title))
        self.play(FadeIn(definition.next_to(title, DOWN, buff=0.5)))
        self.wait(8)
        self.play(FadeOut(title, definition))

        # Scene 2: Sorted Array Visualization (12.0s)
        array_values = [2, 5, 7, 12, 18, 21, 28, 33]
        array_rects = VGroup(*[Rectangle(width=1, height=1, color=primary_color, fill_opacity=0.5) for _ in array_values])
        array_rects.arrange(RIGHT, buff=0)
        array_texts = VGroup(*[Text(str(val), font_size=30, color=WHITE).move_to(rect) for val, rect in zip(array_values, array_rects)])
        array_group = VGroup(array_rects, array_texts).move_to(ORIGIN)

        self.play(Create(array_rects), Write(array_texts))
        self.wait(12)
        self.play(FadeOut(array_group))

        # Scene 3: Low, High, and Mid Pointers (15.0s)
        array_rects = VGroup(*[Rectangle(width=1, height=1, color=primary_color, fill_opacity=0.5) for _ in array_values])
        array_rects.arrange(RIGHT, buff=0)
        array_texts = VGroup(*[Text(str(val), font_size=30, color=WHITE).move_to(rect) for val, rect in zip(array_values, array_rects)])
        array_group = VGroup(array_rects, array_texts).move_to(ORIGIN)
        self.play(Create(array_rects), Write(array_texts))

        low_arrow = Arrow(DOWN, array_rects[0].get_edge(UP), color=secondary_color)
        low_text = Text("Low", font_size=24, color=secondary_color).next_to(low_arrow, DOWN)
        high_arrow = Arrow(DOWN, array_rects[-1].get_edge(UP), color=secondary_color)
        high_text = Text("High", font_size=24, color=secondary_color).next_to(high_arrow, DOWN)
        mid_index = len(array_values) // 2
        mid_arrow = Arrow(DOWN, array_rects[mid_index].get_edge(UP), color=accent_color)
        mid_text = Text("Mid", font_size=24, color=accent_color).next_to(mid_arrow, DOWN)
        mid_formula = MathTex(r"Mid = \frac{Low + High}{2}", color=WHITE).to_edge(UP)

        self.play(GrowArrow(low_arrow), Write(low_text))
        self.play(GrowArrow(high_arrow), Write(high_text))
        self.play(GrowArrow(mid_arrow), Write(mid_text))
        self.play(FadeIn(mid_formula))
        self.wait(15)
        self.play(FadeOut(low_arrow, low_text, high_arrow, high_text, mid_arrow, mid_text, mid_formula))

        # Scene 4: First Iteration: Finding the Middle (15.0s)
        target_value = 21
        target_text = Text(f"Target = {target_value}", font_size=30, color=WHITE).to_edge(UP)
        self.play(FadeIn(target_text))
        self.play(Indicate(array_rects[mid_index], color=accent_color))
        comparison_result = Text("Mid > Target, move High", font_size=24, color=WHITE).next_to(array_group, DOWN, buff=0.5)
        self.play(Write(comparison_result))
        new_high_arrow = Arrow(DOWN, array_rects[mid_index - 1].get_edge(UP), color=secondary_color)
        new_high_text = Text("High", font_size=24, color=secondary_color).next_to(new_high_arrow, DOWN)
        self.play(Transform(high_arrow, new_high_arrow), Transform(high_text, new_high_text))

        self.wait(15)
        self.play(FadeOut(comparison_result, high_arrow, high_text, target_text))

        # Scene 5: Subsequent Iterations (15.0s)
        mid_index = (0 + mid_index - 1) // 2
        new_mid_arrow = Arrow(DOWN, array_rects[mid_index].get_edge(UP), color=accent_color)
        new_mid_text = Text("Mid", font_size=24, color=accent_color).next_to(new_mid_arrow, DOWN)
        self.play(Transform(mid_arrow, new_mid_arrow), Transform(mid_text, new_mid_text))
        self.play(Indicate(array_rects[mid_index], color=accent_color))
        comparison_result = Text("Mid < Target, move Low", font_size=24, color=WHITE).next_to(array_group, DOWN, buff=0.5)
        self.play(Write(comparison_result))
        new_low_arrow = Arrow(DOWN, array_rects[mid_index + 1].get_edge(UP), color=secondary_color)
        new_low_text = Text("Low", font_size=24, color=secondary_color).next_to(new_low_arrow, DOWN)
        self.play(Transform(low_arrow, new_low_arrow), Transform(low_text, new_low_text))
        self.wait(5)

        mid_index = 5
        new_mid_arrow = Arrow(DOWN, array_rects[mid_index].get_edge(UP), color=accent_color)
        new_mid_text = Text("Mid", font_size=24, color=accent_color).next_to(new_mid_arrow, DOWN)
        self.play(Transform(mid_arrow, new_mid_arrow), Transform(mid_text, new_mid_text))
        self.play(Indicate(array_rects[mid_index], color=accent_color))
        comparison_result = Text("Mid = Target", font_size=24, color=WHITE).next_to(array_group, DOWN, buff=0.5)
        self.play(Write(comparison_result))
        self.wait(5)
        self.play(FadeOut(comparison_result, low_arrow, low_text, high_arrow, high_text, mid_arrow, mid_text))

        # Scene 6: Target Found/Not Found (10.0s)
        target_found_text = Text("Target Found!", font_size=48, color=secondary_color).to_edge(UP)
        self.play(FadeIn(target_found_text))
        self.play(Indicate(array_rects[mid_index], color=secondary_color))
        self.wait(10)
        self.play(FadeOut(target_found_text, array_group))

        # Scene 7: Binary Search vs. Linear Search (15.0s)
        binary_search_text = Text("Binary Search: Quickly narrows search space", font_size=30, color=primary_color).to_edge(UP)
        linear_search_text = Text("Linear Search: Checks every element", font_size=30, color=accent_color).next_to(binary_search_text, DOWN, buff=0.5)
        self.play(FadeIn(binary_search_text, linear_search_text))

        for i in range(len(array_values)):
            self.play(ShowPassingFlash(array_rects[i].copy().set_color(RED), run_time=0.2), run_time=0.2)

        self.wait(10)
        self.play(FadeOut(binary_search_text, linear_search_text, array_group))