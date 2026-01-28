from manim import *

class BinarySearchVisualization(Scene):
    def construct(self):

        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene 1: Binary Search Introduction (8.0s)
        title = Text("Binary Search Algorithm", font_size=48)
        self.play(Write(title))
        self.wait(1)

        intro_text = Text("Binary search is a highly efficient algorithm for finding a specific value within a sorted dataset.\nUnlike linear search, which checks every element, binary search uses a divide-and-conquer strategy to quickly narrow down the search range.", font_size=24)
        intro_text.to_edge(DOWN)
        self.play(FadeIn(intro_text))
        self.wait(7)
        self.play(FadeOut(title, intro_text))

        # Scene 2: Sorted Data Requirement (10.0s)
        sorted_text = Text("Binary search requires the data to be sorted.", font_size=36)
        self.play(Write(sorted_text))
        self.wait(1)
        self.play(sorted_text.animate.to_edge(UP))

        values = [2, 5, 7, 8, 11, 12]
        boxes = VGroup()
        texts = VGroup()
        for i, val in enumerate(values):
            box = Rectangle(width=1, height=1, color=primary_color, fill_opacity=0.3)
            box.move_to(LEFT * 3 + RIGHT * i * 1.2)
            text = Text(str(val), font_size=28).move_to(box.get_center())
            boxes.add(box)
            texts.add(text)

        array_group = VGroup(boxes, texts)
        self.play(Create(boxes), Write(texts))
        self.wait(1)
        self.play(Indicate(array_group))
        self.wait(6)

        self.play(FadeOut(sorted_text))

        # Scene 3: Visualizing the Array and Pointers (15.0s)
        left_pointer_text = Text("Left", font_size=24, color=secondary_color)
        left_pointer_text.next_to(boxes[0], DOWN)
        left_arrow = Arrow(boxes[0].get_edge(UP), boxes[0].get_edge(DOWN), color=secondary_color)
        left_group = VGroup(left_pointer_text, left_arrow)

        right_pointer_text = Text("Right", font_size=24, color=secondary_color)
        right_pointer_text.next_to(boxes[-1], DOWN)
        right_arrow = Arrow(boxes[-1].get_edge(UP), boxes[-1].get_edge(DOWN), color=secondary_color)
        right_group = VGroup(right_pointer_text, right_arrow)

        self.play(Create(left_arrow), Write(left_pointer_text))
        self.play(Create(right_arrow), Write(right_pointer_text))
        self.wait(2)

        middle_index = 2
        middle_pointer_text = Text("Middle", font_size=24, color=accent_color)
        middle_pointer_text.next_to(boxes[middle_index], UP)
        middle_arrow = Arrow(boxes[middle_index].get_edge(DOWN), boxes[middle_index].get_edge(UP), color=accent_color)
        middle_group = VGroup(middle_pointer_text, middle_arrow)

        self.play(Create(middle_arrow), Write(middle_pointer_text))

        self.wait(10)

        # Scene 4: Finding the Middle Element (15.0s)
        self.play(Indicate(middle_group))
        self.wait(2)
        self.play(Circumscribe(boxes[middle_index], color=YELLOW, time_width=2))
        self.wait(12)

        # Scene 5: Comparison and Adjustment (20.0s)
        target_value = 8
        target_text = Text(f"Target = {target_value}", font_size=36)
        target_text.to_edge(UP)
        self.play(Write(target_text))

        comparison_text = Text(f"Is {values[middle_index]} == {target_value}?", font_size=28)
        comparison_text.next_to(array_group, DOWN, buff=1)
        self.play(Write(comparison_text))
        self.wait(2)

        self.play(FadeOut(comparison_text))

        # Move right pointer since target is greater than the middle
        self.play(
            Transform(right_group, VGroup(Text("Right", font_size=24, color=secondary_color).next_to(boxes[1], DOWN),
                                          Arrow(boxes[1].get_edge(UP), boxes[1].get_edge(DOWN), color=secondary_color)))
        )

        self.wait(15)

        # Scene 6: Iterative Process (12.0s)

        new_middle_index = 1

        self.play(
            Transform(middle_group, VGroup(Text("Middle", font_size=24, color=accent_color).next_to(boxes[new_middle_index], UP),
                                          Arrow(boxes[new_middle_index].get_edge(DOWN), boxes[new_middle_index].get_edge(UP), color=accent_color)))
        )

        self.wait(5)
        self.play(Circumscribe(boxes[new_middle_index], color=YELLOW, time_width=2))

        self.wait(7)

        # Scene 7: Successful and Unsuccessful Scenarios (10.0s)
        success_text = Text("Target Found!", font_size=36, color=secondary_color)
        success_text.move_to(ORIGIN)
        self.play(FadeIn(success_text))
        self.play(Flash(boxes[new_middle_index]))
        self.wait(5)
        self.play(FadeOut(success_text, array_group, left_group, right_group, middle_group, target_text))

        failure_text = Text("Target Not Found", font_size=36, color=RED)
        failure_text.move_to(ORIGIN)
        self.play(Write(failure_text))
        self.wait(5)