from manim import *

class FourierTransformBasics(Scene):
    def construct(self):

        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene scene_1: Title: Unveiling the Frequency Spectrum (5.0s)
        title = Text("Unveiling the Frequency Spectrum", font_size=48)
        intro_text = Text("The Fourier Transform decomposes signals into constituent frequencies.", font_size=32)
        intro_text.next_to(title, DOWN, buff=0.5)

        self.play(Write(title))
        self.play(Write(intro_text))
        self.wait(5)
        self.play(FadeOut(title, intro_text))

        # Scene scene_2: Visualizing Euler's Formula (10.0s)
        equation = Text("e^(jθ) = cos(θ) + j sin(θ)", font_size=40)
        self.play(Write(equation))
        self.wait(2)

        circle = Circle(radius=2, color=BLUE)
        dot = Dot(color=RED)
        dot.move_to(circle.point_from_proportion(0))
        line = Line(ORIGIN, dot.get_center(), color=YELLOW)

        self.play(Create(circle))
        self.play(Create(dot))
        self.play(Create(line))

        self.play(
            MoveAlongPath(dot, circle),
            Rotate(line, angle=2*PI, about_point=ORIGIN),
            run_time=5,
            rate_func=linear
        )

        self.wait(3)
        self.play(FadeOut(circle, dot, line, equation))

        # Scene scene_3: Complex Exponential as a Rotating Vector (15.0s)
        number_line = NumberLine(x_range=[-5, 5, 1], length=8)
        self.play(Create(number_line))
        frequency_label = Text("f = 1 Hz", font_size=32)
        frequency_label.to_edge(UP)
        self.play(Write(frequency_label))

        vector = Arrow(start=ORIGIN, end=RIGHT * 3, color=GREEN)
        self.play(Create(vector))

        self.play(Rotate(vector, angle=2 * PI, about_point=ORIGIN), run_time=5, rate_func=linear)
        self.wait(2)

        frequency_label.become(Text("f = 2 Hz", font_size=32).to_edge(UP))
        self.play(Write(frequency_label))
        self.play(Rotate(vector, angle=4 * PI, about_point=ORIGIN), run_time=5, rate_func=linear)
        self.wait(3)

        self.play(FadeOut(vector, number_line, frequency_label))

        # Scene scene_4: Decomposition of a Simple Signal (20.0s)
        axes = Axes(x_range=[0, 5, 1], y_range=[-2, 2, 1])
        self.play(Create(axes))

        def signal_function(x):
            return np.sin(2 * PI * x) + 0.5 * np.sin(4 * PI * x)

        signal_graph = axes.plot(signal_function, color=BLUE)
        signal_label = Text("Signal (Time Domain)", font_size=32).to_edge(UP)

        self.play(Create(signal_graph), Write(signal_label))
        self.wait(2)

        sine1_graph = axes.plot(lambda x: np.sin(2 * PI * x), color=YELLOW)
        sine1_label = Text("Sine Wave 1", font_size=24).move_to(UP*2 + RIGHT * 3)

        sine2_graph = axes.plot(lambda x: 0.5 * np.sin(4 * PI * x), color=RED)
        sine2_label = Text("Sine Wave 2", font_size=24).move_to(UP*1 + RIGHT * 3)

        self.play(Create(sine1_graph), Write(sine1_label), Create(sine2_graph), Write(sine2_label), run_time=5)
        self.wait(8)

        self.play(FadeOut(signal_graph, sine1_graph, sine2_graph, signal_label, sine1_label, sine2_label, axes))

        # Scene scene_5: Time vs. Frequency Domain Representation (15.0s)
        axes_time = Axes(x_range=[0, 5, 1], y_range=[-2, 2, 1]).to_edge(LEFT)
        axes_freq = Axes(x_range=[0, 5, 1], y_range=[0, 2, 1]).to_edge(RIGHT)

        signal_graph = axes_time.plot(signal_function, color=BLUE)

        rect1 = Rectangle(width=0.5, height=1, color=YELLOW, fill_opacity=0.5).move_to(axes_freq.coords_to_point(1, 1))
        rect2 = Rectangle(width=0.5, height=0.5, color=RED, fill_opacity=0.5).move_to(axes_freq.coords_to_point(2, 0.5))

        time_label = Text("Time Domain", font_size=28).next_to(axes_time, UP)
        freq_label = Text("Frequency Domain", font_size=28).next_to(axes_freq, UP)

        self.play(Create(axes_time), Create(axes_freq), Write(time_label), Write(freq_label))
        self.play(Create(signal_graph))
        self.play(Create(rect1), Create(rect2))
        self.wait(3)

        arrow1 = Arrow(start=axes_time.coords_to_point(1, np.sin(2 * PI * 1) + 0.5 * np.sin(4 * PI * 1)), end=axes_freq.coords_to_point(1,1), color=YELLOW)
        arrow2 = Arrow(start=axes_time.coords_to_point(2, np.sin(2 * PI * 2) + 0.5 * np.sin(4 * PI * 2)), end=axes_freq.coords_to_point(2,0.5), color=RED)

        self.play(Create(arrow1), Create(arrow2))

        self.wait(5)
        self.play(FadeOut(axes_time, axes_freq, signal_graph, rect1, rect2, time_label, freq_label, arrow1, arrow2))

        # Scene scene_6: The Fourier Transform Equation (15.0s)
        fourier_transform_eq = Text("X(f) = ∫ x(t) e^(-j2πft) dt", font_size=40)
        fourier_transform_eq.move_to(UP)
        explanation = Text("Integral determines frequency components.", font_size=32)
        explanation.next_to(fourier_transform_eq, DOWN)

        self.play(Write(fourier_transform_eq))
        self.play(Write(explanation))
        self.wait(15)
        self.play(FadeOut(fourier_transform_eq, explanation))

        # Scene scene_7: Spectrogram example (10.0s)
        spectrogram = ImageMobject("spectrogram.png") # Requires a "spectrogram.png" file in the same directory
        spectrogram.scale(0.7)

        spectrogram_text = Text("Spectrogram of a Chirp", font_size=32).to_edge(UP)
        spectrogram_explanation = Text("Frequency increases with time.", font_size=24).next_to(spectrogram_text, DOWN)

        self.play(FadeIn(spectrogram))
        self.play(Write(spectrogram_text), Write(spectrogram_explanation))
        self.wait(10)
        self.play(FadeOut(spectrogram, spectrogram_text, spectrogram_explanation))

        self.wait(2)