import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { MCQCard } from "@/components/feed/MCQCard";
import type { ScrollCard } from "@/types/learn";

// Mock useHaptics hook
jest.mock("@/hooks/useHaptics", () => ({
  useHaptics: () => ({ light: jest.fn(), medium: jest.fn() }),
}));

// Mock lucide-react-native icons used by MCQCard
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const makeIcon = (testID: string) => (props: any) =>
    React.createElement("Text", { testID, ...props });
  return {
    CheckCircle2: makeIcon("check-circle-icon"),
    XCircle: makeIcon("x-circle-icon"),
    HelpCircle: makeIcon("help-circle-icon"),
    Zap: makeIcon("zap-icon"),
  };
});

const mockCard: ScrollCard = {
  id: "test-id-1",
  content_item_id: "test-1",
  card_type: "mcq",
  concept: "Test Concept",
  prompt: "What is 2+2?",
  options: ["A) 3", "B) 4", "C) 5", "D) 6"],
  correct_answer: "B",
  explanation: "2+2=4",
  is_reintroduction: false,
  difficulty: 0.5,
  xp_value: 10,
};

const defaultProps = {
  card: mockCard,
  result: null,
  onAnswer: jest.fn(),
  onNext: jest.fn(),
  onHelp: jest.fn(),
};

describe("MCQCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pressing an option calls onAnswer with the correct letter", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option B (the text after stripping the letter prefix is "4")
    fireEvent.press(screen.getByText("4"));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("B");
  });

  it("pressing a different option calls onAnswer with that letter", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option A (text is "3")
    fireEvent.press(screen.getByText("3"));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("A");
  });

  it("selected option gets indigo highlight styling", () => {
    render(<MCQCard {...defaultProps} />);

    // Press option B
    fireEvent.press(screen.getByText("4"));

    // The Pressable wrapping option B should have indigo classes
    // Find the parent Pressable of the "4" text -- we check className on the pressable
    const optionB = screen.getByText("4").parent;
    // Walk up to the Pressable (parent chain: Text -> View -> Pressable)
    const pressable = optionB?.parent;

    expect(pressable?.props.className).toContain("bg-indigo-50");
    expect(pressable?.props.className).toContain("border-indigo-300");
  });

  it("after pressing, all options become disabled", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option A
    fireEvent.press(screen.getByText("3"));
    expect(onAnswer).toHaveBeenCalledTimes(1);

    // Try pressing option B -- should not fire onAnswer again
    fireEvent.press(screen.getByText("4"));
    expect(onAnswer).toHaveBeenCalledTimes(1);

    // Try pressing option C
    fireEvent.press(screen.getByText("5"));
    expect(onAnswer).toHaveBeenCalledTimes(1);

    // Try pressing option D
    fireEvent.press(screen.getByText("6"));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it("correct answer gets green styling when result arrives", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    // User selects B (correct)
    fireEvent.press(screen.getByText("4"));

    // Result arrives -- user was correct
    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: true, xpEarned: 10, streakBroken: false }}
      />
    );

    // Option B (correct answer) should have emerald/green styling
    const optionBText = screen.getByText("4");
    const pressable = optionBText.parent?.parent;

    expect(pressable?.props.className).toContain("bg-emerald-50");
    expect(pressable?.props.className).toContain("border-emerald-400");
  });

  it("wrong selected option gets red styling and shows XCircle when result arrives", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    // User selects A (wrong -- correct is B)
    fireEvent.press(screen.getByText("3"));

    // Result arrives -- user was wrong
    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: false, xpEarned: 0, streakBroken: true }}
      />
    );

    // Option A (wrong selected) should have red styling
    const optionAText = screen.getByText("3");
    const pressableA = optionAText.parent?.parent;

    expect(pressableA?.props.className).toContain("bg-red-50");
    expect(pressableA?.props.className).toContain("border-red-300");

    // XCircle icons rendered: one in the wrong option, one in the result banner
    expect(screen.getAllByTestId("x-circle-icon").length).toBeGreaterThanOrEqual(1);
  });

  it("double-pressing the same option only fires onAnswer once", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option B twice rapidly
    fireEvent.press(screen.getByText("4"));
    fireEvent.press(screen.getByText("4"));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("B");
  });
});
