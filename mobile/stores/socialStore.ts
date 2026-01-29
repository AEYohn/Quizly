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
