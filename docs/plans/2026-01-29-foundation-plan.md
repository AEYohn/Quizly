# Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build shared infrastructure (theme system, offline layer, event bus, types) that all other tracks depend on.

**Architecture:** Theme provider wraps app, reads from Zustand store, exposes colors via context. Offline queue persists mutations to AsyncStorage and replays when online. Event bus enables cross-track communication without tight coupling.

**Tech Stack:** React Context, Zustand, AsyncStorage, @react-native-community/netinfo, NativeWind dark mode

---

## Task 1: Install Dependencies

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install netinfo for network status**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm install @react-native-community/netinfo
```

Expected: Package added to dependencies

**Step 2: Verify installation**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm ls @react-native-community/netinfo
```

Expected: Shows installed version

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add package.json package-lock.json && git commit -m "chore: add netinfo dependency for offline support"
```

---

## Task 2: Create Shared Types

**Files:**
- Create: `mobile/types/index.ts`
- Create: `mobile/types/progression.ts`
- Create: `mobile/types/study.ts`
- Create: `mobile/types/social.ts`
- Create: `mobile/types/events.ts`

**Step 1: Create types directory and index**

Create `mobile/types/index.ts`:
```typescript
export * from './progression';
export * from './study';
export * from './social';
export * from './events';
```

**Step 2: Create progression types**

Create `mobile/types/progression.ts`:
```typescript
export type XPSource =
  | 'quiz_complete'
  | 'perfect_score'
  | 'daily_login'
  | 'card_review'
  | 'quiz_created'
  | 'streak_bonus'
  | 'achievement';

export interface XPEvent {
  id: string;
  source: XPSource;
  amount: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  unlockedAt?: string;
  progress?: number;
  requirement: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  isCurrentUser: boolean;
}
```

**Step 3: Create study types**

Create `mobile/types/study.ts`:
```typescript
export interface CardReview {
  cardId: string visitorId: string;
  visitorId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string;
}

export interface DailyStudyStats {
  date: string;
  cardsReviewed: number;
  correctCount: number;
  totalTime: number;
}

export interface StudySession {
  id: string;
  quizId: string;
  startedAt: string;
  cardsReviewed: string[];
  correctCount: number;
}

export interface StudyPacket {
  id: string;
  date: string;
  sections: StudyPacketSection[];
  totalCards: number;
  estimatedTime: number;
}

export interface StudyPacketSection {
  title: string;
  description: string;
  cardIds: string[];
  estimatedTime: number;
}
```

**Step 4: Create social types**

Create `mobile/types/social.ts`:
```typescript
export interface UserPreview {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  streak: number;
}

export type FriendStatus = 'online' | 'offline' | 'studying';

export interface Friend extends UserPreview {
  addedAt: string;
  status: FriendStatus;
}

export interface FriendRequest {
  id: string;
  user: UserPreview;
  sentAt: string;
  direction: 'incoming' | 'outgoing';
}

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  members: UserPreview[];
  sharedQuizzes: string[];
  createdBy: string;
  createdAt: string;
  isOwner: boolean;
}

export interface QuizComment {
  id: string;
  quizId: string;
  user: UserPreview;
  text: string;
  rating?: number;
  createdAt: string;
}

export type ActivityType = 'quiz_complete' | 'quiz_created' | 'achievement' | 'streak' | 'level_up';

export interface ActivityItem {
  id: string;
  user: UserPreview;
  type: ActivityType;
  metadata: Record<string, unknown>;
  timestamp: string;
}
```

**Step 5: Create event types**

Create `mobile/types/events.ts`:
```typescript
export type AppEvent =
  | { type: 'QUIZ_COMPLETED'; payload: { quizId: string; score: number; perfect: boolean } }
  | { type: 'CARD_REVIEWED'; payload: { cardId: string; quality: number } }
  | { type: 'QUIZ_CREATED'; payload: { quizId: string } }
  | { type: 'DAILY_LOGIN'; payload: { date: string } }
  | { type: 'ACHIEVEMENT_UNLOCKED'; payload: { achievementId: string } }
  | { type: 'LEVEL_UP'; payload: { newLevel: number } }
  | { type: 'STREAK_UPDATED'; payload: { streak: number; maintained: boolean } };

export type AppEventType = AppEvent['type'];

export type AppEventListener<T extends AppEventType = AppEventType> = (
  event: Extract<AppEvent, { type: T }>
) => void;
```

**Step 6: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add types/ && git commit -m "feat: add shared type definitions for all tracks"
```

---

## Task 3: Create Event Bus

**Files:**
- Create: `mobile/lib/events.ts`
- Test: `mobile/__tests__/lib/events.test.ts`

**Step 1: Write the failing test**

Create `mobile/__tests__/lib/events.test.ts`:
```typescript
import { eventBus } from '@/lib/events';

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('should emit and receive events', () => {
    const listener = jest.fn();
    eventBus.on('QUIZ_COMPLETED', listener);

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: true },
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: true },
    });
  });

  it('should unsubscribe correctly', () => {
    const listener = jest.fn();
    const unsubscribe = eventBus.on('QUIZ_COMPLETED', listener);
    unsubscribe();

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: false },
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should only call listeners for matching event type', () => {
    const quizListener = jest.fn();
    const cardListener = jest.fn();

    eventBus.on('QUIZ_COMPLETED', quizListener);
    eventBus.on('CARD_REVIEWED', cardListener);

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: false },
    });

    expect(quizListener).toHaveBeenCalled();
    expect(cardListener).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/lib/events.test.ts
```

Expected: FAIL - Cannot find module '@/lib/events'

**Step 3: Write implementation**

Create `mobile/lib/events.ts`:
```typescript
import { AppEvent, AppEventType, AppEventListener } from '@/types/events';

type Listeners = {
  [K in AppEventType]?: Set<AppEventListener<K>>;
};

class EventBus {
  private listeners: Listeners = {};

  on<T extends AppEventType>(
    eventType: T,
    listener: AppEventListener<T>
  ): () => void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = new Set();
    }

    const listenersSet = this.listeners[eventType] as Set<AppEventListener<T>>;
    listenersSet.add(listener);

    return () => {
      listenersSet.delete(listener);
    };
  }

  emit<T extends AppEvent>(event: T): void {
    const listenersSet = this.listeners[event.type as AppEventType];
    if (listenersSet) {
      listenersSet.forEach((listener) => {
        (listener as AppEventListener<typeof event.type>)(event as any);
      });
    }
  }

  clear(): void {
    this.listeners = {};
  }
}

export const eventBus = new EventBus();
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/lib/events.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/events.ts __tests__/lib/events.test.ts && git commit -m "feat: add event bus for cross-track communication"
```

---

## Task 4: Create Theme Color Tokens

**Files:**
- Create: `mobile/lib/theme.ts`

**Step 1: Create theme color tokens**

Create `mobile/lib/theme.ts`:
```typescript
export interface ColorTokens {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accents
  brand: string;
  brandLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;

  // Components
  cardBg: string;
  border: string;
  inputBg: string;

  // Misc
  overlay: string;
}

export const lightColors: ColorTokens = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgTertiary: '#F3F4F6',

  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',

  brand: '#6366F1',
  brandLight: '#EEF2FF',
  success: '#22C55E',
  successLight: '#F0FDF4',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',

  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  inputBg: '#F9FAFB',

  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const darkColors: ColorTokens = {
  bgPrimary: '#111827',
  bgSecondary: '#1F2937',
  bgTertiary: '#374151',

  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',

  brand: '#818CF8',
  brandLight: '#312E81',
  success: '#4ADE80',
  successLight: '#14532D',
  warning: '#FBBF24',
  warningLight: '#78350F',
  error: '#F87171',
  errorLight: '#7F1D1D',

  cardBg: '#1F2937',
  border: '#374151',
  inputBg: '#374151',

  overlay: 'rgba(0, 0, 0, 0.7)',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export function getColors(isDark: boolean): ColorTokens {
  return isDark ? darkColors : lightColors;
}
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/theme.ts && git commit -m "feat: add theme color tokens for light and dark modes"
```

---

## Task 5: Create Theme Provider

**Files:**
- Create: `mobile/providers/ThemeProvider.tsx`
- Modify: `mobile/app/_layout.tsx`

**Step 1: Create ThemeProvider**

Create `mobile/providers/ThemeProvider.tsx`:
```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { ColorTokens, getColors, ThemeMode } from '@/lib/theme';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorTokens;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { preferences, setPreference } = useUserStore();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = preferences.theme;
    if (theme === 'system') {
      setIsDark(systemColorScheme === 'dark');
    } else {
      setIsDark(theme === 'dark');
    }
  }, [preferences.theme, systemColorScheme]);

  const setTheme = (theme: ThemeMode) => {
    setPreference('theme', theme);
  };

  const colors = getColors(isDark);

  return (
    <ThemeContext.Provider value={{ isDark, colors, theme: preferences.theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

**Step 2: Update root layout to include ThemeProvider**

Modify `mobile/app/_layout.tsx` - wrap AuthProvider children with ThemeProvider:

Find this section:
```typescript
<AuthProvider>
  <StatusBar style="auto" />
```

Replace with:
```typescript
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';

// Inside component, create a wrapper for StatusBar that uses theme:
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// Then in JSX:
<AuthProvider>
  <ThemeProvider>
    <ThemedStatusBar />
```

The full updated `_layout.tsx`:
```typescript
import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@/lib/tokenCache";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function AppContent() {
  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="game/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <AppContent />
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ThemeProvider>
                  <AppContent />
                </ThemeProvider>
              </AuthProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add providers/ThemeProvider.tsx app/_layout.tsx && git commit -m "feat: add ThemeProvider with system/light/dark mode support"
```

---

## Task 6: Update Tailwind Config for Dark Mode

**Files:**
- Modify: `mobile/tailwind.config.js`

**Step 1: Enable dark mode in Tailwind**

Update `mobile/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
        success: {
          50: "#F0FDF4",
          500: "#22C55E",
          600: "#16A34A",
        },
        warning: {
          50: "#FFFBEB",
          500: "#F59E0B",
          600: "#D97706",
        },
        error: {
          50: "#FEF2F2",
          500: "#EF4444",
          600: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add tailwind.config.js && git commit -m "feat: enable dark mode in Tailwind config"
```

---

## Task 7: Create Network Status Hook

**Files:**
- Create: `mobile/hooks/useNetworkStatus.ts`
- Test: `mobile/__tests__/hooks/useNetworkStatus.test.ts`

**Step 1: Write the failing test**

Create `mobile/__tests__/hooks/useNetworkStatus.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(),
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return online status', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    const { result } = renderHook(() => useNetworkStatus());

    // Initial state
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should subscribe to network changes', () => {
    renderHook(() => useNetworkStatus());

    expect(NetInfo.addEventListener).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/hooks/useNetworkStatus.test.ts
```

Expected: FAIL - Cannot find module

**Step 3: Write implementation**

Create `mobile/hooks/useNetworkStatus.ts`:
```typescript
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? true);
      setConnectionType(state.type);
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? true);
      setConnectionType(state.type);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType,
  };
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/hooks/useNetworkStatus.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add hooks/useNetworkStatus.ts __tests__/hooks/useNetworkStatus.test.ts && git commit -m "feat: add useNetworkStatus hook for offline detection"
```

---

## Task 8: Create Offline Queue

**Files:**
- Create: `mobile/lib/offlineQueue.ts`
- Test: `mobile/__tests__/lib/offlineQueue.test.ts`

**Step 1: Write the failing test**

Create `mobile/__tests__/lib/offlineQueue.test.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueue } from '@/lib/offlineQueue';

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(async () => {
    await AsyncStorage.clear();
    queue = new OfflineQueue();
  });

  it('should add mutations to queue', async () => {
    await queue.add({
      endpoint: '/api/test',
      method: 'POST',
      body: { data: 'test' },
    });

    const items = await queue.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].endpoint).toBe('/api/test');
  });

  it('should persist queue to AsyncStorage', async () => {
    await queue.add({
      endpoint: '/api/test',
      method: 'POST',
      body: { data: 'test' },
    });

    // Create new queue instance to test persistence
    const newQueue = new OfflineQueue();
    await newQueue.load();
    const items = await newQueue.getAll();

    expect(items).toHaveLength(1);
  });

  it('should clear queue after processing', async () => {
    await queue.add({
      endpoint: '/api/test',
      method: 'POST',
      body: { data: 'test' },
    });

    await queue.clear();
    const items = await queue.getAll();

    expect(items).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/lib/offlineQueue.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `mobile/lib/offlineQueue.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'quizly-offline-queue';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  timestamp: number;
  retries: number;
  token?: string;
}

type AddMutationParams = Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>;

export class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
      this.loaded = true;
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  async add(mutation: AddMutationParams): Promise<string> {
    await this.load();

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedMutation);
    await this.save();

    return id;
  }

  async getAll(): Promise<QueuedMutation[]> {
    await this.load();
    return [...this.queue];
  }

  async remove(id: string): Promise<void> {
    await this.load();
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.save();
  }

  async incrementRetry(id: string): Promise<void> {
    await this.load();
    const mutation = this.queue.find((m) => m.id === id);
    if (mutation) {
      mutation.retries += 1;
      await this.save();
    }
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
  }

  async process(
    executor: (mutation: QueuedMutation) => Promise<boolean>
  ): Promise<{ succeeded: number; failed: number }> {
    await this.load();

    let succeeded = 0;
    let failed = 0;

    const toProcess = [...this.queue];

    for (const mutation of toProcess) {
      try {
        const success = await executor(mutation);
        if (success) {
          await this.remove(mutation.id);
          succeeded++;
        } else {
          await this.incrementRetry(mutation.id);
          failed++;
        }
      } catch (error) {
        await this.incrementRetry(mutation.id);
        failed++;
      }
    }

    return { succeeded, failed };
  }

  get length(): number {
    return this.queue.length;
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/lib/offlineQueue.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/offlineQueue.ts __tests__/lib/offlineQueue.test.ts && git commit -m "feat: add offline mutation queue with AsyncStorage persistence"
```

---

## Task 9: Update Settings Screen

**Files:**
- Modify: `mobile/app/(student)/profile.tsx`

**Step 1: Update profile screen with real settings**

Replace `mobile/app/(student)/profile.tsx` with:
```typescript
import { View, Text, ScrollView, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useUserStore } from "@/stores/userStore";
import { Button, Card, PressableCard } from "@/components/ui";
import {
  User,
  LogOut,
  Trophy,
  Gamepad2,
  Target,
  Flame,
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
  Bell,
  Volume2,
  Vibrate,
  HelpCircle,
} from "lucide-react-native";

type ThemeOption = "light" | "dark" | "system";

const themeOptions: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Smartphone },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn, isGuest, nickname, guestData, signOut } = useAuth();
  const { theme, setTheme, isDark, colors } = useTheme();
  const { preferences, setPreference } = useUserStore();

  const displayName = nickname || guestData?.nickname || "Guest";
  const gamesPlayed = guestData?.gamesPlayed?.length || 0;
  const totalScore = guestData?.totalScore || 0;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  const bgColor = isDark ? "bg-gray-900" : "bg-gray-50";
  const cardBg = isDark ? "bg-gray-800" : "bg-white";
  const textColor = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-500";
  const borderColor = isDark ? "border-gray-700" : "border-gray-100";

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6">
        {/* Profile Header */}
        <Card variant="elevated" className={`items-center py-6 mb-6 ${cardBg}`}>
          <View className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full items-center justify-center mb-4">
            <User size={40} color={colors.brand} />
          </View>
          <Text className={`text-2xl font-bold ${textColor} mb-1`}>
            {displayName}
          </Text>
          <Text className={textSecondary}>
            {isSignedIn ? "Student Account" : "Guest Account"}
          </Text>

          {isGuest && (
            <Button
              className="mt-4"
              size="sm"
              onPress={() => router.push("/(auth)/sign-up")}
            >
              Create Account
            </Button>
          )}
        </Card>

        {/* Stats */}
        <Card variant="outline" className={`mb-6 ${cardBg}`}>
          <Text className={`text-lg font-semibold ${textColor} mb-4`}>
            Statistics
          </Text>
          <View className="flex-row">
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-xl items-center justify-center mb-2">
                <Trophy size={20} color="#F59E0B" />
              </View>
              <Text className={`text-2xl font-bold ${textColor}`}>
                {totalScore}
              </Text>
              <Text className={`text-xs ${textSecondary}`}>Total Points</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl items-center justify-center mb-2">
                <Gamepad2 size={20} color="#8B5CF6" />
              </View>
              <Text className={`text-2xl font-bold ${textColor}`}>
                {gamesPlayed}
              </Text>
              <Text className={`text-xs ${textSecondary}`}>Games Played</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-xl items-center justify-center mb-2">
                <Target size={20} color="#22C55E" />
              </View>
              <Text className={`text-2xl font-bold ${textColor}`}>0%</Text>
              <Text className={`text-xs ${textSecondary}`}>Accuracy</Text>
            </View>
          </View>
        </Card>

        {/* Appearance */}
        <Text className={`text-lg font-semibold ${textColor} mb-3`}>
          Appearance
        </Text>
        <Card variant="outline" className={`mb-6 ${cardBg}`}>
          <Text className={`text-sm font-medium ${textSecondary} mb-3`}>
            Theme
          </Text>
          <View className="flex-row gap-2">
            {themeOptions.map((option) => {
              const isSelected = theme === option.value;
              const Icon = option.icon;
              return (
                <PressableCard
                  key={option.value}
                  className={`flex-1 items-center py-3 rounded-xl ${
                    isSelected
                      ? "bg-primary-100 dark:bg-primary-900 border-2 border-primary-500"
                      : `${isDark ? "bg-gray-700" : "bg-gray-100"}`
                  }`}
                  onPress={() => setTheme(option.value)}
                >
                  <Icon
                    size={24}
                    color={isSelected ? colors.brand : colors.textMuted}
                  />
                  <Text
                    className={`text-sm mt-1 ${
                      isSelected ? "text-primary-600 dark:text-primary-400 font-medium" : textSecondary
                    }`}
                  >
                    {option.label}
                  </Text>
                </PressableCard>
              );
            })}
          </View>
        </Card>

        {/* Sound & Haptics */}
        <Text className={`text-lg font-semibold ${textColor} mb-3`}>
          Sound & Haptics
        </Text>
        <Card variant="outline" padding="none" className={`mb-6 ${cardBg}`}>
          <View className={`flex-row items-center justify-between p-4 border-b ${borderColor}`}>
            <View className="flex-row items-center">
              <View className={`w-10 h-10 ${isDark ? "bg-gray-700" : "bg-gray-100"} rounded-xl items-center justify-center mr-3`}>
                <Volume2 size={20} color={colors.textMuted} />
              </View>
              <Text className={`${textColor} font-medium`}>Sound Effects</Text>
            </View>
            <Switch
              value={preferences.soundEnabled}
              onValueChange={(value) => setPreference("soundEnabled", value)}
              trackColor={{ false: colors.border, true: colors.brand }}
            />
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <View className={`w-10 h-10 ${isDark ? "bg-gray-700" : "bg-gray-100"} rounded-xl items-center justify-center mr-3`}>
                <Vibrate size={20} color={colors.textMuted} />
              </View>
              <Text className={`${textColor} font-medium`}>Vibration</Text>
            </View>
            <Switch
              value={preferences.vibrationEnabled}
              onValueChange={(value) => setPreference("vibrationEnabled", value)}
              trackColor={{ false: colors.border, true: colors.brand }}
            />
          </View>
        </Card>

        {/* Other Settings */}
        <Text className={`text-lg font-semibold ${textColor} mb-3`}>
          More
        </Text>
        <Card variant="outline" padding="none" className={`mb-6 ${cardBg}`}>
          <PressableCard
            padding="md"
            className={`flex-row items-center justify-between border-b ${borderColor}`}
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className={`w-10 h-10 ${isDark ? "bg-gray-700" : "bg-gray-100"} rounded-xl items-center justify-center mr-3`}>
                <Bell size={20} color={colors.textMuted} />
              </View>
              <Text className={`${textColor} font-medium`}>Notifications</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </PressableCard>

          <PressableCard
            padding="md"
            className="flex-row items-center justify-between"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className={`w-10 h-10 ${isDark ? "bg-gray-700" : "bg-gray-100"} rounded-xl items-center justify-center mr-3`}>
                <HelpCircle size={20} color={colors.textMuted} />
              </View>
              <Text className={`${textColor} font-medium`}>Help & Support</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </PressableCard>
        </Card>

        {/* Sign Out */}
        {isSignedIn && (
          <Button
            variant="danger"
            fullWidth
            icon={LogOut}
            onPress={handleSignOut}
          >
            Sign Out
          </Button>
        )}

        {/* Version */}
        <Text className={`text-center ${textSecondary} text-sm mt-6`}>
          Quizly v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/profile.tsx && git commit -m "feat: update settings screen with theme picker and sound/haptics toggles"
```

---

## Task 10: Export Types from Package

**Files:**
- Modify: `mobile/tsconfig.json` (if needed for paths)

**Step 1: Verify tsconfig has correct paths**

Check `mobile/tsconfig.json` includes path alias for types:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 2: Run type check to verify everything compiles**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm run typecheck
```

Expected: No errors

**Step 3: Final commit for foundation**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add -A && git commit -m "chore: foundation complete - theme, offline, events, types ready"
```

---

## Summary

Foundation is complete when all tasks pass. The following are now available for other tracks:

- **Types:** `@/types/*` - Shared interfaces
- **Theme:** `useTheme()` hook - Access colors, isDark, setTheme
- **Events:** `eventBus` - Cross-track communication
- **Offline:** `offlineQueue` + `useNetworkStatus()` - Offline support
- **Settings:** Working theme picker, sound/haptics toggles

Parallel tracks can now begin.
