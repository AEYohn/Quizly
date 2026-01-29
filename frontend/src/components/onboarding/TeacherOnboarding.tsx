"use client";

import { useRouter } from "next/navigation";
import {
    BookOpen,
    FileQuestion,
    Users,
    Play,
    Sparkles,
    X,
} from "lucide-react";
import { OnboardingStep } from "./OnboardingStep";
import {
    useTeacherOnboarding,
    OnboardingStep as OnboardingStepType,
} from "@/hooks/useOnboarding";

export function TeacherOnboarding() {
    const router = useRouter();
    const {
        currentStep,
        isLoading,
        shouldShowOnboarding,
        completeStep,
        skipOnboarding,
        isStepComplete,
        remainingSteps,
    } = useTeacherOnboarding();

    // Don't render if loading or shouldn't show
    if (isLoading || !shouldShowOnboarding) {
        return null;
    }

    // Handle step actions - navigate and mark as complete
    const handleCreateCourse = () => {
        completeStep("create-course");
        router.push("/courses/new");
    };

    const handleCreateQuiz = () => {
        completeStep("create-quiz");
        router.push("/quizzes/new");
    };

    const handleInviteStudents = () => {
        completeStep("invite-students");
        router.push("/courses");
    };

    const handleStartSession = () => {
        completeStep("start-session");
        router.push("/library");
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

                {/* Gradient header */}
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Welcome to Quizly!
                    </h2>
                    <p className="text-white/80">
                        {isWelcomeStep
                            ? "Let's get you set up in just a few steps"
                            : `${remainingSteps} step${remainingSteps !== 1 ? "s" : ""} remaining`}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isWelcomeStep ? (
                        /* Welcome screen */
                        <div className="text-center space-y-6">
                            <p className="text-gray-300">
                                We'll guide you through setting up your first course,
                                creating quizzes, and inviting students. It only takes
                                a few minutes!
                            </p>
                            <button
                                onClick={handleWelcomeComplete}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold text-white transition-all"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        /* Steps list */
                        <div className="space-y-3">
                            <OnboardingStep
                                icon={BookOpen}
                                title="Create Your First Course"
                                description="Organize your quizzes by subject or class"
                                isComplete={isStepComplete("create-course")}
                                isCurrent={currentStep === "create-course"}
                                action={{
                                    label: "Create Course",
                                    onClick: handleCreateCourse,
                                }}
                            />

                            <OnboardingStep
                                icon={FileQuestion}
                                title="Create a Quiz"
                                description="Build engaging quizzes with AI assistance"
                                isComplete={isStepComplete("create-quiz")}
                                isCurrent={currentStep === "create-quiz"}
                                action={{
                                    label: "Create Quiz",
                                    onClick: handleCreateQuiz,
                                }}
                            />

                            <OnboardingStep
                                icon={Users}
                                title="Invite Students"
                                description="Share course codes with your students"
                                isComplete={isStepComplete("invite-students")}
                                isCurrent={currentStep === "invite-students"}
                                action={{
                                    label: "Manage Students",
                                    onClick: handleInviteStudents,
                                }}
                            />

                            <OnboardingStep
                                icon={Play}
                                title="Start a Live Session"
                                description="Host your first interactive quiz session"
                                isComplete={isStepComplete("start-session")}
                                isCurrent={currentStep === "start-session"}
                                action={{
                                    label: "Go to Library",
                                    onClick: handleStartSession,
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
