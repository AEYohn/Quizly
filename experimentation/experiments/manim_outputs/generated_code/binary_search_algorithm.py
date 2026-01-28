from manim import *

class BinarySearchVisualization(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        self.camera.background_color = background_color

        # Scene 1: Binary Search: A Visual Introduction (7.0s)
        title = Text("Binary Search: A Visual Introduction", font_size=48, color=primary_color)
        description1 = Text("Binary search is much faster than linear search for large lists.", font_size=24, color=WHITE).next_to(title, DOWN, buff=0.5)
        description2 = Text("Key idea: Dividing the search space in half.", font_size=24, color=WHITE).next_to(description1, DOWN, buff=0.3)
        self.play(Write(title))
        self.play(FadeIn(description1), FadeIn(description2))
        self.wait(7)
        self.play(FadeOut(title), FadeOut(description1), FadeOut(description2))

        # Scene 2: Sorted Array Visualization (15.0s)
        array_values = [2, 5, 7, 12, 18, 21, 28, 33, 45, 50]
        num_elements = len(array_values)
        boxes = VGroup()
        indices = VGroup()

        for i in range(num_elements):
            box = Rectangle(width=0.7, height=0.7, color=primary_color, fill_opacity=0.7)
            box.move_to(LEFT * (num_elements / 2 - 0.5) * 0.7 + RIGHT * i * 0.7)
            text = Text(str(array_values[i]), color=WHITE).move_to(box.get_center())
            index = Text(str(i), color=secondary_color, font_size=20).next_to(box, DOWN, buff=0.1)
            boxes.add(box)
            indices.add(index)
            self.play(Create(box), Write(text), run_time=0.5)
            self.play(Write(index), run_time=0.5)
        self.wait(15)
        self.boxes = boxes
        self.indices = indices

        # Scene 3: Setting Low, High, and Middle Indices (18.0s)
        low_index = 0
        high_index = num_elements - 1
        middle_index = (low_index + high_index) // 2

        low_arrow = Arrow(DOWN, UP, color=accent_color).scale(0.5).next_to(self.boxes[low_index], DOWN)
        low_label = Text("Low", color=accent_color, font_size=24).next_to(low_arrow, DOWN)
        high_arrow = Arrow(DOWN, UP, color=accent_color).scale(0.5).next_to(self.boxes[high_index], DOWN)
        high_label = Text("High", color=accent_color, font_size=24).next_to(high_arrow, DOWN)
        middle_arrow = Arrow(DOWN, UP, color=secondary_color).scale(0.5).next_to(self.boxes[middle_index], DOWN)
        middle_label = Text("Middle", color=secondary_color, font_size=24).next_to(middle_arrow, DOWN)

        self.play(Create(low_arrow), Write(low_label))
        self.play(Create(high_arrow), Write(high_label))
        self.play(Create(middle_arrow), Write(middle_label))
        self.wait(18)

        self.low_arrow = low_arrow
        self.low_label = low_label
        self.high_arrow = high_arrow
        self.high_label = high_label
        self.middle_arrow = middle_arrow
        self.middle_label = middle_label

        # Scene 4: Comparison with Target Value (15.0s)
        target_value = 28
        target_text = Text(f"Target = {target_value}", color=primary_color, font_size=36).to_edge(UP)
        self.play(Write(target_text))

        comparison_line = Line(LEFT * 2, RIGHT * 2, color=WHITE).next_to(self.boxes, UP, buff=1)
        target_mark = Dot(point=LEFT * 2 + (target_value/50)*4 * RIGHT, color=primary_color).move_to(comparison_line.get_center() + LEFT * 2 + (target_value/50)*4 * RIGHT)
        middle_mark = Dot(point=LEFT * 2 + (array_values[middle_index]/50)*4 * RIGHT, color=secondary_color).move_to(comparison_line.get_center() + LEFT * 2 + (array_values[middle_index]/50)*4 * RIGHT)

        target_mark_label = MathTex(str(target_value), color=primary_color).next_to(target_mark, UP)
        middle_mark_label = MathTex(str(array_values[middle_index]), color=secondary_color).next_to(middle_mark, UP)

        self.play(Create(comparison_line))
        self.play(Create(target_mark), Write(target_mark_label))
        self.play(Create(middle_mark), Write(middle_mark_label))
        self.wait(15)

        self.target_text = target_text
        self.comparison_line = comparison_line
        self.target_mark = target_mark
        self.middle_mark = middle_mark
        self.target_mark_label = target_mark_label
        self.middle_mark_label = middle_mark_label

        # Scene 5: Adjusting the Search Range (Target Higher) (15.0s)
        if target_value > array_values[middle_index]:
            new_low_index = middle_index + 1
            self.play(Transform(self.low_arrow, Arrow(DOWN, UP, color=accent_color).scale(0.5).next_to(self.boxes[new_low_index], DOWN)))
            self.play(Transform(self.low_label, Text("Low", color=accent_color, font_size=24).next_to(self.low_arrow, DOWN)))

            highlight_rect = Rectangle(width=(high_index - new_low_index + 1) * 0.7, height=0.8, color=GREEN, fill_opacity=0.2)
            highlight_rect.move_to(self.boxes[new_low_index].get_center()).shift(RIGHT * (high_index - new_low_index) * 0.7 / 2)
            self.play(Create(highlight_rect))
            self.wait(15)
            self.play(FadeOut(highlight_rect), FadeOut(self.middle_arrow), FadeOut(self.middle_label))

        # Scene 6: Adjusting the Search Range (Target Lower) (15.0s)
        else:
            new_high_index = middle_index - 1
            self.play(Transform(self.high_arrow, Arrow(DOWN, UP, color=accent_color).scale(0.5).next_to(self.boxes[new_high_index], DOWN)))
            self.play(Transform(self.high_label, Text("High", color=accent_color, font_size=24).next_to(self.high_arrow, DOWN)))

            highlight_rect = Rectangle(width=(new_high_index - low_index + 1) * 0.7, height=0.8, color=GREEN, fill_opacity=0.2)
            highlight_rect.move_to(self.boxes[low_index].get_center()).shift(RIGHT * (new_high_index - low_index) * 0.7 / 2)
            self.play(Create(highlight_rect))
            self.wait(15)
            self.play(FadeOut(highlight_rect), FadeOut(self.middle_arrow), FadeOut(self.middle_label))

        # Scene 7: Summary and Conclusion (5.0s)
        summary_text = Text("Binary Search: Sorted data, divide and conquer!", color=primary_color, font_size=36).to_edge(UP)
        thank_you_text = Text("Thank you for watching!", color=secondary_color, font_size=36).to_edge(DOWN)

        self.play(FadeOut(self.boxes), FadeOut(self.indices), FadeOut(self.low_arrow), FadeOut(self.low_label), FadeOut(self.high_arrow), FadeOut(self.high_label), FadeOut(self.target_text), FadeOut(self.comparison_line), FadeOut(self.target_mark), FadeOut(self.middle_mark), FadeOut(self.target_mark_label), FadeOut(self.middle_mark_label))
        self.play(Write(summary_text))
        self.play(Write(thank_you_text))
        self.wait(5)
        self.play(FadeOut(summary_text), FadeOut(thank_you_text))