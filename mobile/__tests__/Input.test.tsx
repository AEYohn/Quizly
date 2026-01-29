import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
  });

  it("renders with label", () => {
    render(<Input label="Username" placeholder="Enter username" />);
    expect(screen.getByText("Username")).toBeTruthy();
  });

  it("displays error message", () => {
    render(
      <Input
        placeholder="Email"
        error="Invalid email address"
      />
    );
    expect(screen.getByText("Invalid email address")).toBeTruthy();
  });

  it("displays hint when no error", () => {
    render(
      <Input
        placeholder="Password"
        hint="At least 8 characters"
      />
    );
    expect(screen.getByText("At least 8 characters")).toBeTruthy();
  });

  it("hides hint when error is present", () => {
    render(
      <Input
        placeholder="Password"
        hint="At least 8 characters"
        error="Password too short"
      />
    );
    expect(screen.queryByText("At least 8 characters")).toBeNull();
    expect(screen.getByText("Password too short")).toBeTruthy();
  });

  it("handles text input", () => {
    const onChangeText = jest.fn();
    render(
      <Input
        placeholder="Type here"
        onChangeText={onChangeText}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText("Type here"), "Hello");
    expect(onChangeText).toHaveBeenCalledWith("Hello");
  });

  it("handles focus and blur events", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(
      <Input
        placeholder="Focus test"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );

    const input = screen.getByPlaceholderText("Focus test");
    fireEvent(input, "focus");
    expect(onFocus).toHaveBeenCalled();

    fireEvent(input, "blur");
    expect(onBlur).toHaveBeenCalled();
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<Input size="sm" placeholder="Small" />);
    expect(screen.getByPlaceholderText("Small")).toBeTruthy();

    rerender(<Input size="md" placeholder="Medium" />);
    expect(screen.getByPlaceholderText("Medium")).toBeTruthy();

    rerender(<Input size="lg" placeholder="Large" />);
    expect(screen.getByPlaceholderText("Large")).toBeTruthy();
  });
});
