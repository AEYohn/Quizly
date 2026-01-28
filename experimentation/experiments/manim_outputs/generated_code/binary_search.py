from manim import *

class BinarySearchVisualization(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"

        # Scene 1: Introduction (4s)
        title = Text("Binary Search", font_size=60, color=primary_color)
        subtitle = Text("An efficient search algorithm", font_size=30, color=WHITE).next_to(title, DOWN)
        self.play(Write(title), FadeIn(subtitle))
        self.wait(1)
        self.play(FadeOut(title, subtitle))

        # Scene 2: Show sorted array
        array_values = [2, 5, 7, 8, 11, 12]
        boxes = VGroup()
        texts = VGroup()
        for i, value in enumerate(array_values):
            box = Rectangle(width=1, height=1, color=primary_color, fill_opacity=0.3)
            box.move_to(LEFT * 2.5 + RIGHT * i * 1.2)
            text = Text(str(value), font_size=28, color=WHITE).move_to(box.get_center())
            boxes.add(box)
            texts.add(text)

        sorted_label = Text("Sorted Array", color=secondary_color, font_size=24).to_edge(UP)
        self.play(Create(boxes), Write(texts), Write(sorted_label))
        self.wait(1)

        # Scene 3: Show target
        target_value = 11
        target_label = Text(f"Find: {target_value}", color=accent_color, font_size=28).next_to(sorted_label, DOWN)
        self.play(Write(target_label))
        self.wait(0.5)

        # Scene 4: Show left and right pointers
        left_ptr = Arrow(start=UP * 0.8, end=DOWN * 0.2, color=secondary_color, buff=0).next_to(boxes[0], UP)
        right_ptr = Arrow(start=UP * 0.8, end=DOWN * 0.2, color=accent_color, buff=0).next_to(boxes[-1], UP)
        left_label = Text("L", font_size=20, color=secondary_color).next_to(left_ptr, UP, buff=0.1)
        right_label = Text("R", font_size=20, color=accent_color).next_to(right_ptr, UP, buff=0.1)

        self.play(GrowArrow(left_ptr), GrowArrow(right_ptr), Write(left_label), Write(right_label))
        self.wait(0.5)

        # Scene 5: First iteration - find mid
        mid_formula = Text("mid = (0 + 5) / 2 = 2", font_size=28).to_edge(DOWN)
        self.play(Write(mid_formula))

        mid_idx = 2  # (0 + 5) // 2 = 2
        mid_highlight = SurroundingRectangle(boxes[mid_idx], color=YELLOW, buff=0.1)
        self.play(Create(mid_highlight))
        self.wait(0.5)

        # Compare: 7 < 11, move left pointer
        compare_text = Text("7 < 11, search right half", font_size=24, color=WHITE).next_to(mid_formula, UP)
        self.play(Write(compare_text))
        self.wait(0.5)

        # Move left pointer to mid + 1
        new_left_idx = 3
        self.play(
            left_ptr.animate.next_to(boxes[new_left_idx], UP),
            left_label.animate.next_to(boxes[new_left_idx], UP).shift(UP * 0.9),
            FadeOut(mid_highlight),
            FadeOut(compare_text),
            FadeOut(mid_formula)
        )
        left_label.next_to(left_ptr, UP, buff=0.1)
        self.wait(0.5)

        # Scene 6: Second iteration
        mid_formula2 = Text("mid = (3 + 5) / 2 = 4", font_size=28).to_edge(DOWN)
        self.play(Write(mid_formula2))

        mid_idx = 4  # (3 + 5) // 2 = 4
        mid_highlight2 = SurroundingRectangle(boxes[mid_idx], color=YELLOW, buff=0.1)
        self.play(Create(mid_highlight2))
        self.wait(0.5)

        # Found it!
        found_text = Text("11 == 11, Found!", font_size=28, color=secondary_color).next_to(mid_formula2, UP)
        self.play(
            Write(found_text),
            boxes[mid_idx].animate.set_fill(secondary_color, opacity=0.8)
        )
        self.wait(1)

        # Scene 7: Conclusion
        self.play(
            FadeOut(left_ptr, right_ptr, left_label, right_label),
            FadeOut(mid_highlight2, mid_formula2, found_text),
            FadeOut(sorted_label, target_label)
        )

        conclusion = Text("Binary Search: O(log n)", font_size=40, color=primary_color).to_edge(UP)
        comparison = VGroup(
            Text("Linear Search: O(n)", font_size=28, color=GRAY),
            Text("Binary Search: O(log n)", font_size=28, color=secondary_color)
        ).arrange(DOWN).next_to(boxes, DOWN, buff=1)

        self.play(Write(conclusion), Write(comparison))
        self.wait(2)
        self.play(FadeOut(*self.mobjects))
