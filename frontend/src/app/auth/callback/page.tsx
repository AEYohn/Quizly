"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuthCallbackPage() {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const [status, setStatus] = useState("Signing you in...");

    useEffect(() => {
        if (!isLoaded) return;

        if (!user) {
            router.push("/sign-in");
            return;
        }

        syncUserAndRedirect();
    }, [isLoaded, user]);

    async function syncUserAndRedirect() {
        try {
            setStatus("Setting up your account...");

            // Get the session token
            const token = await (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk?.session?.getToken();
            if (!token) {
                throw new Error("No session token");
            }

            // Store token for API calls
            localStorage.setItem("token", token);

            // Determine role: prefer localStorage, fallback to Clerk metadata, then "teacher"
            const pendingRole = localStorage.getItem("quizly_pending_role");
            const clerkRole = user?.unsafeMetadata?.role as string | undefined;
            const role = pendingRole || clerkRole || "teacher";

            console.log("[Auth Callback] Role detection:", { pendingRole, clerkRole, finalRole: role });
            console.log("[Auth Callback] Guest data:", {
                playerId: localStorage.getItem("quizly_pending_player_id"),
                gameId: localStorage.getItem("quizly_pending_game_id"),
            });

            // Sync with backend - this will create/update the user
            const response = await fetch(`${API_URL}/auth/clerk/sync`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role }),
            });

            if (response.ok) {
                const userData = await response.json();

                // Store user data (response is the user directly, not wrapped)
                localStorage.setItem("quizly_user", JSON.stringify(userData));
                localStorage.removeItem("quizly_pending_role");

                // Link guest player data if present
                const pendingPlayerId = localStorage.getItem("quizly_pending_player_id");
                const pendingGameId = localStorage.getItem("quizly_pending_game_id");

                console.log("[Auth Callback] Checking for guest data to link:", { pendingPlayerId, pendingGameId });

                if (pendingPlayerId && pendingGameId) {
                    try {
                        console.log("[Auth Callback] Linking guest player...");
                        const linkResponse = await fetch(`${API_URL}/auth/clerk/link-guest`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                player_id: pendingPlayerId,
                                game_id: pendingGameId,
                            }),
                        });
                        const linkResult = await linkResponse.json();
                        console.log("[Auth Callback] Link guest result:", linkResult);
                    } catch (error) {
                        console.error("[Auth Callback] Failed to link guest data:", error);
                    }
                    // Clean up
                    localStorage.removeItem("quizly_pending_player_id");
                    localStorage.removeItem("quizly_pending_game_id");
                } else {
                    console.log("[Auth Callback] No guest data to link");
                }

                setStatus("Redirecting to dashboard...");

                // Redirect based on role
                if (userData.role === "teacher") {
                    router.push("/teacher");
                } else {
                    router.push("/student/dashboard");
                }
            } else {
                console.error("Sync failed:", await response.text());
                // Fallback based on pending role
                const pendingRole = localStorage.getItem("quizly_pending_role");
                localStorage.removeItem("quizly_pending_role");
                router.push(pendingRole === "student" ? "/student/dashboard" : "/teacher");
            }
        } catch (error) {
            console.error("Auth callback error:", error);
            // Fallback based on pending role
            const pendingRole = localStorage.getItem("quizly_pending_role");
            localStorage.removeItem("quizly_pending_role");
            router.push(pendingRole === "student" ? "/student/dashboard" : "/teacher");
        }
    }

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto mb-4" />
                <p className="text-gray-400">{status}</p>
            </div>
        </div>
    );
}
