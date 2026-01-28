from manim import *

class CircleAreaDerivation(Scene):
    def construct(self):
        primary_color = "#3b82f6"
        secondary_color = "#10b981"
        accent_color = "#f59e0b"
        background_color = "#1e1e1e"

        # Scene 1: Introduction to Circles (8.0s)
        circle = Circle(radius=2, color=primary_color, fill_opacity=0.5)
        center_dot = Dot(ORIGIN, color=accent_color)
        radius_line = Line(ORIGIN, RIGHT * 2, color=secondary_color)
        r_label = MathTex("r", color=secondary_color).next_to(radius_line, UP, buff=0.1)
        circumference_formula = MathTex("C = 2 \\pi r", color=WHITE).to_edge(UP)
        area_text = Text("Area = ?", color=WHITE).next_to(circle, DOWN, buff=0.5)

        self.play(Create(circle))
        self.play(Create(center_dot))
        self.play(Create(radius_line), Write(r_label))
        self.play(Write(circumference_formula))
        self.play(Write(area_text))
        self.wait(8)
        self.play(FadeOut(area_text),FadeOut(circumference_formula))

        # Scene 2: Inscribed Polygons (15.0s)
        square = Polygon(*[circle.point_from_proportion(k) for k in np.linspace(0, 1, 5)[:-1]], color=primary_color, fill_opacity=0.3)
        pentagon = Polygon(*[circle.point_from_proportion(k) for k in np.linspace(0, 1, 6)[:-1]], color=primary_color, fill_opacity=0.3)
        hexagon = Polygon(*[circle.point_from_proportion(k) for k in np.linspace(0, 1, 7)[:-1]], color=primary_color, fill_opacity=0.3)
        n_gon_text = Text("More sides -> More like circle", color=WHITE).to_edge(UP)

        self.play(Transform(circle,square))
        self.wait(2)
        self.play(Transform(circle,pentagon))
        self.wait(2)
        self.play(Transform(circle,hexagon))
        self.wait(2)
        self.play(Write(n_gon_text))

        n = 7
        last_poly = hexagon
        for i in range(3):
            n += 5
            new_polygon = Polygon(*[circle.point_from_proportion(k) for k in np.linspace(0, 1, n+1)[:-1]], color=primary_color, fill_opacity=0.3)
            self.play(Transform(circle, new_polygon))
            last_poly = new_polygon
            self.wait(1)

        self.play(FadeOut(n_gon_text))

        self.play(Transform(circle, Circle(radius=2, color=primary_color, fill_opacity=0.5)))
        self.wait(4)

        # Scene 3: Cutting the Circle (15.0s)
        num_sectors = 12
        sectors = VGroup(*[
            Sector(
                arc_center=ORIGIN,
                inner_radius=0,
                outer_radius=2,
                angle=TAU / num_sectors,
                start_angle=i * TAU / num_sectors,
                color=primary_color,
                fill_opacity=0.7
            )
            for i in range(num_sectors)
        ])

        self.play(Transform(circle,sectors))
        self.wait(1)
        self.play(Indicate(sectors[0]))
        self.wait(14)

        # Scene 4: Rearranging into Parallelogram (20.0s)
        rearranged_sectors = VGroup()
        for i in range(num_sectors):
            sector = sectors[i].copy()
            if i % 2 == 0:
                sector.move_to(RIGHT * (i // 2) * 0.75 + DOWN * 1)
            else:
                sector.rotate(PI, about_point=sectors[i].get_center())
                sector.move_to(RIGHT * (i // 2) * 0.75 + UP * 1)
            rearranged_sectors.add(sector)

        self.play(Transform(sectors, rearranged_sectors))
        self.wait(20)

        # Scene 5: Parallelogram Dimensions (15.0s)
        parallelogram = Rectangle(width=0.75 * num_sectors / 2, height=2, color=secondary_color, fill_opacity=0)

        base_line = Line(rearranged_sectors.get_left(), rearranged_sectors.get_right(), color=accent_color)
        height_line = Line(rearranged_sectors[0].get_center(), rearranged_sectors[0].get_center() + DOWN * 2, color=accent_color)

        base_label = MathTex("\\pi r", color=WHITE).next_to(base_line, DOWN, buff=0.1)
        height_label = MathTex("r", color=WHITE).next_to(height_line, LEFT, buff=0.1)

        self.play(Create(parallelogram))
        self.play(Create(base_line), Write(base_label))
        self.play(Create(height_line), Write(height_label))
        self.wait(15)

        # Scene 6: Area Formula Derivation (12.0s)
        area_parallelogram = MathTex("A = \\text{base} \\times \\text{height}", color=WHITE).to_edge(UP)
        area_equation1 = MathTex("A = \\pi r \\times r", color=WHITE).next_to(area_parallelogram, DOWN, buff=0.5)
        area_equation2 = MathTex("A = \\pi r^2", color=WHITE).next_to(area_equation1, DOWN, buff=0.5)

        self.play(Write(area_parallelogram))
        self.wait(2)
        self.play(Write(area_equation1))
        self.wait(5)
        self.play(Transform(area_equation1, area_equation2))
        self.wait(5)

        # Scene 7: Conclusion and Recap (5.0s)
        final_formula = MathTex("A = \\pi r^2", color=secondary_color).move_to(ORIGIN)
        self.play(Transform(VGroup(area_parallelogram,area_equation1, base_line, base_label, height_line, height_label, parallelogram, sectors), final_formula))

        self.wait(5)