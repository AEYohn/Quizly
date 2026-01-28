"use client";

import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
                    <p className="text-gray-400">Sign in to continue to Quizly</p>
                </div>
                <SignIn
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
                            formButtonPrimary: "bg-violet-600 hover:bg-violet-700",
                            footerActionLink: "text-violet-400 hover:text-violet-300",
                            identityPreviewEditButton: "text-violet-400",
                        },
                        variables: {
                            colorPrimary: "#7c3aed",
                            colorBackground: "#111827",
                            colorText: "#ffffff",
                            colorTextSecondary: "#9ca3af",
                            colorInputBackground: "#1f2937",
                            colorInputText: "#ffffff",
                        },
                    }}
                    routing="path"
                    path="/sign-in"
                    signUpUrl="/sign-up"
                    forceRedirectUrl="/auth/callback"
                />
                <p className="text-center text-gray-500 text-sm mt-6">
                    Don't have an account?{" "}
                    <a href="/sign-up" className="text-violet-400 hover:text-violet-300">
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}
