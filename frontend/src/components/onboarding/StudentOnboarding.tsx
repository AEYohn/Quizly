"use client";

import { useRouter } from "next/navigation";
import {
    LogIn,
    Gamepad2,
    Sparkles,
    X,
} from "lucide-react";
import { OnboardingStep } from "./OnboardingStep";
import {
    useStudentOnboarding,
    type StudentOnboardingStep,
} from "@/hooks/useOnboarding";

export function StudentOnboarding() {
    const router = useRouter();
    const {
        currentStep,
        isLoading,
        shouldShowOnboarding,
        completeStep,
        skipOnboarding,
        isStepComplete,
        remainingSteps,
    } = useStudentOnboarding();

    // Don't render if loading or shouldn't show
    if (isLoading || !shouldShowOnboarding) {
        return null;
    }

    // Handle step actions - navigate and mark as complete
    const handleJoinClass = () => {
        completeStep("join-class");
        router.push("/join");
    };

    const handleTryQuiz = () => {
        completeStep("try-quiz");
        router.push("/student/library");
    };

    const handleWelcomeComplete = () => {
        completeStep("welcome");
    };

    // Check if we're on the welcome step
    const isWelcomeStep = currentStep === "welcome";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
                {/* Close/Skip button */}
                <button
                    onClick={skipOnboarding}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white z-10 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Skip onboarding"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Gradient header - green/emerald for students */}
                <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Welcome to Quizly!
                    </h2>
                    <p className="text-white/80">
                        {isWelcomeStep
                            ? "Let's get you started in just 2 quick steps"
                            : `${remainingSteps} step${remainingSteps !== 1 ? "s" : ""} remaining`}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isWelcomeStep ? (
                        /* Welcome screen */
                        <div className="text-center space-y-6">
                            <p className="text-gray-300">
                                Join your class and start taking quizzes in minutes.
                                Your teacher has already set everything up for you!
                            </p>
                            <button
                                onClick={handleWelcomeComplete}
                                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-semibold text-white transition-all"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        /* Steps list */
                        <div className="space-y-3">
                            <OnboardingStep
                                icon={LogIn}
                                title="Join Your Class"
                                description="Enter your class code to join"
                                isComplete={isStepComplete("join-class")}
                                isCurrent={currentStep === "join-class"}
                                action={{
                                    label: "Join Class",
                                    onClick: handleJoinClass,
                                }}
                            />

                            <OnboardingStep
                                icon={Gamepad2}
                                title="Try a Quiz"
                                description="Take your first quiz and see how it works"
                                isComplete={isStepComplete("try-quiz")}
                                isCurrent={currentStep === "try-quiz"}
                                action={{
                                    label: "Browse Quizzes",
                                    onClick: handleTryQuiz,
                                }}
                            />
                        </div>
                    )}

                    {/* Skip link */}
                    {!isWelcomeStep && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={skipOnboarding}
                                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                Skip setup - I'll explore on my own
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
