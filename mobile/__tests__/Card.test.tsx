import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Card, PressableCard } from "@/components/ui/Card";

describe("Card", () => {
  it("renders children correctly", () => {
    render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    expect(screen.getByText("Card Content")).toBeTruthy();
  });

  it("renders with default variant", () => {
    render(
      <Card>
        <Text>Default Card</Text>
      </Card>
    );
    expect(screen.getByText("Default Card")).toBeTruthy();
  });

  it("renders with elevated variant", () => {
    render(
      <Card variant="elevated">
        <Text>Elevated Card</Text>
      </Card>
    );
    expect(screen.getByText("Elevated Card")).toBeTruthy();
  });

  it("renders with outline variant", () => {
    render(
      <Card variant="outline">
        <Text>Outline Card</Text>
      </Card>
    );
    expect(screen.getByText("Outline Card")).toBeTruthy();
  });

  it("renders with different padding sizes", () => {
    const { rerender } = render(
      <Card padding="none">
        <Text>No Padding</Text>
      </Card>
    );
    expect(screen.getByText("No Padding")).toBeTruthy();

    rerender(
      <Card padding="sm">
        <Text>Small Padding</Text>
      </Card>
    );
    expect(screen.getByText("Small Padding")).toBeTruthy();

    rerender(
      <Card padding="lg">
        <Text>Large Padding</Text>
      </Card>
    );
    expect(screen.getByText("Large Padding")).toBeTruthy();
  });
});

describe("PressableCard", () => {
  it("renders children correctly", () => {
    render(
      <PressableCard>
        <Text>Pressable Content</Text>
      </PressableCard>
    );
    expect(screen.getByText("Pressable Content")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(
      <PressableCard onPress={onPress}>
        <Text>Press Me</Text>
      </PressableCard>
    );

    fireEvent.press(screen.getByText("Press Me"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(
      <PressableCard onPress={onPress} disabled>
        <Text>Disabled Card</Text>
      </PressableCard>
    );

    fireEvent.press(screen.getByText("Disabled Card"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
