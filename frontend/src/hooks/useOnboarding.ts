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

// Student step order for progression
const STUDENT_STEP_ORDER: StudentOnboardingStep[] = [
    "welcome",
    "join-class",
    "try-quiz",
    "complete",
];

// State shape stored in localStorage
interface OnboardingState<TStep extends string = string> {
    currentStep: TStep;
    completedSteps: TStep[];
    skipped: boolean;
    startedAt: string;
    completedAt?: string;
}

// Return type of the hooks
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

// ============================================
// Generic onboarding hook factory
// ============================================

interface OnboardingConfig<TStep extends string> {
    storageKey: string;
    stepOrder: TStep[];
    actionSteps: TStep[];
    initialStep: TStep;
    completeStep: TStep;
}

function createOnboardingHook<TStep extends string>(config: OnboardingConfig<TStep>) {
    return function useOnboarding() {
        // 5.5: Lazy initializer — only runs once, avoids creating new Date on every render
        const [state, setState] = useState<OnboardingState<TStep>>(() => ({
            currentStep: config.initialStep,
            completedSteps: [] as TStep[],
            skipped: false,
            startedAt: new Date().toISOString(),
        }));
        const [isLoading, setIsLoading] = useState(true);

        // Load state from localStorage on mount
        useEffect(() => {
            try {
                const stored = localStorage.getItem(config.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored) as OnboardingState<TStep>;
                    setState(parsed);
                }
            } catch (error) {
                console.error("Failed to load onboarding state:", error);
            } finally {
                setIsLoading(false);
            }
        }, []);

        // Persist state to localStorage whenever it changes
        const persistState = useCallback((newState: OnboardingState<TStep>) => {
            try {
                localStorage.setItem(config.storageKey, JSON.stringify(newState));
            } catch (error) {
                console.error("Failed to persist onboarding state:", error);
            }
        }, []);

        // Check if a step is complete
        const isStepComplete = useCallback(
            (step: TStep): boolean => {
                return state.completedSteps.includes(step);
            },
            [state.completedSteps]
        );

        // Complete a step and advance to the next
        const completeStepFn = useCallback(
            (step: TStep) => {
                setState((prevState) => {
                    // Don't add duplicate completed steps
                    const newCompletedSteps = prevState.completedSteps.includes(step)
                        ? prevState.completedSteps
                        : [...prevState.completedSteps, step];

                    // Calculate next step
                    const currentIndex = config.stepOrder.indexOf(step);
                    const nextStep: TStep =
                        currentIndex < config.stepOrder.length - 1
                            ? (config.stepOrder[currentIndex + 1] as TStep)
                            : config.completeStep;

                    const newState: OnboardingState<TStep> = {
                        ...prevState,
                        currentStep: nextStep,
                        completedSteps: newCompletedSteps,
                        completedAt: nextStep === config.completeStep ? new Date().toISOString() : prevState.completedAt,
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
                const newState: OnboardingState<TStep> = {
                    ...prevState,
                    skipped: true,
                    currentStep: config.completeStep,
                };
                persistState(newState);
                return newState;
            });
        }, [persistState]);

        // Reset onboarding to initial state
        const resetOnboarding = useCallback(() => {
            const newState: OnboardingState<TStep> = {
                currentStep: config.initialStep,
                completedSteps: [] as TStep[],
                skipped: false,
                startedAt: new Date().toISOString(),
            };
            setState(newState);
            persistState(newState);
        }, [persistState]);

        // Determine if onboarding should be shown
        const shouldShowOnboarding =
            !isLoading && !state.skipped && state.currentStep !== config.completeStep;

        // Calculate remaining steps (excluding welcome and complete)
        const remainingSteps = config.actionSteps.filter(
            (step) => !state.completedSteps.includes(step)
        ).length;

        return {
            currentStep: state.currentStep,
            completedSteps: state.completedSteps,
            isLoading,
            shouldShowOnboarding,
            completeStep: completeStepFn,
            skipOnboarding,
            resetOnboarding,
            isStepComplete,
            remainingSteps,
        };
    };
}

// ============================================
// Concrete hooks using the factory
// ============================================

export const useTeacherOnboarding = createOnboardingHook<OnboardingStep>({
    storageKey: "quizly_teacher_onboarding",
    stepOrder: STEP_ORDER,
    actionSteps: ["create-course", "create-quiz", "invite-students", "start-session"],
    initialStep: "welcome",
    completeStep: "complete",
});

export const useStudentOnboarding = createOnboardingHook<StudentOnboardingStep>({
    storageKey: "quizly_student_onboarding",
    stepOrder: STUDENT_STEP_ORDER,
    actionSteps: ["join-class", "try-quiz"],
    initialStep: "welcome",
    completeStep: "complete",
});
