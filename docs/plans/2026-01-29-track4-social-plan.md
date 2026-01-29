# Track 4: Social Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build friend system, study groups, quiz sharing, comments/ratings, and notifications.

**Architecture:** SocialStore (Zustand) manages friends, groups, and activity. API client extended for social endpoints. Notification system uses expo-notifications for push.

**Tech Stack:** Zustand, expo-notifications, react-native-share

**Dependencies:** Foundation must be complete (types, events, theme)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install required packages**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm install expo-notifications
```

Expected: Package added

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add package.json package-lock.json && git commit -m "chore: add expo-notifications for social track"
```

---

## Task 2: Create Social Store

**Files:**
- Create: `mobile/stores/socialStore.ts`

**Step 1: Create the store**

Create `mobile/stores/socialStore.ts`:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Friend,
  FriendRequest,
  StudyGroup,
  UserPreview,
  ActivityItem,
} from '@/types/social';

interface SocialState {
  // State
  friends: Friend[];
  pendingRequests: FriendRequest[];
  groups: StudyGroup[];
  blockedUsers: string[];
  activityFeed: ActivityItem[];
  isLoading: boolean;

  // Actions
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (userId: string) => void;
  setPendingRequests: (requests: FriendRequest[]) => void;
  addPendingRequest: (request: FriendRequest) => void;
  removePendingRequest: (requestId: string) => void;
  setGroups: (groups: StudyGroup[]) => void;
  addGroup: (group: StudyGroup) => void;
  updateGroup: (groupId: string, updates: Partial<StudyGroup>) => void;
  removeGroup: (groupId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  setActivityFeed: (items: ActivityItem[]) => void;
  addActivityItem: (item: ActivityItem) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  friends: [] as Friend[],
  pendingRequests: [] as FriendRequest[],
  groups: [] as StudyGroup[],
  blockedUsers: [] as string[],
  activityFeed: [] as ActivityItem[],
  isLoading: false,
};

export const useSocialStore = create<SocialState>()(
  persist(
    (set) => ({
      ...initialState,

      setFriends: (friends) => set({ friends }),

      addFriend: (friend) =>
        set((state) => ({
          friends: [...state.friends.filter((f) => f.id !== friend.id), friend],
        })),

      removeFriend: (userId) =>
        set((state) => ({
          friends: state.friends.filter((f) => f.id !== userId),
        })),

      setPendingRequests: (requests) => set({ pendingRequests: requests }),

      addPendingRequest: (request) =>
        set((state) => ({
          pendingRequests: [...state.pendingRequests, request],
        })),

      removePendingRequest: (requestId) =>
        set((state) => ({
          pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
        })),

      setGroups: (groups) => set({ groups }),

      addGroup: (group) =>
        set((state) => ({
          groups: [...state.groups.filter((g) => g.id !== group.id), group],
        })),

      updateGroup: (groupId, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        })),

      removeGroup: (groupId) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
        })),

      blockUser: (userId) =>
        set((state) => ({
          blockedUsers: [...state.blockedUsers, userId],
          friends: state.friends.filter((f) => f.id !== userId),
        })),

      unblockUser: (userId) =>
        set((state) => ({
          blockedUsers: state.blockedUsers.filter((id) => id !== userId),
        })),

      setActivityFeed: (items) => set({ activityFeed: items }),

      addActivityItem: (item) =>
        set((state) => ({
          activityFeed: [item, ...state.activityFeed].slice(0, 50),
        })),

      setLoading: (isLoading) => set({ isLoading }),

      reset: () => set(initialState),
    }),
    {
      name: 'quizly-social-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add stores/socialStore.ts && git commit -m "feat(social): add social store for friends, groups, activity"
```

---

## Task 3: Create Social API Functions

**Files:**
- Modify: `mobile/lib/api.ts`

**Step 1: Add social API endpoints**

Add to `mobile/lib/api.ts`:
```typescript
// Social API Types
export interface SendFriendRequestRequest {
  user_id: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface QuizCommentRequest {
  text: string;
  rating?: number;
}

export interface QuizComment {
  id: string;
  quiz_id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  rating?: number;
  created_at: string;
}

// Social API
export const socialApi = {
  // Friends
  getFriends: (token: string) =>
    request<Friend[]>('/social/friends', { token }),

  searchUsers: (query: string, token: string) =>
    request<UserPreview[]>(`/social/users/search?q=${encodeURIComponent(query)}`, { token }),

  sendFriendRequest: (userId: string, token: string) =>
    request<{ id: string }>('/social/friends/request', {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),

  acceptFriendRequest: (requestId: string, token: string) =>
    request<Friend>(`/social/friends/request/${requestId}/accept`, {
      method: 'POST',
      token,
    }),

  declineFriendRequest: (requestId: string, token: string) =>
    request<void>(`/social/friends/request/${requestId}`, {
      method: 'DELETE',
      token,
    }),

  removeFriend: (userId: string, token: string) =>
    request<void>(`/social/friends/${userId}`, {
      method: 'DELETE',
      token,
    }),

  // Groups
  getGroups: (token: string) =>
    request<StudyGroup[]>('/social/groups', { token }),

  createGroup: (data: CreateGroupRequest, token: string) =>
    request<StudyGroup>('/social/groups', {
      method: 'POST',
      body: data,
      token,
    }),

  getGroup: (groupId: string, token: string) =>
    request<StudyGroup>(`/social/groups/${groupId}`, { token }),

  joinGroup: (groupId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/join`, {
      method: 'POST',
      token,
    }),

  leaveGroup: (groupId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/leave`, {
      method: 'POST',
      token,
    }),

  inviteToGroup: (groupId: string, userId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/invite`, {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),

  shareQuizToGroup: (groupId: string, quizId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/quizzes`, {
      method: 'POST',
      body: { quiz_id: quizId },
      token,
    }),

  // Comments
  getQuizComments: (quizId: string) =>
    request<QuizComment[]>(`/quizzes/${quizId}/comments`),

  addQuizComment: (quizId: string, data: QuizCommentRequest, token: string) =>
    request<QuizComment>(`/quizzes/${quizId}/comments`, {
      method: 'POST',
      body: data,
      token,
    }),

  deleteQuizComment: (quizId: string, commentId: string, token: string) =>
    request<void>(`/quizzes/${quizId}/comments/${commentId}`, {
      method: 'DELETE',
      token,
    }),

  // Activity
  getActivityFeed: (token: string) =>
    request<ActivityItem[]>('/social/activity', { token }),
};
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/api.ts && git commit -m "feat(social): add social API endpoints"
```

---

## Task 4: Create Friend Components

**Files:**
- Create: `mobile/components/social/FriendCard.tsx`
- Create: `mobile/components/social/FriendRequestCard.tsx`
- Create: `mobile/components/social/UserSearchResult.tsx`

**Step 1: Create FriendCard**

Create `mobile/components/social/FriendCard.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MessageCircle, UserMinus, Flame } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Friend, FriendStatus } from '@/types/social';

interface FriendCardProps {
  friend: Friend;
  onPress?: () => void;
  onMessage?: () => void;
  onRemove?: () => void;
}

const statusColors: Record<FriendStatus, string> = {
  online: '#22C55E',
  studying: '#F59E0B',
  offline: '#9CA3AF',
};

export function FriendCard({ friend, onPress, onMessage, onRemove }: FriendCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={styles.avatarText}>
            {friend.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColors[friend.status] },
          ]}
        />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {friend.name}
        </Text>
        <View style={styles.stats}>
          <Text style={[styles.level, { color: colors.textSecondary }]}>
            Level {friend.level}
          </Text>
          {friend.streak > 0 && (
            <View style={styles.streak}>
              <Flame size={12} color="#F59E0B" />
              <Text style={[styles.streakText, { color: colors.textSecondary }]}>
                {friend.streak}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {onMessage && (
          <Pressable onPress={onMessage} style={styles.actionButton}>
            <MessageCircle size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {onRemove && (
          <Pressable onPress={onRemove} style={styles.actionButton}>
            <UserMinus size={20} color={colors.error} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  level: {
    fontSize: 12,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  streakText: {
    fontSize: 12,
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
});
```

**Step 2: Create FriendRequestCard**

Create `mobile/components/social/FriendRequestCard.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { FriendRequest } from '@/types/social';
import { Button } from '@/components/ui';

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

export function FriendRequestCard({
  request,
  onAccept,
  onDecline,
  onCancel,
}: FriendRequestCardProps) {
  const { colors, isDark } = useTheme();
  const isIncoming = request.direction === 'incoming';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {request.user.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {request.user.name}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isIncoming ? 'Wants to be friends' : 'Request sent'}
        </Text>
      </View>

      {isIncoming ? (
        <View style={styles.actions}>
          <Button
            size="sm"
            variant="primary"
            icon={Check}
            onPress={onAccept}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onPress={onDecline}
          >
            Decline
          </Button>
        </View>
      ) : (
        <Button size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
```

**Step 3: Create UserSearchResult**

Create `mobile/components/social/UserSearchResult.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { UserPlus, Check } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { UserPreview } from '@/types/social';
import { Button } from '@/components/ui';

interface UserSearchResultProps {
  user: UserPreview;
  isFriend?: boolean;
  isPending?: boolean;
  onAddFriend?: () => void;
  onPress?: () => void;
}

export function UserSearchResult({
  user,
  isFriend = false,
  isPending = false,
  onAddFriend,
  onPress,
}: UserSearchResultProps) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {user.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {user.name}
        </Text>
        <Text style={[styles.level, { color: colors.textSecondary }]}>
          Level {user.level}
        </Text>
      </View>

      {isFriend ? (
        <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
          <Check size={16} color={colors.success} />
          <Text style={[styles.badgeText, { color: colors.success }]}>
            Friends
          </Text>
        </View>
      ) : isPending ? (
        <View style={[styles.badge, { backgroundColor: colors.brandLight }]}>
          <Text style={[styles.badgeText, { color: colors.brand }]}>
            Pending
          </Text>
        </View>
      ) : (
        <Button
          size="sm"
          variant="outline"
          icon={UserPlus}
          onPress={onAddFriend}
        >
          Add
        </Button>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  level: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

**Step 4: Create index**

Create `mobile/components/social/index.ts`:
```typescript
export { FriendCard } from './FriendCard';
export { FriendRequestCard } from './FriendRequestCard';
export { UserSearchResult } from './UserSearchResult';
```

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/social/ && git commit -m "feat(social): add friend components"
```

---

## Task 5: Create Friends Screen

**Files:**
- Create: `mobile/app/(student)/social/index.tsx`
- Create: `mobile/app/(student)/social/_layout.tsx`
- Create: `mobile/app/(student)/social/friends.tsx`
- Create: `mobile/app/(student)/social/search.tsx`

**Step 1: Create layout**

Create `mobile/app/(student)/social/_layout.tsx`:
```typescript
import { Stack } from 'expo-router';

export default function SocialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="search" />
      <Stack.Screen name="groups" />
    </Stack>
  );
}
```

**Step 2: Create social hub**

Create `mobile/app/(student)/social/index.tsx`:
```typescript
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, UserPlus, UsersRound, Bell } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Card, PressableCard } from '@/components/ui';

export default function SocialHubScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, groups } = useSocialStore();

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const incomingRequests = pendingRequests.filter(
    (r) => r.direction === 'incoming'
  ).length;

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Social
        </Text>

        <View style={styles.grid}>
          {/* Friends */}
          <PressableCard
            variant="outline"
            className={`${cardBg}`}
            style={styles.gridItem}
            onPress={() => router.push('/social/friends')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.brandLight }]}>
              <Users size={24} color={colors.brand} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Friends
            </Text>
            <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
              {friends.length}
            </Text>
          </PressableCard>

          {/* Add Friends */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/social/search')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.successLight }]}>
              <UserPlus size={24} color={colors.success} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Add Friends
            </Text>
            {incomingRequests > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{incomingRequests}</Text>
              </View>
            )}
          </PressableCard>

          {/* Groups */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/social/groups')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.warningLight }]}>
              <UsersRound size={24} color={colors.warning} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Groups
            </Text>
            <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
              {groups.length}
            </Text>
          </PressableCard>

          {/* Notifications */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/notifications')}
          >
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Bell size={24} color={colors.textMuted} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Notifications
            </Text>
          </PressableCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardCount: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
```

**Step 3: Create friends list**

Create `mobile/app/(student)/social/friends.tsx`:
```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, UserPlus } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Button, Card } from '@/components/ui';
import { FriendCard, FriendRequestCard } from '@/components/social';

export default function FriendsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, removeFriend, removePendingRequest, addFriend } =
    useSocialStore();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const incomingRequests = pendingRequests.filter((r) => r.direction === 'incoming');
  const outgoingRequests = pendingRequests.filter((r) => r.direction === 'outgoing');

  const handleRemoveFriend = (userId: string, name: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(userId),
        },
      ]
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Friends</Text>
        <Button
          variant="ghost"
          icon={UserPlus}
          onPress={() => router.push('/social/search')}
        />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        <Button
          variant={activeTab === 'friends' ? 'primary' : 'ghost'}
          size="sm"
          onPress={() => setActiveTab('friends')}
          className="flex-1"
        >
          Friends ({friends.length})
        </Button>
        <Button
          variant={activeTab === 'requests' ? 'primary' : 'ghost'}
          size="sm"
          onPress={() => setActiveTab('requests')}
          className="flex-1"
        >
          Requests ({incomingRequests.length})
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {activeTab === 'friends' ? (
          friends.length > 0 ? (
            friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onRemove={() => handleRemoveFriend(friend.id, friend.name)}
              />
            ))
          ) : (
            <Card variant="outline" className={`items-center py-8 ${cardBg}`}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No friends yet. Add some!
              </Text>
              <Button
                variant="primary"
                size="sm"
                icon={UserPlus}
                className="mt-4"
                onPress={() => router.push('/social/search')}
              >
                Find Friends
              </Button>
            </Card>
          )
        ) : (
          <>
            {incomingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Incoming
                </Text>
                {incomingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onAccept={() => {
                      // In real app, call API then update store
                      addFriend({
                        ...request.user,
                        addedAt: new Date().toISOString(),
                        status: 'offline',
                      });
                      removePendingRequest(request.id);
                    }}
                    onDecline={() => removePendingRequest(request.id)}
                  />
                ))}
              </View>
            )}

            {outgoingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Sent
                </Text>
                {outgoingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onCancel={() => removePendingRequest(request.id)}
                  />
                ))}
              </View>
            )}

            {pendingRequests.length === 0 && (
              <Card variant="outline" className={`items-center py-8 ${cardBg}`}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending requests
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
```

**Step 4: Create search screen**

Create `mobile/app/(student)/social/search.tsx`:
```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Button, Card } from '@/components/ui';
import { UserSearchResult } from '@/components/social';
import { UserPreview } from '@/types/social';

// Mock search results for demo
const MOCK_USERS: UserPreview[] = [
  { id: '1', name: 'Alex Chen', level: 15, streak: 12 },
  { id: '2', name: 'Sarah Kim', level: 12, streak: 5 },
  { id: '3', name: 'Mike Johnson', level: 8, streak: 0 },
  { id: '4', name: 'Emma Davis', level: 20, streak: 45 },
];

export default function SearchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, addPendingRequest } = useSocialStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPreview[]>([]);

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';

  const friendIds = friends.map((f) => f.id);
  const pendingIds = pendingRequests.map((r) => r.user.id);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length > 0) {
      // In real app, call API
      const filtered = MOCK_USERS.filter((u) =>
        u.name.toLowerCase().includes(text.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, []);

  const handleAddFriend = (user: UserPreview) => {
    addPendingRequest({
      id: `req-${Date.now()}`,
      user,
      sentAt: new Date().toISOString(),
      direction: 'outgoing',
    });
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Find Friends
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
              borderColor: colors.border,
            },
          ]}
        >
          <Search size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search by name..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
          />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {results.length > 0 ? (
          results.map((user) => (
            <UserSearchResult
              key={user.id}
              user={user}
              isFriend={friendIds.includes(user.id)}
              isPending={pendingIds.includes(user.id)}
              onAddFriend={() => handleAddFriend(user)}
            />
          ))
        ) : query.length > 0 ? (
          <Card variant="outline" className="items-center py-8">
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No users found for "{query}"
            </Text>
          </Card>
        ) : (
          <Card variant="outline" className="items-center py-8">
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for friends by name
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
```

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/social/ && git commit -m "feat(social): add social hub, friends, and search screens"
```

---

## Task 6: Create Notifications System

**Files:**
- Create: `mobile/lib/notifications.ts`
- Create: `mobile/app/(student)/notifications.tsx`

**Step 1: Create notifications lib**

Create `mobile/lib/notifications.ts`:
```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'group_invite'
  | 'quiz_shared'
  | 'streak_reminder'
  | 'achievement_unlocked'
  | 'level_up';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('No EAS project ID found');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: trigger ?? null,
  });
}

export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
```

**Step 2: Create notifications screen**

Create `mobile/app/(student)/notifications.tsx`:
```typescript
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Trophy,
  Flame,
  Users,
  Share2,
  Check,
} from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Card } from '@/components/ui';

// Mock notifications
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'friend_request',
    title: 'New Friend Request',
    body: 'Alex Chen wants to be your friend',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    body: 'You earned "Week Warrior" for a 7-day streak',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '3',
    type: 'quiz_shared',
    title: 'Quiz Shared',
    body: 'Sarah shared "Biology 101" with Study Group',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: '4',
    type: 'level_up',
    title: 'Level Up!',
    body: 'Congratulations! You reached Level 10',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const iconMap: Record<string, typeof Trophy> = {
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  achievement_unlocked: Trophy,
  streak_reminder: Flame,
  group_invite: Users,
  quiz_shared: Share2,
  level_up: Trophy,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Notifications
        </Text>
        <Button variant="ghost" icon={Check} onPress={() => {}}>
          Mark all
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {MOCK_NOTIFICATIONS.map((notification) => {
          const Icon = iconMap[notification.type] || Trophy;
          return (
            <Pressable
              key={notification.id}
              style={[
                styles.notificationItem,
                {
                  backgroundColor: notification.read
                    ? isDark
                      ? '#1F2937'
                      : '#FFFFFF'
                    : isDark
                    ? '#312E81'
                    : '#EEF2FF',
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                ]}
              >
                <Icon size={20} color={colors.brand} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                  {notification.title}
                </Text>
                <Text style={[styles.notificationBody, { color: colors.textSecondary }]}>
                  {notification.body}
                </Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {formatTime(notification.timestamp)}
                </Text>
              </View>
              {!notification.read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationBody: {
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
```

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/notifications.ts app/\(student\)/notifications.tsx && git commit -m "feat(social): add notifications system and screen"
```

---

## Summary

Track 4 (Social) is complete when all tasks pass. The following are now available:

- **SocialStore:** Friends, groups, activity state management
- **Social API:** Endpoints for friends, groups, comments
- **FriendCard/RequestCard:** Friend display and request handling
- **UserSearchResult:** Search result with add friend action
- **Social Hub:** Navigation to friends, groups, notifications
- **Friends Screen:** Friend list with tabs for requests
- **Search Screen:** Find and add friends
- **Notifications:** Push notification setup and in-app display

The social track integrates with gamification for friend-filtered leaderboards.
