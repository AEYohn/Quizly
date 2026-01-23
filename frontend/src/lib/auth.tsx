"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ==============================================================================
// Types
// ==============================================================================

export interface User {
    id: string;
    email: string;
    name: string;
    role: "teacher" | "student";
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isTeacher: boolean;
    isStudent: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name: string, role: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
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
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const savedToken = localStorage.getItem("quizly_token");
        const savedUser = localStorage.getItem("quizly_user");
        
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            // Verify token is still valid
            verifyToken(savedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    const verifyToken = async (t: string) => {
        try {
            const response = await fetch(`${API_URL}/auth/verify`, {
                headers: { Authorization: `Bearer ${t}` },
            });
            if (!response.ok) {
                logout();
            }
        } catch {
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                return { success: false, error: data.detail || "Login failed" };
            }

            const data = await response.json();
            setToken(data.access_token);
            setUser(data.user);
            localStorage.setItem("quizly_token", data.access_token);
            localStorage.setItem("quizly_user", JSON.stringify(data.user));
            return { success: true };
        } catch (error) {
            return { success: false, error: "Network error" };
        }
    };

    const register = async (email: string, password: string, name: string, role: string) => {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name, role }),
            });

            if (!response.ok) {
                const data = await response.json();
                return { success: false, error: data.detail || "Registration failed" };
            }

            const data = await response.json();
            setToken(data.access_token);
            setUser(data.user);
            localStorage.setItem("quizly_token", data.access_token);
            localStorage.setItem("quizly_user", JSON.stringify(data.user));
            return { success: true };
        } catch (error) {
            return { success: false, error: "Network error" };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("quizly_token");
        localStorage.removeItem("quizly_user");
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user,
                isTeacher: user?.role === "teacher",
                isStudent: user?.role === "student",
                login,
                register,
                logout,
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
