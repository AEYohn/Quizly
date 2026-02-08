import React from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
import { useHomeScreen } from "@/hooks/feed/useHomeScreen";

const { act } = TestRenderer;

// ── Mock store state ────────────────────────────────────────────────

let mockStoreState: Record<string, unknown>;

const mockSetHistory = jest.fn();
const mockSetHistoryLoading = jest.fn();
const mockSetSuggestions = jest.fn();
const mockSetActiveSession = jest.fn();
const mockSetTopicInput = jest.fn();
const mockSetIsLoading = jest.fn();
const mockSetError = jest.fn();
const mockSetSessionId = jest.fn();
const mockSetTopic = jest.fn();
const mockSetCards = jest.fn();
const mockSetCurrentIdx = jest.fn();
const mockSetStats = jest.fn();
const mockClearCardState = jest.fn();
const mockSetSyllabus = jest.fn();
const mockSetSelectedSubject = jest.fn();
const mockSetSyllabusLoading = jest.fn();
const mockSetSubjectResources = jest.fn();
const mockClearSyllabus = jest.fn();

function buildMockStore(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: null,
    topic: null,
    cards: [],
    currentIdx: 0,
    stats: { streak: 0, best_streak: 0, total_xp: 0, difficulty: 0.4, cards_shown: 0 },
    preferences: { difficulty: "adaptive", contentMix: "balanced", questionStyle: "mixed" },
    topicInput: "",
    notesInput: "",
    syllabus: null,
    selectedSubject: null,
    activeSyllabusNode: null,
    syllabusLoading: false,
    mastery: {},
    presence: {},
    recommendedNext: null,
    bktMastery: {},
    history: [],
    historyOverall: null,
    historyLoading: false,
    suggestions: [],
    activeSession: null,
    subjectResources: [],
    isUploadingResource: false,
    assessmentPhase: "none",
    codebaseAnalysis: null,
    codebaseLoading: false,
    githubUrlInput: "",
    result: null,
    analytics: null,
    flashcardXp: null,
    infoAcknowledged: false,
    isLoading: false,
    error: null,
    showHelp: false,
    setHistory: mockSetHistory,
    setHistoryLoading: mockSetHistoryLoading,
    setSuggestions: mockSetSuggestions,
    setActiveSession: mockSetActiveSession,
    setTopicInput: mockSetTopicInput,
    setIsLoading: mockSetIsLoading,
    setError: mockSetError,
    setSessionId: mockSetSessionId,
    setTopic: mockSetTopic,
    setCards: mockSetCards,
    setCurrentIdx: mockSetCurrentIdx,
    setStats: mockSetStats,
    clearCardState: mockClearCardState,
    setSyllabus: mockSetSyllabus,
    setSelectedSubject: mockSetSelectedSubject,
    setSyllabusLoading: mockSetSyllabusLoading,
    setSubjectResources: mockSetSubjectResources,
    clearSyllabus: mockClearSyllabus,
    ...overrides,
  };
}

// ── Mock modules ────────────────────────────────────────────────────

jest.mock("@/stores/scrollSessionStore", () => ({
  useScrollSessionStore: jest.fn(() => mockStoreState),
}));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: jest.fn(() => ({
    nickname: "Student",
    userId: "user-1",
  })),
}));

const mockGetHistory = jest.fn();

jest.mock("@/lib/learnApi", () => ({
  learnApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    deleteSubject: jest.fn(),
  },
  scrollApi: {
    startFeed: jest.fn(),
    resumeFeed: jest.fn(),
    pregenContent: jest.fn(),
  },
  syllabusApi: {
    generate: jest.fn(),
  },
  resourcesApi: {
    list: jest.fn(),
  },
}));

// ── Minimal renderHook helper (no DOM required) ─────────────────────

type HookResult<T> = { current: T };

function renderHook<T>(hookFn: () => T): {
  result: HookResult<T>;
  unmount: () => void;
} {
  const result: HookResult<T> = { current: undefined as unknown as T };
  let renderer: any;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    renderer = TestRenderer.create(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => act(() => renderer.unmount()),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

const MOCK_SUBJECTS = [
  {
    subject: "Math",
    total_sessions: 3,
    total_questions: 25,
    accuracy: 0.8,
    total_xp: 150,
    last_studied_at: "2025-01-01T00:00:00Z",
    has_syllabus: true,
  },
];

const MOCK_OVERALL = {
  total_subjects: 1,
  total_sessions: 3,
  total_questions: 25,
  total_xp: 150,
  concepts_mastered: 5,
};

const MOCK_SUGGESTIONS = ["Try Physics next"];

const MOCK_ACTIVE_SESSION = {
  session_id: "active-session-1",
  topic: "Math",
  cards_remaining: 5,
};

function makeSuccessResponse() {
  return Promise.resolve({
    success: true,
    data: {
      subjects: MOCK_SUBJECTS,
      overall: MOCK_OVERALL,
      suggestions: MOCK_SUGGESTIONS,
      active_session: MOCK_ACTIVE_SESSION,
    },
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useHomeScreen — history loading useEffect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHistory.mockReturnValue(makeSuccessResponse());
    mockStoreState = buildMockStore();
  });

  // ------------------------------------------------------------------
  // REGRESSION: The original bug had `if (store.sessionId || store.syllabus) return;`
  // which skipped history loading when a syllabus was cached from a
  // previous session. The fix removed `store.syllabus` from the guard.
  // ------------------------------------------------------------------

  it("REGRESSION: loads history even when store.syllabus is non-null and sessionId is null", async () => {
    mockStoreState = buildMockStore({
      sessionId: null,
      syllabus: {
        subject: "Math",
        units: [{ name: "Algebra", topics: [] }],
      },
    });

    await act(async () => {
      renderHook(() => useHomeScreen());
      // Flush the microtask queue so the getHistory promise resolves
      await Promise.resolve();
    });

    expect(mockGetHistory).toHaveBeenCalledWith("Student", "user-1");
    expect(mockSetHistory).toHaveBeenCalledWith(MOCK_SUBJECTS, MOCK_OVERALL);
  });

  it("loads history when both syllabus and sessionId are null (normal case)", async () => {
    mockStoreState = buildMockStore({
      sessionId: null,
      syllabus: null,
    });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    expect(mockGetHistory).toHaveBeenCalledWith("Student", "user-1");
    expect(mockSetHistory).toHaveBeenCalledWith(MOCK_SUBJECTS, MOCK_OVERALL);
  });

  it("does NOT load history when store.sessionId is non-null (active feed session)", async () => {
    mockStoreState = buildMockStore({
      sessionId: "active-session-123",
    });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    expect(mockGetHistory).not.toHaveBeenCalled();
    expect(mockSetHistory).not.toHaveBeenCalled();
  });

  it("calls store.setHistory with subjects and overall from the API response", async () => {
    mockStoreState = buildMockStore({ sessionId: null });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    expect(mockSetHistory).toHaveBeenCalledTimes(1);
    expect(mockSetHistory).toHaveBeenCalledWith(MOCK_SUBJECTS, MOCK_OVERALL);
    expect(mockSetSuggestions).toHaveBeenCalledWith(MOCK_SUGGESTIONS);
    expect(mockSetActiveSession).toHaveBeenCalledWith(MOCK_ACTIVE_SESSION);
  });

  it("calls store.setHistoryLoading(false) after fetch completes", async () => {
    mockStoreState = buildMockStore({ sessionId: null, history: [] });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    // setHistoryLoading(true) is called first because history is empty,
    // then setHistoryLoading(false) is called in the .finally() block.
    expect(mockSetHistoryLoading).toHaveBeenCalledWith(true);
    expect(mockSetHistoryLoading).toHaveBeenCalledWith(false);

    // false must be the last call (from .finally)
    const calls = mockSetHistoryLoading.mock.calls;
    expect(calls[calls.length - 1][0]).toBe(false);
  });

  it("calls setHistoryLoading(false) even when the API call fails", async () => {
    // Return a failed response (success: false) rather than a rejected promise.
    // This tests that .finally() fires and setHistoryLoading(false) is called
    // even when the API returns a failure response.
    mockGetHistory.mockReturnValue(
      Promise.resolve({ success: false, error: "server error", data: null }),
    );
    mockStoreState = buildMockStore({ sessionId: null, history: [] });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    expect(mockSetHistoryLoading).toHaveBeenCalledWith(true);
    // .finally() fires regardless of success/failure
    expect(mockSetHistoryLoading).toHaveBeenCalledWith(false);
    // setHistory should NOT be called since success is false
    expect(mockSetHistory).not.toHaveBeenCalled();
  });

  it("does not call setHistoryLoading(true) when history is already populated", async () => {
    mockStoreState = buildMockStore({
      sessionId: null,
      history: MOCK_SUBJECTS,
    });

    await act(async () => {
      renderHook(() => useHomeScreen());
      await Promise.resolve();
    });

    // Should NOT set loading to true when history already exists
    expect(mockSetHistoryLoading).not.toHaveBeenCalledWith(true);
    // But .finally() still calls setHistoryLoading(false)
    expect(mockSetHistoryLoading).toHaveBeenCalledWith(false);
  });
});
