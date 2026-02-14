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
    AlertTriangle: makeIcon("alert-triangle-icon"),
    Target: makeIcon("target-icon"),
    TrendingUp: makeIcon("trending-up-icon"),
    TrendingDown: makeIcon("trending-down-icon"),
    Minus: makeIcon("minus-icon"),
    Flame: makeIcon("flame-icon"),
    ArrowRight: makeIcon("arrow-right-icon"),
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
  analytics: null,
  onAnswer: jest.fn(),
  onNext: jest.fn(),
  onHelp: jest.fn(),
};

describe("MCQCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pressing an option selects it but does NOT call onAnswer yet", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option B (the text after stripping the letter prefix is "4")
    fireEvent.press(screen.getByText("4"));

    // onAnswer should NOT be called until Check Answer is pressed
    expect(onAnswer).not.toHaveBeenCalled();

    // Confidence selector and Check Answer button should appear
    expect(screen.getByText("How confident are you?")).toBeTruthy();
    expect(screen.getByText("Check Answer")).toBeTruthy();
  });

  it("pressing Check Answer calls onAnswer with letter and confidence", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option B
    fireEvent.press(screen.getByText("4"));

    // Default confidence is 50 ("Not sure")
    fireEvent.press(screen.getByText("Check Answer"));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("B", 50);
  });

  it("changing confidence level before submitting sends the right value", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option A
    fireEvent.press(screen.getByText("3"));

    // Change confidence to "Certain" (100)
    fireEvent.press(screen.getByText("Certain"));

    fireEvent.press(screen.getByText("Check Answer"));

    expect(onAnswer).toHaveBeenCalledWith("A", 100);
  });

  it("user can change selection before submitting", () => {
    const onAnswer = jest.fn();
    render(<MCQCard {...defaultProps} onAnswer={onAnswer} />);

    // Press option A first
    fireEvent.press(screen.getByText("3"));
    expect(onAnswer).not.toHaveBeenCalled();

    // Change to option B
    fireEvent.press(screen.getByText("4"));
    expect(onAnswer).not.toHaveBeenCalled();

    // Submit
    fireEvent.press(screen.getByText("Check Answer"));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("B", 50);
  });

  it("shows correct/incorrect banner when result arrives", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    fireEvent.press(screen.getByText("4"));

    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: true, xpEarned: 10, streakBroken: false }}
      />
    );

    expect(screen.getByText("Correct!")).toBeTruthy();
    expect(screen.getAllByTestId("check-circle-icon").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Not quite and XCircle on wrong answer", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    fireEvent.press(screen.getByText("3"));

    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: false, xpEarned: 0, streakBroken: false }}
      />
    );

    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getAllByTestId("x-circle-icon").length).toBeGreaterThanOrEqual(1);
  });

  it("shows streak broken message when result.streakBroken is true", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    fireEvent.press(screen.getByText("3"));

    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: false, xpEarned: 0, streakBroken: true }}
      />
    );

    expect(screen.getByText(/Streak lost/)).toBeTruthy();
    expect(screen.getByTestId("flame-icon")).toBeTruthy();
  });

  it("shows analytics feedback when analytics prop is provided", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    fireEvent.press(screen.getByText("4"));

    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: true, xpEarned: 10, streakBroken: false }}
        analytics={{
          concept: "Algebra",
          concept_accuracy: 75,
          concept_attempts: 4,
          improvement_areas: [],
          strengths: [],
          difficulty_trend: "harder",
        }}
      />
    );

    expect(screen.getByText("Algebra: 75%")).toBeTruthy();
    expect(screen.getByText("Getting harder")).toBeTruthy();
    expect(screen.getByTestId("target-icon")).toBeTruthy();
    expect(screen.getByTestId("trending-up-icon")).toBeTruthy();
  });

  it("shows calibration nudge on incorrect answer with nudge data", () => {
    const { rerender } = render(<MCQCard {...defaultProps} />);

    fireEvent.press(screen.getByText("3"));

    rerender(
      <MCQCard
        {...defaultProps}
        result={{ isCorrect: false, xpEarned: 0, streakBroken: false }}
        analytics={{
          concept: "Algebra",
          concept_accuracy: 40,
          concept_attempts: 5,
          improvement_areas: [],
          strengths: [],
          difficulty_trend: "stable",
          calibration_nudge: {
            type: "overconfident",
            message: "You seem confident but accuracy is low",
            confidence_avg: 90,
            accuracy: 40,
            gap: 50,
          },
        }}
      />
    );

    expect(screen.getByText("Calibration Check")).toBeTruthy();
    expect(screen.getByText("You seem confident but accuracy is low")).toBeTruthy();
    expect(screen.getByTestId("alert-triangle-icon")).toBeTruthy();
  });

  it("shows help me think button when option is selected", () => {
    const onHelp = jest.fn();
    render(<MCQCard {...defaultProps} onHelp={onHelp} />);

    fireEvent.press(screen.getByText("4"));

    const helpButton = screen.getByText(/help me think/i);
    expect(helpButton).toBeTruthy();

    fireEvent.press(helpButton);
    expect(onHelp).toHaveBeenCalledTimes(1);
  });
});
