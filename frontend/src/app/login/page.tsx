"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
    const { user, isLoading: authLoading } = useAuth();

    useEffect(() => {
        if (!clerkLoaded || authLoading) return;

        if (isSignedIn && user) {
            // User is signed in via Clerk, redirect to appropriate dashboard
            if (user.role === "teacher") {
                router.replace("/teacher");
            } else {
                router.replace("/student/dashboard");
            }
        } else if (!isSignedIn) {
            // Not signed in, redirect to Clerk sign-in
            router.replace("/sign-in");
        }
    }, [clerkLoaded, isSignedIn, authLoading, user, router]);

    // Show loading while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-4" />
                <p className="text-gray-400">Redirecting...</p>
            </div>
        </div>
    );
}
