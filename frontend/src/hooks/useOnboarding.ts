"use client";

import { useState, useEffect, useCallback } from "react";

// Teacher onboarding step types
export type OnboardingStep =
    | "welcome"
    | "create-course"
    | "create-quiz"
    | "invite-students"
    | "start-session"
    | "complete";

// Student onboarding step types
export type StudentOnboardingStep =
    | "welcome"
    | "join-class"
    | "try-quiz"
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
                const nextStep: OnboardingStep =
                    currentIndex < STEP_ORDER.length - 1
                        ? (STEP_ORDER[currentIndex + 1] as OnboardingStep)
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

// ============================================
// Student Onboarding Hook
// ============================================

// Student step order for progression
const STUDENT_STEP_ORDER: StudentOnboardingStep[] = [
    "welcome",
    "join-class",
    "try-quiz",
    "complete",
];

// Student localStorage key
const STUDENT_STORAGE_KEY = "quizly_student_onboarding";

// Student state shape stored in localStorage
interface StudentOnboardingState {
    currentStep: StudentOnboardingStep;
    completedSteps: StudentOnboardingStep[];
    skipped: boolean;
    startedAt: string;
    completedAt?: string;
}

// Return type of the student hook
export interface UseStudentOnboardingReturn {
    currentStep: StudentOnboardingStep;
    completedSteps: StudentOnboardingStep[];
    isLoading: boolean;
    shouldShowOnboarding: boolean;
    completeStep: (step: StudentOnboardingStep) => void;
    skipOnboarding: () => void;
    resetOnboarding: () => void;
    isStepComplete: (step: StudentOnboardingStep) => boolean;
    remainingSteps: number;
}

// Default initial state for student
const getStudentInitialState = (): StudentOnboardingState => ({
    currentStep: "welcome",
    completedSteps: [],
    skipped: false,
    startedAt: new Date().toISOString(),
});

/**
 * Hook for managing student onboarding state with localStorage persistence
 */
export function useStudentOnboarding(): UseStudentOnboardingReturn {
    const [state, setState] = useState<StudentOnboardingState>(getStudentInitialState());
    const [isLoading, setIsLoading] = useState(true);

    // Load state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STUDENT_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as StudentOnboardingState;
                setState(parsed);
            }
        } catch (error) {
            console.error("Failed to load student onboarding state:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Persist state to localStorage whenever it changes
    const persistState = useCallback((newState: StudentOnboardingState) => {
        try {
            localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(newState));
        } catch (error) {
            console.error("Failed to persist student onboarding state:", error);
        }
    }, []);

    // Check if a step is complete
    const isStepComplete = useCallback(
        (step: StudentOnboardingStep): boolean => {
            return state.completedSteps.includes(step);
        },
        [state.completedSteps]
    );

    // Complete a step and advance to the next
    const completeStep = useCallback(
        (step: StudentOnboardingStep) => {
            setState((prevState) => {
                // Don't add duplicate completed steps
                const newCompletedSteps = prevState.completedSteps.includes(step)
                    ? prevState.completedSteps
                    : [...prevState.completedSteps, step];

                // Calculate next step
                const currentIndex = STUDENT_STEP_ORDER.indexOf(step);
                const nextStep: StudentOnboardingStep =
                    currentIndex < STUDENT_STEP_ORDER.length - 1
                        ? (STUDENT_STEP_ORDER[currentIndex + 1] as StudentOnboardingStep)
                        : "complete";

                const newState: StudentOnboardingState = {
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
            const newState: StudentOnboardingState = {
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
        const newState = getStudentInitialState();
        setState(newState);
        persistState(newState);
    }, [persistState]);

    // Determine if onboarding should be shown
    const shouldShowOnboarding =
        !isLoading && !state.skipped && state.currentStep !== "complete";

    // Calculate remaining steps (excluding welcome and complete)
    const actionSteps: StudentOnboardingStep[] = ["join-class", "try-quiz"];
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
