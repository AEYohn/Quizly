# Quizly Mobile App - Complete Feature Expansion

**Date:** 2026-01-29
**Target Users:** College students & professional learners
**Approach:** Parallel tracks with multiple agents
**Timeline:** Full product build (months of runway)

---

## Overview

This design covers adding all missing features to the Quizly mobile app, organized into parallel workstreams that can be developed simultaneously by multiple agents.

### Track Summary

| Track | Focus | Key Deliverables |
|-------|-------|------------------|
| **Foundation** | Shared infrastructure | Dark mode, offline support, settings |
| **Study** | Learning effectiveness | Spaced repetition, flashcards, analytics |
| **Gamification** | Engagement & retention | XP, levels, achievements, streaks, leaderboards |
| **Content** | Quiz variety | New question types, PDF upload |
| **Social** | Community | Friends, groups, sharing, comments |

---

## Phase 0: Shared Foundation (Build First)

Complete this before splitting into parallel tracks. All other tracks depend on this infrastructure.

### Theme System

**Files:**
- `providers/ThemeProvider.tsx`
- `lib/theme.ts`

**ThemeProvider.tsx:**
```typescript
interface ThemeContextValue {
  isDark: boolean;
  colors: ColorTokens;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}
```

Reads from `userStore.preferences.theme`, listens to system preference changes via `Appearance` API.

**theme.ts color tokens:**
```typescript
interface ColorTokens {
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
  success: string;
  warning: string;
  error: string;

  // Components
  cardBg: string;
  border: string;
  inputBg: string;
}

const lightColors: ColorTokens = { /* ... */ };
const darkColors: ColorTokens = { /* ... */ };
```

Existing components swap hardcoded colors to theme tokens. NativeWind `dark:` prefix handles most styling.

### Offline Layer

**Files:**
- `lib/offlineQueue.ts`
- `hooks/useNetworkStatus.ts`

**offlineQueue.ts:**
```typescript
interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  queue: QueuedMutation[];

  add(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>): void;
  process(): Promise<void>;  // Called when back online
  clear(): void;
}
```

Persists to AsyncStorage. Replays mutations in order when network returns.

**useNetworkStatus.ts:**
```typescript
function useNetworkStatus(): {
  isOnline: boolean;
  isOffline: boolean;
}
```

Uses `@react-native-community/netinfo` (needs to be added to dependencies).

### Shared Types

**Files:**
- `types/index.ts`
- `types/progression.ts`
- `types/study.ts`
- `types/social.ts`
- `types/questions.ts`

Central type definitions that all tracks reference. See individual track sections for type details.

### Settings Screen

**File:** `app/(student)/profile.tsx` (update existing stub)

Sections:
1. **Account** - Display name, email, avatar (read-only for now)
2. **Appearance** - Theme picker (Light / Dark / System)
3. **Notifications** - Master toggle, category toggles
4. **Sound & Haptics** - Sound effects, vibration (already in userStore)
5. **Account Actions** - Sign out, delete account

---

## Track 1: Study Effectiveness

**Owned by:** Study Agent
**Dependencies:** Foundation complete

### Spaced Repetition Engine

**File:** `stores/studyStore.ts`

```typescript
interface CardReview {
  cardId: string;
  visitorId: string;
  easeFactor: number;      // SM-2 algorithm, default 2.5
  interval: number;        // Days until next review
  repetitions: number;     // Consecutive correct answers
  nextReviewDate: string;  // ISO date string
  lastReviewDate: string;  // ISO date string
}

interface DailyStudyStats {
  date: string;            // YYYY-MM-DD
  cardsReviewed: number;
  correctCount: number;
  totalTime: number;       // seconds
}

interface StudyState {
  // State
  cardReviews: Record<string, CardReview>;
  dailyStats: DailyStudyStats[];
  currentSession: {
    startedAt: string;
    cardsReviewed: string[];
    correctCount: number;
  } | null;

  // Actions
  startSession: (quizId: string) => void;
  recordReview: (cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  endSession: () => DailyStudyStats;
  getDueCards: (quizId?: string) => CardReview[];
  getStudyStats: () => {
    dueToday: number;
    dueTomorrow: number;
    mastered: number;
    learning: number;
    studyStreak: number;
  };
}
```

**SM-2 Algorithm Implementation:**
```typescript
function calculateNextReview(card: CardReview, quality: number): CardReview {
  // quality: 0-2 = incorrect, 3-5 = correct with varying ease

  if (quality < 3) {
    // Reset on incorrect
    return {
      ...card,
      repetitions: 0,
      interval: 1,
      lastReviewDate: today(),
      nextReviewDate: addDays(today(), 1),
    };
  }

  const newEF = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const newReps = card.repetitions + 1;

  let newInterval: number;
  if (newReps === 1) newInterval = 1;
  else if (newReps === 2) newInterval = 6;
  else newInterval = Math.round(card.interval * newEF);

  return {
    ...card,
    easeFactor: newEF,
    repetitions: newReps,
    interval: newInterval,
    lastReviewDate: today(),
    nextReviewDate: addDays(today(), newInterval),
  };
}
```

### Flashcard Components

**Files:**
- `components/study/FlashcardDeck.tsx`
- `components/study/FlashcardItem.tsx`
- `components/study/StudySessionSummary.tsx`

**FlashcardDeck.tsx:**
- Swipeable card stack using `react-native-gesture-handler`
- Swipe right = "Got it" (quality 4)
- Swipe left = "Again" (quality 1)
- Swipe up = "Easy" (quality 5)
- Tap to flip card (question → answer)
- Progress bar: cards remaining / total
- "Undo" button for last card

**FlashcardItem.tsx:**
- Front: Question text, image if present
- Back: Answer, explanation
- Flip animation using `react-native-reanimated`

**StudySessionSummary.tsx:**
- Cards reviewed count
- Accuracy percentage
- Time spent
- Cards due tomorrow
- "Continue" or "Done" buttons

### Analytics Screen

**Files:**
- `app/(student)/analytics/index.tsx`
- `components/analytics/HeatmapCalendar.tsx`
- `components/analytics/RetentionChart.tsx`
- `components/analytics/SubjectBreakdown.tsx`
- `components/analytics/StudyTimeChart.tsx`

**analytics/index.tsx:**
Scrollable dashboard with:
1. Study streak banner
2. Heatmap calendar (last 3 months)
3. Retention curve chart
4. Subject breakdown
5. Weekly study time chart

**HeatmapCalendar.tsx:**
- GitHub-style contribution grid
- Color intensity = cards reviewed that day
- Tap day → show details modal

**RetentionChart.tsx:**
- Horizontal bar chart showing:
  - New (never reviewed)
  - Learning (interval < 7 days)
  - Reviewing (interval 7-30 days)
  - Mastered (interval > 30 days)

**SubjectBreakdown.tsx:**
- Pie or bar chart by quiz subject
- Shows accuracy per subject
- Identifies weak areas

### Study Packets

**File:** `components/study/StudyPacket.tsx`

AI-curated daily study recommendations:
```typescript
interface StudyPacket {
  id: string;
  date: string;
  sections: {
    title: string;           // "Due for Review", "Weak Concepts", "New Material"
    description: string;
    cards: CardReview[];
    estimatedTime: number;   // minutes
  }[];
  totalCards: number;
  estimatedTime: number;
}
```

Dashboard widget shows today's packet with progress ring.

### New API Endpoints Needed

```
GET  /students/study/reviews           # Get all card reviews for user
POST /students/study/reviews           # Sync local reviews to server
GET  /students/study/stats             # Aggregated study statistics
POST /students/study/sessions          # Record completed session
```

---

## Track 2: Gamification

**Owned by:** Gamification Agent
**Dependencies:** Foundation complete

### Progression Store

**File:** `stores/progressionStore.ts`

```typescript
type XPSource =
  | 'quiz_complete'      // +50 XP
  | 'perfect_score'      // +100 XP bonus
  | 'daily_login'        // +25 XP
  | 'card_review'        // +5 XP per card
  | 'quiz_created'       // +75 XP
  | 'streak_bonus'       // +10 XP per streak day
  | 'achievement';       // Varies

interface XPEvent {
  source: XPSource;
  amount: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlockedAt?: string;
  progress?: number;      // 0-100 for progressive achievements
  requirement: number;    // Target value
}

interface ProgressionState {
  // State
  xp: number;
  level: number;
  xpHistory: XPEvent[];
  dailyStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  achievements: Achievement[];

  // Computed
  xpToNextLevel: number;
  xpProgress: number;     // 0-1 progress to next level

  // Actions
  addXP: (amount: number, source: XPSource, metadata?: Record<string, unknown>) => void;
  checkAndUpdateStreak: () => { maintained: boolean; newStreak: number };
  unlockAchievement: (id: string) => void;
  checkAchievements: () => Achievement[];  // Returns newly unlocked
}
```

**Level Curve:**
```typescript
function xpRequiredForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Level 1: 100 XP
// Level 2: 283 XP
// Level 5: 1,118 XP
// Level 10: 3,162 XP
// Level 20: 8,944 XP
```

### Daily Streaks

**Logic in progressionStore:**
```typescript
checkAndUpdateStreak(): { maintained: boolean; newStreak: number } {
  const today = getDateString(new Date());
  const yesterday = getDateString(addDays(new Date(), -1));

  if (this.lastActiveDate === today) {
    // Already logged in today
    return { maintained: true, newStreak: this.dailyStreak };
  }

  if (this.lastActiveDate === yesterday) {
    // Streak continues
    const newStreak = this.dailyStreak + 1;
    this.set({
      dailyStreak: newStreak,
      lastActiveDate: today,
      longestStreak: Math.max(this.longestStreak, newStreak)
    });
    this.addXP(10 * newStreak, 'streak_bonus');
    return { maintained: true, newStreak };
  }

  // Streak broken
  this.set({ dailyStreak: 1, lastActiveDate: today });
  return { maintained: false, newStreak: 1 };
}
```

**Streak UI components:**
- `components/progression/StreakBadge.tsx` - Fire icon + count
- `components/progression/StreakCalendar.tsx` - Month view with active days highlighted

### Achievements System

**File:** `lib/achievements.ts`

```typescript
const ACHIEVEMENTS: Achievement[] = [
  // Learning
  { id: 'first_quiz', title: 'First Steps', description: 'Complete your first quiz', tier: 'bronze', requirement: 1 },
  { id: 'quiz_10', title: 'Getting Started', description: 'Complete 10 quizzes', tier: 'silver', requirement: 10 },
  { id: 'quiz_100', title: 'Quiz Master', description: 'Complete 100 quizzes', tier: 'gold', requirement: 100 },

  // Mastery
  { id: 'perfect_1', title: 'Perfectionist', description: 'Get a perfect score', tier: 'bronze', requirement: 1 },
  { id: 'perfect_10', title: 'Flawless', description: 'Get 10 perfect scores', tier: 'silver', requirement: 10 },

  // Consistency
  { id: 'streak_7', title: 'Week Warrior', description: '7-day study streak', tier: 'bronze', requirement: 7 },
  { id: 'streak_30', title: 'Monthly Master', description: '30-day study streak', tier: 'silver', requirement: 30 },
  { id: 'streak_100', title: 'Unstoppable', description: '100-day study streak', tier: 'gold', requirement: 100 },
  { id: 'streak_365', title: 'Legendary', description: '365-day study streak', tier: 'platinum', requirement: 365 },

  // Creation
  { id: 'create_1', title: 'Creator', description: 'Create your first quiz', tier: 'bronze', requirement: 1 },
  { id: 'create_10', title: 'Prolific', description: 'Create 10 quizzes', tier: 'silver', requirement: 10 },

  // Social (requires Social track)
  { id: 'share_1', title: 'Sharing is Caring', description: 'Share a quiz', tier: 'bronze', requirement: 1 },
  { id: 'popular', title: 'Popular', description: 'Have a quiz used by 10 others', tier: 'gold', requirement: 10 },

  // Study
  { id: 'cards_100', title: 'Card Shark', description: 'Review 100 flashcards', tier: 'bronze', requirement: 100 },
  { id: 'cards_1000', title: 'Memory Master', description: 'Review 1000 flashcards', tier: 'silver', requirement: 1000 },
  { id: 'mastered_50', title: 'True Understanding', description: 'Master 50 cards', tier: 'gold', requirement: 50 },
];
```

**Components:**
- `components/progression/AchievementBadge.tsx` - Icon with tier color, locked/unlocked state
- `components/progression/AchievementToast.tsx` - Celebratory popup when earned
- `components/progression/AchievementList.tsx` - Grid view of all achievements

### Leaderboards

**File:** `app/(student)/leaderboard.tsx`

Tabs:
1. **Weekly** - XP earned this week (resets Monday)
2. **All-Time** - Total XP
3. **Friends** - Only friends (integrates with Social track)

```typescript
interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  isCurrentUser: boolean;
}
```

**Components:**
- `components/progression/LeaderboardRow.tsx`
- `components/progression/LeaderboardPodium.tsx` - Top 3 with medals

### XP & Level UI

**Components:**
- `components/progression/XPBar.tsx` - Progress bar with level badge
- `components/progression/LevelUpModal.tsx` - Celebration animation on level up
- `components/progression/XPGainToast.tsx` - "+50 XP" floating text

### New API Endpoints Needed

```
GET  /students/progression              # Get XP, level, achievements
POST /students/progression/xp           # Record XP gain
GET  /students/leaderboard              # Get leaderboard data
GET  /students/leaderboard/friends      # Friends-only leaderboard
```

---

## Track 3: Content

**Owned by:** Content Agent
**Dependencies:** Foundation complete

### Extended Question Types

**File:** `types/questions.ts`

```typescript
type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'code'
  | 'ordering';

// Base interface all questions share
interface BaseQuestion {
  id?: string;
  question_type: QuestionType;
  points: number;
  time_limit: number;
  explanation?: string;
  image_url?: string;
  order_index?: number;
}

// Existing
interface MultipleChoiceQuestion extends BaseQuestion {
  question_type: 'multiple_choice';
  question_text: string;
  options: Record<string, string>;  // { "A": "Option 1", "B": "Option 2", ... }
  correct_answer: string;           // "A", "B", etc.
}

// New
interface TrueFalseQuestion extends BaseQuestion {
  question_type: 'true_false';
  statement: string;
  correct_answer: boolean;
}

interface FillBlankQuestion extends BaseQuestion {
  question_type: 'fill_blank';
  text: string;                          // "The ___ is the powerhouse of the cell"
  blanks: string[];                      // ["mitochondria"]
  case_sensitive: boolean;
  accept_alternatives?: string[][];      // [["mitochondria", "mitochondrion"]]
}

interface MatchingQuestion extends BaseQuestion {
  question_type: 'matching';
  instruction?: string;
  pairs: { id: string; left: string; right: string }[];
}

interface CodeQuestion extends BaseQuestion {
  question_type: 'code';
  prompt: string;
  language: 'python' | 'javascript' | 'typescript' | 'sql' | 'java';
  starter_code?: string;
  test_cases: {
    input: string;
    expected_output: string;
    is_hidden?: boolean;
  }[];
  solution?: string;
}

interface OrderingQuestion extends BaseQuestion {
  question_type: 'ordering';
  instruction: string;                   // "Arrange these events in chronological order"
  items: { id: string; text: string }[];
  correct_order: string[];               // Array of item IDs in correct order
}

type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchingQuestion
  | CodeQuestion
  | OrderingQuestion;
```

### Question Components

**Files:**
```
components/questions/
  QuestionRenderer.tsx       # Routes to correct component by type
  MultipleChoiceCard.tsx     # Existing, may need updates
  TrueFalseCard.tsx
  FillBlankCard.tsx
  MatchingCard.tsx
  CodeEditorCard.tsx
  OrderingCard.tsx
  QuestionFeedback.tsx       # Shared correct/incorrect feedback
```

**QuestionRenderer.tsx:**
```typescript
interface QuestionRendererProps {
  question: Question;
  onAnswer: (answer: unknown) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}

function QuestionRenderer({ question, onAnswer, ...props }: QuestionRendererProps) {
  switch (question.question_type) {
    case 'multiple_choice':
      return <MultipleChoiceCard question={question} onAnswer={onAnswer} {...props} />;
    case 'true_false':
      return <TrueFalseCard question={question} onAnswer={onAnswer} {...props} />;
    case 'fill_blank':
      return <FillBlankCard question={question} onAnswer={onAnswer} {...props} />;
    case 'matching':
      return <MatchingCard question={question} onAnswer={onAnswer} {...props} />;
    case 'code':
      return <CodeEditorCard question={question} onAnswer={onAnswer} {...props} />;
    case 'ordering':
      return <OrderingCard question={question} onAnswer={onAnswer} {...props} />;
  }
}
```

**TrueFalseCard.tsx:**
- Statement text display
- Two large buttons: TRUE / FALSE
- Color feedback on answer

**FillBlankCard.tsx:**
- Render text with inline TextInputs for blanks
- Support multiple blanks
- Validate against accepted answers

**MatchingCard.tsx:**
- Left column: items to match from
- Right column: shuffled items to match to
- Tap left, then tap right to create match
- Lines connecting matched pairs
- Undo last match button

**CodeEditorCard.tsx:**
- Syntax-highlighted code editor (use `react-native-code-editor` or similar)
- Language selector (if multiple supported)
- "Run" button to test against visible test cases
- Test case results display
- Note: Full code execution needs backend support

**OrderingCard.tsx:**
- Draggable list using `react-native-draggable-flatlist`
- Visual feedback during drag
- "Check" button to verify order

### PDF Upload

**Updates to:** `app/(student)/create/index.tsx`

Complete the existing "Coming Soon" implementation:

```typescript
async function handlePDFUpload() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return;

  const file = result.assets[0];
  setIsProcessing(true);

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Send to AI for question generation
  const response = await aiApi.chatGenerate({
    message: "Generate questions from this PDF document",
    pdf_base64: base64,
  }, token);

  setGeneratedQuestions(response.questions);
  setIsProcessing(false);
}
```

**UI additions:**
- Upload progress indicator
- "Processing PDF..." state with animation
- Error handling for corrupt/unsupported PDFs
- File size limit warning (suggest < 10MB)

### AI Generation Updates

Update AI chat interface to support new question types:

**Prompt suggestions:**
- "Generate 5 true/false questions about [topic]"
- "Create a matching exercise for [vocabulary list]"
- "Make a Python coding challenge about [concept]"
- "Create an ordering question for [historical events]"

**Backend updates needed:**
- AI prompt engineering to output correct schema per type
- Validation that generated questions match type schema

### Question Editor Updates

**File:** `components/create/QuestionEditor.tsx`

Add editors for each new type:
- Type selector dropdown
- Type-specific form fields
- Preview of how question will appear

### New Dependencies

```json
{
  "expo-file-system": "^x.x.x",
  "react-native-draggable-flatlist": "^x.x.x"
}
```

### Backend Updates Needed

- Update question schema to support new types
- Code execution sandbox for CodeQuestion (or use third-party like Judge0)
- PDF text extraction service

---

## Track 4: Social

**Owned by:** Social Agent
**Dependencies:** Foundation complete

### Social Store

**File:** `stores/socialStore.ts`

```typescript
interface UserPreview {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  streak: number;
}

interface Friend extends UserPreview {
  addedAt: string;
  status: 'online' | 'offline' | 'studying';
}

interface FriendRequest {
  id: string;
  user: UserPreview;
  sentAt: string;
  direction: 'incoming' | 'outgoing';
}

interface StudyGroup {
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

interface QuizComment {
  id: string;
  quizId: string;
  user: UserPreview;
  text: string;
  rating?: number;       // 1-5 stars
  createdAt: string;
}

interface SocialState {
  // State
  friends: Friend[];
  pendingRequests: FriendRequest[];
  groups: StudyGroup[];
  blockedUsers: string[];

  // Actions
  fetchFriends: () => Promise<void>;
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;

  fetchGroups: () => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<StudyGroup>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  inviteToGroup: (groupId: string, userId: string) => Promise<void>;
  shareQuizToGroup: (groupId: string, quizId: string) => Promise<void>;
}
```

### Friend System

**Files:**
```
app/(student)/social/
  index.tsx              # Social hub - tabs for Friends, Groups, Activity
  friends.tsx            # Friend list & requests
  search.tsx             # Search for users
  profile/[id].tsx       # View another user's profile

components/social/
  FriendCard.tsx
  FriendRequestCard.tsx
  UserSearchResult.tsx
  UserProfileHeader.tsx
```

**friends.tsx:**
- Tab: "Friends" - list of friends with status indicators
- Tab: "Requests" - incoming/outgoing with accept/decline buttons
- FAB: "Add Friend" → search screen
- Pull to refresh

**FriendCard.tsx:**
```typescript
interface FriendCardProps {
  friend: Friend;
  onPress: () => void;
  onRemove: () => void;
}
```
- Avatar, name, level badge
- Status indicator (online/offline/studying)
- Current streak display
- Swipe to reveal remove button

**search.tsx:**
- Search input with debounce
- Results list with "Add Friend" button
- Shows mutual friends count
- Recent searches

### Study Groups

**Files:**
```
app/(student)/social/groups/
  index.tsx              # List of your groups
  [id].tsx               # Group detail
  create.tsx             # Create new group

components/social/
  GroupCard.tsx
  GroupMemberList.tsx
  GroupQuizList.tsx
```

**groups/index.tsx:**
- Grid/list of groups you're in
- Member count, recent activity preview
- "Create Group" button

**groups/[id].tsx:**
- Header: Group name, description, member count
- Tab: "Members" - list with roles (owner, member)
- Tab: "Quizzes" - shared quizzes with "Practice" button
- Tab: "Leaderboard" - group-only rankings
- Owner actions: invite, remove members, delete group
- Member actions: leave group, share quiz

**GroupCard.tsx:**
- Group name, member avatars (stacked)
- Recent activity indicator
- Tap to open group

### Quiz Sharing & Comments

**Updates to:** `app/(student)/study/[id].tsx`

Add sharing functionality:
```typescript
async function handleShare() {
  // Option 1: Share to group
  // Option 2: Generate shareable link
  // Option 3: Share via system share sheet

  const shareOptions = await showActionSheet([
    'Share to Group',
    'Copy Link',
    'Share via...',
  ]);

  // Handle selection
}
```

**New file:** `components/social/QuizComments.tsx`

```typescript
interface QuizCommentsProps {
  quizId: string;
}

function QuizComments({ quizId }: QuizCommentsProps) {
  // Fetch and display comments
  // Star rating input
  // Comment input
  // List of comments with user avatars
}
```

- Average rating display (stars)
- "Write a review" button
- Comment list sorted by recent
- Report inappropriate content button

### Activity Feed

**File:** `components/social/ActivityFeed.tsx`

Show friend activity:
- "Alex completed Biology 101 with 95%"
- "Jordan created a new quiz: JavaScript Basics"
- "Sam achieved a 30-day streak!"

```typescript
interface ActivityItem {
  id: string;
  user: UserPreview;
  type: 'quiz_complete' | 'quiz_created' | 'achievement' | 'streak' | 'level_up';
  metadata: Record<string, unknown>;
  timestamp: string;
}
```

### Notifications

**Files:**
- `lib/notifications.ts`
- `app/(student)/notifications.tsx`
- `components/social/NotificationItem.tsx`

**notifications.ts:**
```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

function setupNotificationHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'group_invite'
  | 'quiz_shared'
  | 'streak_reminder'
  | 'achievement_unlocked'
  | 'level_up';
```

**notifications.tsx:**
- In-app notification center
- Mark as read functionality
- Clear all button
- Grouped by day

### New API Endpoints Needed

```
# Friends
GET    /social/friends                    # List friends
POST   /social/friends/request            # Send friend request
POST   /social/friends/request/:id/accept # Accept request
DELETE /social/friends/request/:id        # Decline/cancel request
DELETE /social/friends/:id                # Remove friend
GET    /social/users/search?q=            # Search users

# Groups
GET    /social/groups                     # List your groups
POST   /social/groups                     # Create group
GET    /social/groups/:id                 # Get group details
PUT    /social/groups/:id                 # Update group
DELETE /social/groups/:id                 # Delete group
POST   /social/groups/:id/join            # Join group
POST   /social/groups/:id/leave           # Leave group
POST   /social/groups/:id/invite          # Invite user
POST   /social/groups/:id/quizzes         # Share quiz to group

# Comments
GET    /quizzes/:id/comments              # Get comments
POST   /quizzes/:id/comments              # Add comment
DELETE /quizzes/:id/comments/:commentId   # Delete comment
POST   /quizzes/:id/comments/:id/report   # Report comment

# Activity
GET    /social/activity                   # Friend activity feed

# Notifications
GET    /notifications                     # Get notifications
PUT    /notifications/:id/read            # Mark as read
POST   /notifications/register            # Register push token
```

### New Dependencies

```json
{
  "expo-notifications": "^x.x.x"
}
```

---

## Integration Points

These areas require coordination between tracks:

### 1. Dashboard Updates

All tracks add widgets to the dashboard. Define a widget system:

**File:** `components/dashboard/DashboardWidget.tsx`

```typescript
interface DashboardWidget {
  id: string;
  title: string;
  priority: number;      // Lower = higher on page
  component: React.ComponentType;
  track: 'study' | 'gamification' | 'social';
}
```

Widgets by track:
- **Study:** Due cards count, study streak, analytics preview
- **Gamification:** XP bar, level, daily streak, recent achievements
- **Social:** Friend activity, group updates

### 2. Quiz Completion Events

When a quiz/practice session completes, multiple tracks need to respond:

**File:** `lib/events.ts`

```typescript
type AppEvent =
  | { type: 'QUIZ_COMPLETED'; payload: { quizId: string; score: number; perfect: boolean } }
  | { type: 'CARD_REVIEWED'; payload: { cardId: string; quality: number } }
  | { type: 'QUIZ_CREATED'; payload: { quizId: string } }
  | { type: 'DAILY_LOGIN'; payload: { date: string } };

const eventBus = new EventEmitter();

// Gamification listens for QUIZ_COMPLETED to award XP
// Study listens for CARD_REVIEWED to update spaced repetition
// Social listens for QUIZ_COMPLETED to update activity feed
```

### 3. Leaderboard Friend Filter

Gamification's leaderboard needs Social's friend list:

```typescript
// In leaderboard.tsx
const { friends } = useSocialStore();
const friendIds = friends.map(f => f.id);

// Pass to API
const leaderboard = await api.getLeaderboard({
  filter: 'friends',
  userIds: friendIds
});
```

---

## File Ownership Summary

### Foundation (Build First)
```
providers/ThemeProvider.tsx
lib/theme.ts
lib/offlineQueue.ts
lib/events.ts
hooks/useNetworkStatus.ts
types/index.ts
types/progression.ts
types/study.ts
types/social.ts
types/questions.ts
app/(student)/profile.tsx (settings)
```

### Track 1: Study
```
stores/studyStore.ts
app/(student)/analytics/
  index.tsx
components/study/
  FlashcardDeck.tsx
  FlashcardItem.tsx
  StudySessionSummary.tsx
  StudyPacket.tsx
components/analytics/
  HeatmapCalendar.tsx
  RetentionChart.tsx
  SubjectBreakdown.tsx
  StudyTimeChart.tsx
```

### Track 2: Gamification
```
stores/progressionStore.ts
lib/achievements.ts
app/(student)/leaderboard.tsx
components/progression/
  XPBar.tsx
  StreakBadge.tsx
  StreakCalendar.tsx
  AchievementBadge.tsx
  AchievementToast.tsx
  AchievementList.tsx
  LeaderboardRow.tsx
  LeaderboardPodium.tsx
  LevelUpModal.tsx
  XPGainToast.tsx
```

### Track 3: Content
```
types/questions.ts (shared, but Content owns updates)
components/questions/
  QuestionRenderer.tsx
  TrueFalseCard.tsx
  FillBlankCard.tsx
  MatchingCard.tsx
  CodeEditorCard.tsx
  OrderingCard.tsx
components/create/
  QuestionEditor.tsx (updates)
  QuestionTypeSelector.tsx
app/(student)/create/index.tsx (PDF upload updates)
```

### Track 4: Social
```
stores/socialStore.ts
lib/notifications.ts
app/(student)/social/
  index.tsx
  friends.tsx
  search.tsx
  profile/[id].tsx
  groups/
    index.tsx
    [id].tsx
    create.tsx
app/(student)/notifications.tsx
components/social/
  FriendCard.tsx
  FriendRequestCard.tsx
  UserSearchResult.tsx
  UserProfileHeader.tsx
  GroupCard.tsx
  GroupMemberList.tsx
  GroupQuizList.tsx
  QuizComments.tsx
  ActivityFeed.tsx
  NotificationItem.tsx
```

---

## Execution Order

1. **Foundation** - 1 agent, complete first
2. **Tracks 1-4** - 4 parallel agents, start after foundation
3. **Integration** - Dashboard widgets, event wiring (can be done as tracks complete)

Each track agent should:
1. Create their store first
2. Build components
3. Create screens
4. Wire up to existing navigation
5. Test in isolation
6. Coordinate for integration points

---

## Backend Coordination

New endpoints summary for backend team:

```
# Study
GET  /students/study/reviews
POST /students/study/reviews
GET  /students/study/stats
POST /students/study/sessions

# Progression
GET  /students/progression
POST /students/progression/xp
GET  /students/leaderboard
GET  /students/leaderboard/friends

# Social
GET    /social/friends
POST   /social/friends/request
POST   /social/friends/request/:id/accept
DELETE /social/friends/request/:id
DELETE /social/friends/:id
GET    /social/users/search
GET    /social/groups
POST   /social/groups
GET    /social/groups/:id
PUT    /social/groups/:id
DELETE /social/groups/:id
POST   /social/groups/:id/join
POST   /social/groups/:id/leave
POST   /social/groups/:id/invite
POST   /social/groups/:id/quizzes
GET    /quizzes/:id/comments
POST   /quizzes/:id/comments
DELETE /quizzes/:id/comments/:commentId
POST   /quizzes/:id/comments/:id/report
GET    /social/activity
GET    /notifications
PUT    /notifications/:id/read
POST   /notifications/register

# Content (updates)
- Extend question schema for new types
- PDF extraction endpoint
- Code execution sandbox
```
