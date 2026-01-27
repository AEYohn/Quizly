"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";

export default function SignUpPage() {
    const [selectedRole, setSelectedRole] = useState<"teacher" | "student" | null>(null);
    const [isCheckingPendingRole, setIsCheckingPendingRole] = useState(true);
    const searchParams = useSearchParams();

    // Check for pending role on mount (for Clerk's /continue flow)
    // This must complete before showing the role picker to prevent
    // users accidentally selecting the wrong role
    useEffect(() => {
        const pendingRole = localStorage.getItem("quizly_pending_role");
        if (pendingRole === "teacher" || pendingRole === "student") {
            setSelectedRole(pendingRole);
        }
        setIsCheckingPendingRole(false);
    }, []);

    // Store pending role for the callback page
    useEffect(() => {
        if (selectedRole) {
            localStorage.setItem("quizly_pending_role", selectedRole);
        }
    }, [selectedRole]);

    // Show minimal loading state while checking for pending role
    // This prevents users from accidentally clicking "Teacher" when
    // they came from "Sign up to save this packet" (which sets student role)
    if (isCheckingPendingRole) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!selectedRole) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="w-full max-w-lg">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Join Quizly</h1>
                        <p className="text-gray-400">Choose how you want to use Quizly</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => setSelectedRole("teacher")}
                            className="group p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-violet-500 hover:bg-gray-800/50 transition-all duration-200"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-violet-600/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-violet-600/30 transition-colors">
                                    <GraduationCap className="w-8 h-8 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">I'm a Teacher</h2>
                                <p className="text-gray-400 text-sm">
                                    Create quizzes, run live sessions, and track student progress
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setSelectedRole("student")}
                            className="group p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-emerald-500 hover:bg-gray-800/50 transition-all duration-200"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600/30 transition-colors">
                                    <Users className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">I'm a Student</h2>
                                <p className="text-gray-400 text-sm">
                                    Join classes, create study quizzes, and track your learning
                                </p>
                            </div>
                        </button>
                    </div>

                    <p className="text-center text-gray-500 text-sm mt-6">
                        Already have an account?{" "}
                        <a href="/sign-in" className="text-violet-400 hover:text-violet-300">
                            Sign in
                        </a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <button
                        onClick={() => setSelectedRole(null)}
                        className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1"
                    >
                        ← Change role
                    </button>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Create your {selectedRole} account
                    </h1>
                    <p className="text-gray-400">
                        {selectedRole === "teacher"
                            ? "Start creating engaging quizzes for your students"
                            : "Join classes and create your own study materials"}
                    </p>
                </div>
                <SignUp
                    appearance={{
                        baseTheme: dark,
                        layout: {
                            socialButtonsPlacement: "top",
                            socialButtonsVariant: "blockButton",
                        },
                        elements: {
                            rootBox: "mx-auto",
                            card: "bg-gray-900 border border-gray-800 shadow-xl",
                            headerTitle: "text-white",
                            headerSubtitle: "text-gray-400",
                            socialButtonsBlockButton: "bg-gray-800 border-gray-700 text-white hover:bg-gray-700 transition-colors",
                            socialButtonsBlockButtonText: "text-white font-medium",
                            socialButtonsProviderIcon: "w-5 h-5",
                            dividerLine: "bg-gray-700",
                            dividerText: "text-gray-500",
                            formFieldLabel: "text-gray-300",
                            formFieldInput: "bg-gray-800 border-gray-700 text-white",
                            formButtonPrimary: selectedRole === "teacher"
                                ? "bg-violet-600 hover:bg-violet-700"
                                : "bg-emerald-600 hover:bg-emerald-700",
                            footerActionLink: "text-violet-400 hover:text-violet-300",
                            identityPreviewEditButton: "text-violet-400",
                        },
                        variables: {
                            colorPrimary: selectedRole === "teacher" ? "#7c3aed" : "#059669",
                            colorBackground: "#111827",
                            colorText: "#ffffff",
                            colorTextSecondary: "#9ca3af",
                            colorInputBackground: "#1f2937",
                            colorInputText: "#ffffff",
                        },
                    }}
                    routing="path"
                    path="/sign-up"
                    signInUrl="/sign-in"
                    forceRedirectUrl="/auth/callback"
                    unsafeMetadata={{
                        role: selectedRole,
                    }}
                />
            </div>
        </div>
    );
}
