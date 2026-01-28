from manim import *

class BinarySearchAlgorithm(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene 1: Binary Search: Divide and Conquer (7.0s)
        title = Text("Binary Search: Divide and Conquer", font_size=48, color=primary_color)
        description = Text("A highly efficient algorithm for finding a specific element in a sorted array. It uses a divide and conquer strategy, repeatedly dividing the search interval in half.", font_size=24)
        description.next_to(title, DOWN, buff=0.5)
        self.play(Write(title))
        self.play(FadeIn(description))
        self.wait(7)
        self.play(FadeOut(title, description))

        # Scene 2: Sorted Data Requirement (8.0s)
        sorted_requirement = Text("Sorted Data Requirement", font_size=48, color=primary_color)
        self.play(Write(sorted_requirement))
        self.wait(1)

        unsorted_data = [5, 2, 8, 1, 9, 4]
        unsorted_nl = NumberLine(x_range=[0, len(unsorted_data)-1, 1], length=6)
        unsorted_texts = VGroup(*[Text(str(val), font_size=24).move_to(unsorted_nl.n2p(i) + DOWN*0.7) for i, val in enumerate(unsorted_data)])
        unsorted_group = VGroup(unsorted_nl, unsorted_texts).scale(0.7).move_to(DOWN * 1.5)

        self.play(Create(unsorted_nl), Write(unsorted_texts))
        self.wait(1)

        sorted_data = sorted(unsorted_data)
        sorted_texts = VGroup(*[Text(str(val), font_size=24).move_to(unsorted_nl.n2p(i) + DOWN*0.7) for i, val in enumerate(sorted_data)])
        sorted_group = VGroup(unsorted_nl, sorted_texts).scale(0.7).move_to(DOWN * 1.5)

        self.play(Transform(unsorted_texts, sorted_texts))
        self.wait(3)
        self.play(FadeOut(sorted_requirement, sorted_group))

        # Scene 3: Visualizing the Search Space (15.0s)
        visualize_title = Text("Visualizing the Search Space", font_size=48, color=primary_color)
        self.play(Write(visualize_title))
        self.wait(1)

        sorted_array = [2, 5, 7, 8, 11, 12]
        nl = NumberLine(x_range=[0, len(sorted_array)-1, 1], length=6)
        texts = VGroup(*[Text(str(val), font_size=24).move_to(nl.n2p(i) + DOWN*0.7) for i, val in enumerate(sorted_array)])
        array_group = VGroup(nl, texts).scale(0.7)
        self.play(Create(nl), Write(texts))

        low_pointer = Arrow(start=DOWN, end=nl.n2p(0), color=secondary_color)
        low_label = Text("low", font_size=24, color=secondary_color).next_to(low_pointer, LEFT)
        high_pointer = Arrow(start=DOWN, end=nl.n2p(len(sorted_array)-1), color=secondary_color)
        high_label = Text("high", font_size=24, color=secondary_color).next_to(high_pointer, RIGHT)

        self.play(Create(low_pointer), Write(low_label), Create(high_pointer), Write(high_label))
        self.wait(1)

        middle_index = (0 + len(sorted_array) - 1) // 2
        middle_pointer = Arrow(start=UP, end=nl.n2p(middle_index), color=accent_color)
        middle_label = Text("middle", font_size=24, color=accent_color).next_to(middle_pointer, UP)

        self.play(Create(middle_pointer), Write(middle_label))
        self.play(Indicate(texts[middle_index]))
        self.wait(6)

        # Scene 4: Comparison and Adjustment (20.0s)
        comparison_title = Text("Comparison and Adjustment", font_size=48, color=primary_color)
        comparison_title.to_edge(UP)
        self.play(Transform(visualize_title, comparison_title))

        target_value = 8
        target_text = Text(f"Target: {target_value}", font_size=24, color=WHITE).to_corner(UR)
        self.play(Write(target_text))

        if sorted_array[middle_index] == target_value:
            self.play(Indicate(texts[middle_index], color=secondary_color))
        elif sorted_array[middle_index] > target_value:
            self.play(Indicate(texts[middle_index], color=RED))
            self.play(Transform(high_pointer, Arrow(start=DOWN, end=nl.n2p(middle_index-1), color=secondary_color)))
            self.play(high_label.animate.next_to(high_pointer, RIGHT))
        else:
            self.play(Indicate(texts[middle_index], color=RED))
            self.play(Transform(low_pointer, Arrow(start=DOWN, end=nl.n2p(middle_index+1), color=secondary_color)))
            self.play(low_label.animate.next_to(low_pointer, LEFT))

        self.wait(10)

        # Scene 5: Iterative Narrowing (15.0s)
        iterative_title = Text("Iterative Narrowing", font_size=48, color=primary_color)
        iterative_title.to_edge(UP)
        self.play(Transform(comparison_title, iterative_title))

        # Adjusting low to middle + 1
        self.play(FadeOut(middle_pointer, middle_label))

        new_low = middle_index + 1
        new_middle = (new_low + len(sorted_array) -1) // 2

        self.play(Transform(low_pointer, Arrow(start=DOWN, end=nl.n2p(new_low), color=secondary_color)))
        self.play(low_label.animate.next_to(low_pointer, LEFT))
        middle_pointer = Arrow(start=UP, end=nl.n2p(new_middle), color=accent_color)
        middle_label = Text("middle", font_size=24, color=accent_color).next_to(middle_pointer, UP)
        self.play(Create(middle_pointer), Write(middle_label))
        self.play(Indicate(texts[new_middle]))

        self.wait(7)

        self.play(FadeOut(middle_pointer, middle_label))
        self.play(Indicate(texts[3], color=secondary_color))
        self.wait(4)

        # Scene 6: Logarithmic Time Complexity (15.0s)
        complexity_title = Text("Logarithmic Time Complexity", font_size=48, color=primary_color)
        complexity_title.to_edge(UP)
        self.play(Transform(iterative_title, complexity_title))
        self.play(FadeOut(low_pointer, low_label, high_pointer, high_label, array_group, target_text))

        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 10, 1],
            axis_config={"include_numbers": True}
        ).scale(0.5)
        axes.move_to(DOWN*1.5)

        linear_graph = axes.plot(lambda x: x, color=RED)
        log_graph = axes.plot(lambda x: np.log(x+1), color=GREEN)

        linear_label = Text("Linear Search (O(n))", font_size=20, color=RED).next_to(linear_graph, UP)
        log_label = Text("Binary Search (O(log n))", font_size=20, color=GREEN).next_to(log_graph, DOWN)

        equation = Text("T(n) = T(n/2) + O(1)", font_size=24, color=WHITE).to_corner(UR)

        self.play(Create(axes))
        self.play(Create(linear_graph), Write(linear_label))
        self.play(Create(log_graph), Write(log_label))
        self.play(Write(equation))
        self.wait(15)

        # Scene 7: Summary (10.0s)
        summary_title = Text("Summary", font_size=48, color=primary_color)
        summary_title.to_edge(UP)
        self.play(Transform(complexity_title, summary_title))
        self.play(FadeOut(axes, linear_graph, log_graph, linear_label, log_label, equation))

        summary_text = VGroup(
            Text("Divide and Conquer", font_size=30, color=WHITE),
            Text("Sorted Data", font_size=30, color=WHITE),
            Text("Logarithmic Time Complexity", font_size=30, color=WHITE)
        ).arrange(DOWN, aligned_edge=LEFT)

        self.play(Write(summary_text))
        self.wait(10)