"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";

// ==============================================================================
// Types
// ==============================================================================

export interface User {
    id: string;
    email: string;
    name: string;
    role: "teacher" | "student";
    clerkUserId?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isTeacher: boolean;
    isStudent: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    demoLogin: () => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name: string, role: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    syncUser: () => Promise<void>;
}

// ==============================================================================
// Context
// ==============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ==============================================================================
// Provider
// ==============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
    const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
    const { getToken, isSignedIn } = useClerkAuth();
    const { signOut } = useClerk();

    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const syncedRef = useRef(false);
    const syncingRef = useRef(false);

    // Sync Clerk user to backend
    const syncUser = useCallback(async () => {
        if (!clerkUser || !isSignedIn || syncingRef.current) return;

        syncingRef.current = true;

        try {
            const clerkToken = await getToken();
            if (!clerkToken) {
                syncingRef.current = false;
                return;
            }

            setToken(clerkToken);

            // Get role from:
            // 1. Pending role from sign-in page (stored in localStorage)
            // 2. Clerk metadata (set during sign-up)
            // 3. Default to student
            const pendingRole = localStorage.getItem("quizly_pending_role");
            const role = pendingRole ||
                        (clerkUser.unsafeMetadata?.role as string) ||
                        (clerkUser.publicMetadata?.role as string) ||
                        "student";

            // Clear pending role after using it
            if (pendingRole) {
                localStorage.removeItem("quizly_pending_role");
            }

            // Sync user to backend
            const response = await fetch(`${API_URL}/auth/clerk/sync`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${clerkToken}`,
                },
                body: JSON.stringify({ role }),
            });

            if (response.ok) {
                const data = await response.json();
                const syncedUser: User = {
                    id: data.id,
                    email: data.email || clerkUser.primaryEmailAddress?.emailAddress || "",
                    name: data.name || clerkUser.fullName || clerkUser.firstName || "User",
                    role: data.role as "teacher" | "student",
                    clerkUserId: data.clerk_user_id,
                };
                setUser(syncedUser);
                syncedRef.current = true;

                // Store in localStorage for backward compatibility
                localStorage.setItem("quizly_user", JSON.stringify(syncedUser));
                localStorage.setItem("quizly_token", clerkToken);
                localStorage.setItem("token", clerkToken);
            } else {
                // If sync fails, create local user object from Clerk data
                const localUser: User = {
                    id: clerkUser.id,
                    email: clerkUser.primaryEmailAddress?.emailAddress || "",
                    name: clerkUser.fullName || clerkUser.firstName || "User",
                    role: role as "teacher" | "student",
                    clerkUserId: clerkUser.id,
                };
                setUser(localUser);
            }
        } catch (error) {
            console.error("Error syncing user:", error);
            // Fallback to Clerk user data
            if (clerkUser) {
                const role = (clerkUser.unsafeMetadata?.role as string) || "student";
                setUser({
                    id: clerkUser.id,
                    email: clerkUser.primaryEmailAddress?.emailAddress || "",
                    name: clerkUser.fullName || clerkUser.firstName || "User",
                    role: role as "teacher" | "student",
                    clerkUserId: clerkUser.id,
                });
            }
        } finally {
            syncingRef.current = false;
        }
    }, [clerkUser, isSignedIn, getToken]);

    // Effect to sync user when Clerk loads
    useEffect(() => {
        if (!clerkLoaded) return;

        // Check if there's a pending role change that needs to be synced
        const pendingRole = localStorage.getItem("quizly_pending_role");
        const needsRoleSync = pendingRole && user && user.role !== pendingRole;

        if (isSignedIn && clerkUser && (!syncedRef.current || needsRoleSync)) {
            // Reset synced flag if we need to update role
            if (needsRoleSync) {
                syncedRef.current = false;
            }
            syncUser().finally(() => setIsLoading(false));
        } else if (!isSignedIn) {
            // Not signed in via Clerk, check for legacy auth
            const savedToken = localStorage.getItem("quizly_token");
            const savedUser = localStorage.getItem("quizly_user");

            if (savedToken && savedUser) {
                try {
                    const parsedUser = JSON.parse(savedUser);
                    // Only use legacy auth if it's not a Clerk user
                    if (!parsedUser.clerkUserId) {
                        setToken(savedToken);
                        setUser(parsedUser);
                    }
                } catch {
                    // Invalid saved data
                }
            }
            setIsLoading(false);
        } else {
            setIsLoading(false);
        }
    }, [clerkLoaded, isSignedIn, clerkUser, syncUser, user]);

    // Refresh token periodically for Clerk users
    useEffect(() => {
        if (!isSignedIn) return;

        const refreshToken = async () => {
            const newToken = await getToken();
            if (newToken) {
                setToken(newToken);
                localStorage.setItem("quizly_token", newToken);
                localStorage.setItem("token", newToken);
            }
        };

        // Refresh every 50 minutes (Clerk tokens expire in 60 minutes)
        const interval = setInterval(refreshToken, 50 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isSignedIn, getToken]);

    // Logout function
    const logout = useCallback(async () => {
        setToken(null);
        setUser(null);
        syncedRef.current = false;
        localStorage.removeItem("quizly_token");
        localStorage.removeItem("quizly_user");
        localStorage.removeItem("quizly_refresh_token");
        localStorage.removeItem("token");

        // Sign out from Clerk if signed in
        if (isSignedIn) {
            await signOut();
        }
    }, [isSignedIn, signOut]);

    // Legacy login (for backward compatibility - redirects to Clerk)
    const login = async (_email: string, _password: string) => {
        // Redirect to Clerk sign-in
        window.location.href = "/sign-in";
        return { success: true };
    };

    // Demo login (still supported for quick testing)
    const demoLogin = async () => {
        try {
            const response = await fetch(`${API_URL}/auth/demo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const data = await response.json();
                return { success: false, error: data.detail || "Demo login failed" };
            }

            const data = await response.json();
            setToken(data.access_token);
            setUser(data.user);
            localStorage.setItem("quizly_token", data.access_token);
            localStorage.setItem("quizly_user", JSON.stringify(data.user));
            localStorage.setItem("token", data.access_token);
            return { success: true };
        } catch {
            return { success: false, error: "Network error" };
        }
    };

    // Legacy register (for backward compatibility - redirects to Clerk)
    const register = async (_email: string, _password: string, _name: string, _role: string) => {
        // Redirect to Clerk sign-up
        window.location.href = "/sign-up";
        return { success: true };
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user || !!isSignedIn,
                isTeacher: user?.role === "teacher",
                isStudent: user?.role === "student",
                login,
                demoLogin,
                register,
                logout,
                syncUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ==============================================================================
// Hook
// ==============================================================================

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

// ==============================================================================
// Helper Hook for getting fresh token
// ==============================================================================

export function useAuthToken() {
    const { token } = useAuth();
    const { getToken } = useClerkAuth();

    const getFreshToken = useCallback(async (): Promise<string | null> => {
        // Try to get fresh Clerk token first
        try {
            const clerkToken = await getToken();
            if (clerkToken) return clerkToken;
        } catch {
            // Fall through to local token
        }
        return token;
    }, [getToken, token]);

    return { token, getFreshToken };
}
