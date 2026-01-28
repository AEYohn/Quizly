import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { authApi } from "@/lib/api";

const GUEST_ID_KEY = "quizly_guest_id";
const GUEST_NICKNAME_KEY = "quizly_guest_nickname";

interface GuestData {
  id: string;
  nickname: string;
  gamesPlayed: string[];
  totalScore: number;
}

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  isGuest: boolean;
  userId: string | null;
  nickname: string | null;
  token: string | null;
  guestData: GuestData | null;
  setGuestNickname: (nickname: string) => Promise<void>;
  addGuestGame: (gameId: string, score: number) => Promise<void>;
  convertGuestToUser: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Check if Clerk is available
const CLERK_AVAILABLE = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Conditional Clerk imports - only use when available
let useClerkAuth: any = () => ({ isLoaded: true, isSignedIn: false, getToken: null, signOut: null });
let useUser: any = () => ({ user: null });

if (CLERK_AVAILABLE) {
  try {
    const clerk = require("@clerk/clerk-expo");
    useClerkAuth = clerk.useAuth;
    useUser = clerk.useUser;
  } catch (e) {
    // Clerk not available, use defaults
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Only use Clerk hooks if Clerk is available
  const clerkAuth = CLERK_AVAILABLE ? useClerkAuth() : { isLoaded: true, isSignedIn: false, getToken: null, signOut: null };
  const { user } = CLERK_AVAILABLE ? useUser() : { user: null };

  const [guestData, setGuestData] = useState<GuestData | null>(null);
  const [isGuestLoaded, setIsGuestLoaded] = useState(false);

  // Load guest data on mount
  useEffect(() => {
    async function loadGuestData() {
      try {
        const storedId = await SecureStore.getItemAsync(GUEST_ID_KEY);
        const storedNickname = await SecureStore.getItemAsync(GUEST_NICKNAME_KEY);
        const storedGames = await SecureStore.getItemAsync("quizly_guest_games");
        const storedScore = await SecureStore.getItemAsync("quizly_guest_score");

        if (storedId) {
          setGuestData({
            id: storedId,
            nickname: storedNickname || "",
            gamesPlayed: storedGames ? JSON.parse(storedGames) : [],
            totalScore: storedScore ? parseInt(storedScore, 10) : 0,
          });
        }
      } catch (error) {
        console.error("Failed to load guest data:", error);
      } finally {
        setIsGuestLoaded(true);
      }
    }

    loadGuestData();
  }, []);

  // Create guest session if not signed in and no guest data
  const ensureGuestSession = useCallback(async () => {
    if (!clerkAuth.isSignedIn && !guestData) {
      const newGuestId = generateGuestId();
      const newGuestData: GuestData = {
        id: newGuestId,
        nickname: "",
        gamesPlayed: [],
        totalScore: 0,
      };

      await SecureStore.setItemAsync(GUEST_ID_KEY, newGuestId);
      setGuestData(newGuestData);
      return newGuestData;
    }
    return guestData;
  }, [clerkAuth.isSignedIn, guestData]);

  const setGuestNickname = useCallback(async (nickname: string) => {
    const data = await ensureGuestSession();
    if (data) {
      const updated = { ...data, nickname };
      await SecureStore.setItemAsync(GUEST_NICKNAME_KEY, nickname);
      setGuestData(updated);
    }
  }, [ensureGuestSession]);

  const addGuestGame = useCallback(async (gameId: string, score: number) => {
    if (guestData) {
      const updated = {
        ...guestData,
        gamesPlayed: [...guestData.gamesPlayed, gameId],
        totalScore: guestData.totalScore + score,
      };
      await SecureStore.setItemAsync("quizly_guest_games", JSON.stringify(updated.gamesPlayed));
      await SecureStore.setItemAsync("quizly_guest_score", updated.totalScore.toString());
      setGuestData(updated);
    }
  }, [guestData]);

  const convertGuestToUser = useCallback(async () => {
    if (!clerkAuth.isSignedIn || !user || !guestData) return;

    try {
      const token = clerkAuth.getToken ? await clerkAuth.getToken() : null;
      if (token) {
        // Sync user with backend, including guest data
        await authApi.syncUser({
          clerk_id: user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          name: user.firstName || guestData.nickname,
        }, token);

        // Clear guest data
        await SecureStore.deleteItemAsync(GUEST_ID_KEY);
        await SecureStore.deleteItemAsync(GUEST_NICKNAME_KEY);
        await SecureStore.deleteItemAsync("quizly_guest_games");
        await SecureStore.deleteItemAsync("quizly_guest_score");
        setGuestData(null);
      }
    } catch (error) {
      console.error("Failed to convert guest to user:", error);
    }
  }, [clerkAuth, user, guestData]);

  const signOut = useCallback(async () => {
    if (clerkAuth.signOut) {
      await clerkAuth.signOut();
    }
    // Keep guest data for returning guests
  }, [clerkAuth]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (clerkAuth.isSignedIn && clerkAuth.getToken) {
      return clerkAuth.getToken();
    }
    return null;
  }, [clerkAuth]);

  const isLoaded = (CLERK_AVAILABLE ? clerkAuth.isLoaded : true) && isGuestLoaded;
  const isSignedIn = clerkAuth.isSignedIn ?? false;
  const isGuest = !isSignedIn && !!guestData;

  const value: AuthContextType = {
    isLoaded,
    isSignedIn,
    isGuest,
    userId: isSignedIn ? user?.id ?? null : guestData?.id ?? null,
    nickname: isSignedIn ? user?.firstName ?? null : guestData?.nickname ?? null,
    token: null, // Use getToken() for async token retrieval
    guestData,
    setGuestNickname,
    addGuestGame,
    convertGuestToUser,
    signOut,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
