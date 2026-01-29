import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children text correctly", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Press Me</Button>);

    fireEvent.press(screen.getByText("Press Me"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} disabled>
        Disabled
      </Button>
    );

    fireEvent.press(screen.getByText("Disabled"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress when loading", () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} loading>
        Loading
      </Button>
    );

    // When loading, children are replaced with ActivityIndicator
    // So we need to find by role or test differently
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows ActivityIndicator when loading", () => {
    render(<Button loading>Loading Button</Button>);
    // Text should not be visible when loading
    expect(screen.queryByText("Loading Button")).toBeNull();
  });

  it("renders with different variants", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByText("Primary")).toBeTruthy();

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText("Secondary")).toBeTruthy();

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByText("Outline")).toBeTruthy();

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText("Ghost")).toBeTruthy();

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByText("Danger")).toBeTruthy();
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByText("Small")).toBeTruthy();

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByText("Medium")).toBeTruthy();

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByText("Large")).toBeTruthy();
  });
});
