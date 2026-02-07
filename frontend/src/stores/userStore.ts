import { create } from "zustand";
import { persist } from "zustand/middleware";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UserInfo {
    id: string;
    email: string;
    name: string;
    role: "teacher" | "student";
    clerkUserId?: string;
}

interface UserState {
    user: UserInfo | null;
    token: string | null;
    tokenExpiresAt: number | null;
    setUser: (user: UserInfo | null) => void;
    setToken: (token: string | null) => void;
    clear: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            tokenExpiresAt: null,
            setUser: (user) => set({ user }),
            setToken: (token) =>
                set({
                    token,
                    tokenExpiresAt: token ? Date.now() + TOKEN_TTL_MS : null,
                }),
            clear: () => set({ user: null, token: null, tokenExpiresAt: null }),
        }),
        {
            name: "quizly-user-store",
            version: 1,
            migrate: (persisted: unknown, version: number) => {
                if (version === 0) {
                    // Clear legacy unversioned data
                    return {} as any;
                }
                return persisted as any;
            },
            onRehydrateStorage: () => (state) => {
                if (
                    state &&
                    state.tokenExpiresAt &&
                    Date.now() > state.tokenExpiresAt
                ) {
                    // Token has expired — clear persisted auth state
                    state.token = null;
                    state.tokenExpiresAt = null;
                    state.user = null;
                }
            },
        }
    )
);
