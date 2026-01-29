"use client";

import { useState, useEffect, useCallback } from "react";

// Onboarding step types
export type OnboardingStep =
    | "welcome"
    | "create-course"
    | "create-quiz"
    | "invite-students"
    | "start-session"
    | "complete";

// Step order for progression
const STEP_ORDER: OnboardingStep[] = [
    "welcome",
    "create-course",
    "create-quiz",
    "invite-students",
    "start-session",
    "complete",
];

// LocalStorage key
const STORAGE_KEY = "quizly_teacher_onboarding";

// State shape stored in localStorage
interface OnboardingState {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
    skipped: boolean;
    startedAt: string;
    completedAt?: string;
}

// Return type of the hook
export interface UseTeacherOnboardingReturn {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
    isLoading: boolean;
    shouldShowOnboarding: boolean;
    completeStep: (step: OnboardingStep) => void;
    skipOnboarding: () => void;
    resetOnboarding: () => void;
    isStepComplete: (step: OnboardingStep) => boolean;
    remainingSteps: number;
}

// Default initial state
const getInitialState = (): OnboardingState => ({
    currentStep: "welcome",
    completedSteps: [],
    skipped: false,
    startedAt: new Date().toISOString(),
});

/**
 * Hook for managing teacher onboarding state with localStorage persistence
 */
export function useTeacherOnboarding(): UseTeacherOnboardingReturn {
    const [state, setState] = useState<OnboardingState>(getInitialState());
    const [isLoading, setIsLoading] = useState(true);

    // Load state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as OnboardingState;
                setState(parsed);
            }
        } catch (error) {
            console.error("Failed to load onboarding state:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Persist state to localStorage whenever it changes
    const persistState = useCallback((newState: OnboardingState) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        } catch (error) {
            console.error("Failed to persist onboarding state:", error);
        }
    }, []);

    // Check if a step is complete
    const isStepComplete = useCallback(
        (step: OnboardingStep): boolean => {
            return state.completedSteps.includes(step);
        },
        [state.completedSteps]
    );

    // Complete a step and advance to the next
    const completeStep = useCallback(
        (step: OnboardingStep) => {
            setState((prevState) => {
                // Don't add duplicate completed steps
                const newCompletedSteps = prevState.completedSteps.includes(step)
                    ? prevState.completedSteps
                    : [...prevState.completedSteps, step];

                // Calculate next step
                const currentIndex = STEP_ORDER.indexOf(step);
                const nextStep =
                    currentIndex < STEP_ORDER.length - 1
                        ? STEP_ORDER[currentIndex + 1]
                        : "complete";

                const newState: OnboardingState = {
                    ...prevState,
                    currentStep: nextStep,
                    completedSteps: newCompletedSteps,
                    completedAt: nextStep === "complete" ? new Date().toISOString() : prevState.completedAt,
                };

                persistState(newState);
                return newState;
            });
        },
        [persistState]
    );

    // Skip onboarding entirely
    const skipOnboarding = useCallback(() => {
        setState((prevState) => {
            const newState: OnboardingState = {
                ...prevState,
                skipped: true,
                currentStep: "complete",
            };
            persistState(newState);
            return newState;
        });
    }, [persistState]);

    // Reset onboarding to initial state
    const resetOnboarding = useCallback(() => {
        const newState = getInitialState();
        setState(newState);
        persistState(newState);
    }, [persistState]);

    // Determine if onboarding should be shown
    const shouldShowOnboarding =
        !isLoading && !state.skipped && state.currentStep !== "complete";

    // Calculate remaining steps (excluding welcome and complete)
    const actionSteps: OnboardingStep[] = ["create-course", "create-quiz", "invite-students", "start-session"];
    const remainingSteps = actionSteps.filter(
        (step) => !state.completedSteps.includes(step)
    ).length;

    return {
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        isLoading,
        shouldShowOnboarding,
        completeStep,
        skipOnboarding,
        resetOnboarding,
        isStepComplete,
        remainingSteps,
    };
}
