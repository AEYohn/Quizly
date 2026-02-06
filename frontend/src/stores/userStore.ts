import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    setUser: (user: UserInfo | null) => void;
    setToken: (token: string | null) => void;
    clear: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            setUser: (user) => set({ user }),
            setToken: (token) => set({ token }),
            clear: () => set({ user: null, token: null }),
        }),
        {
            name: "quizly-user-store",
        }
    )
);
