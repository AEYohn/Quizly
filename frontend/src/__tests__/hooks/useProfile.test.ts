import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProfile } from "~/hooks/feed/useProfile";
import type {
    LearnProgressResponse,
    CalibrationResponse,
    QuestionHistoryItem,
    QuestionHistorySessionSummary,
    PaginationMeta,
} from "~/lib/api";

// ============================================
// Mocks
// ============================================

const mockLogout = vi.fn();

vi.mock("~/lib/auth", () => ({
    useAuth: () => ({
        user: { name: "TestStudent", email: "test@test.com" },
        logout: mockLogout,
    }),
}));

const mockGetProgress = vi.fn();
const mockGetCalibration = vi.fn();
const mockGetQuestionHistorySessions = vi.fn();
const mockGetQuestionHistory = vi.fn();
const mockGetSessionQuestions = vi.fn();

vi.mock("~/lib/api", () => ({
    learnApi: {
        getProgress: (...args: unknown[]) => mockGetProgress(...args),
        getCalibration: (...args: unknown[]) => mockGetCalibration(...args),
        getQuestionHistorySessions: (...args: unknown[]) => mockGetQuestionHistorySessions(...args),
        getQuestionHistory: (...args: unknown[]) => mockGetQuestionHistory(...args),
        getSessionQuestions: (...args: unknown[]) => mockGetSessionQuestions(...args),
    },
}));

// ============================================
// Fixtures
// ============================================

function makeProgressData(overrides?: Partial<LearnProgressResponse>): LearnProgressResponse {
    return {
        student_name: "TestStudent",
        mastery: [
            { concept: "Arrays", score: 80, attempts: 10, correct: 8, last_seen: "2025-01-01" },
            { concept: "Loops", score: 30, attempts: 10, correct: 3, last_seen: "2025-01-01" },
            { concept: "Functions", score: 45, attempts: 20, correct: 9, last_seen: "2025-01-01" },
            { concept: "Recursion", score: 60, attempts: 5, correct: 3, last_seen: "2025-01-01" },
        ],
        recent_sessions: [
            {
                id: "s1",
                topic: "JavaScript",
                phase: "done",
                questions_answered: 10,
                questions_correct: 7,
                accuracy: 70,
                started_at: "2025-01-01",
                ended_at: "2025-01-01",
            },
            {
                id: "s2",
                topic: "Python",
                phase: "done",
                questions_answered: 20,
                questions_correct: 15,
                accuracy: 75,
                started_at: "2025-01-02",
                ended_at: "2025-01-02",
            },
        ],
        summary: {
            total_concepts: 4,
            mastered: 1,
            in_progress: 2,
            needs_work: 1,
        },
        ...overrides,
    };
}

function makeCalibrationData(): CalibrationResponse {
    return {
        calibration: {
            buckets: [{ range: "0-20", midpoint: 10, count: 5, accuracy: 0.8 }],
            brier_score: 0.15,
            ece: 0.05,
            overconfidence_index: 0.1,
            total_responses: 30,
        },
        dk_concepts: [{ concept: "Loops", avg_confidence: 80, accuracy: 30, dk_score: 50 }],
    };
}

function makeSessionSummaries(count: number): QuestionHistorySessionSummary[] {
    return Array.from({ length: count }, (_, i) => ({
        session_id: `session-${i}`,
        topic: `Topic ${i}`,
        mode: "scroll",
        questions_answered: 10,
        questions_correct: 7,
        accuracy: 70,
        started_at: "2025-01-01",
        ended_at: "2025-01-01",
    }));
}

function makePagination(offset: number, limit: number, total: number): PaginationMeta {
    return { offset, limit, total };
}

function makeQuestionHistoryItems(count: number): QuestionHistoryItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `q-${i}`,
        session_id: `session-0`,
        prompt: `Question ${i}?`,
        options: ["A", "B", "C", "D"],
        correct_answer: "A",
        student_answer: i % 2 === 0 ? "A" : "B",
        is_correct: i % 2 === 0,
        confidence: 70,
        explanation: "Because A",
        concept: "Arrays",
        difficulty: 3,
        topic: "JavaScript",
        mode: "scroll",
        answered_at: "2025-01-01",
    }));
}

// ============================================
// Tests
// ============================================

describe("useProfile", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: API calls succeed
        mockGetProgress.mockResolvedValue({
            success: true,
            data: makeProgressData(),
        });
        mockGetCalibration.mockResolvedValue({
            success: true,
            data: makeCalibrationData(),
        });
        mockGetQuestionHistorySessions.mockResolvedValue({
            success: true,
            data: {
                sessions: makeSessionSummaries(5),
                pagination: makePagination(0, 20, 5),
            },
        });
        mockGetQuestionHistory.mockResolvedValue({
            success: true,
            data: {
                items: makeQuestionHistoryItems(3),
                pagination: makePagination(0, 20, 3),
            },
        });
        mockGetSessionQuestions.mockResolvedValue({
            success: true,
            data: {
                session_id: "session-0",
                items: makeQuestionHistoryItems(4),
            },
        });
    });

    // ------------------------------------------
    // 1. Initial load
    // ------------------------------------------
    it("calls getProgress and getCalibration on mount", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockGetProgress).toHaveBeenCalledTimes(1);
        expect(mockGetProgress).toHaveBeenCalledWith("TestStudent");
        expect(mockGetCalibration).toHaveBeenCalledTimes(1);
        expect(mockGetCalibration).toHaveBeenCalledWith("TestStudent");
    });

    // ------------------------------------------
    // 2. Loading state
    // ------------------------------------------
    it("isLoading is true initially and false after data loads", async () => {
        // Make progress resolve slowly
        let resolveProgress!: (v: unknown) => void;
        mockGetProgress.mockReturnValue(
            new Promise((resolve) => {
                resolveProgress = resolve;
            }),
        );
        let resolveCalibration!: (v: unknown) => void;
        mockGetCalibration.mockReturnValue(
            new Promise((resolve) => {
                resolveCalibration = resolve;
            }),
        );

        const { result } = renderHook(() => useProfile());

        // Initially loading
        expect(result.current.isLoading).toBe(true);

        // Resolve both promises
        await act(async () => {
            resolveProgress({ success: true, data: makeProgressData() });
            resolveCalibration({ success: true, data: makeCalibrationData() });
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
    });

    // ------------------------------------------
    // 3. Student name
    // ------------------------------------------
    it("uses auth.user.name for studentName", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.studentName).toBe("TestStudent");
        expect(result.current.initial).toBe("T");
        expect(result.current.email).toBe("test@test.com");
    });

    it('falls back to "Student" when user name is missing', async () => {
        // Override auth mock temporarily for this test
        const authModule = await import("~/lib/auth");
        const spy = vi.spyOn(authModule, "useAuth").mockReturnValue({
            user: null,
            logout: mockLogout,
        } as unknown as ReturnType<typeof authModule.useAuth>);

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.studentName).toBe("Student");
        expect(result.current.initial).toBe("S");

        spy.mockRestore();
    });

    // ------------------------------------------
    // 4. Computed stats
    // ------------------------------------------
    it("computes totalXp, accuracy, and level correctly from progress data", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // totalXp = sum(questions_correct * 10) = (7*10) + (15*10) = 220
        expect(result.current.totalXp).toBe(220);

        // totalAnswered = 10 + 20 = 30, totalCorrect = 7 + 15 = 22
        // accuracy = round((22/30) * 100) = round(73.33) = 73
        expect(result.current.accuracy).toBe(73);

        // level = max(1, floor(sqrt(220 / 100))) = max(1, floor(sqrt(2.2))) = max(1, floor(1.483)) = max(1, 1) = 1
        expect(result.current.level).toBe(1);

        expect(result.current.totalSessions).toBe(2);
    });

    it("returns zero stats when progress is null", async () => {
        mockGetProgress.mockResolvedValue({ success: false, error: "Not found" });
        mockGetCalibration.mockResolvedValue({ success: true, data: makeCalibrationData() });

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.totalXp).toBe(0);
        expect(result.current.accuracy).toBe(0);
        expect(result.current.level).toBe(1);
        expect(result.current.totalSessions).toBe(0);
    });

    // ------------------------------------------
    // 5. Weak concepts
    // ------------------------------------------
    it("filters mastery to score < 50, sorted ascending", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Loops (30) and Functions (45) are < 50, sorted ascending by score
        expect(result.current.weakConcepts).toEqual([
            { concept: "Loops", score: 30, attempts: 10, correct: 3 },
            { concept: "Functions", score: 45, attempts: 20, correct: 9 },
        ]);
    });

    it("returns empty weakConcepts when all mastery scores are >= 50", async () => {
        mockGetProgress.mockResolvedValue({
            success: true,
            data: makeProgressData({
                mastery: [
                    { concept: "Arrays", score: 80, attempts: 10, correct: 8, last_seen: "2025-01-01" },
                    { concept: "Loops", score: 90, attempts: 10, correct: 9, last_seen: "2025-01-01" },
                ],
            }),
        });

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.weakConcepts).toEqual([]);
    });

    // ------------------------------------------
    // 6. Tab switching
    // ------------------------------------------
    it("onProfileTabChange updates activeProfileTab", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.activeProfileTab).toBe("overview");

        act(() => {
            result.current.onProfileTabChange("history");
        });

        expect(result.current.activeProfileTab).toBe("history");

        act(() => {
            result.current.onProfileTabChange("weakAreas");
        });

        expect(result.current.activeProfileTab).toBe("weakAreas");
    });

    // ------------------------------------------
    // 7. History lazy load: NOT fetched until tab is "history"
    // ------------------------------------------
    it("does NOT fetch history data until activeProfileTab is 'history'", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Still on "overview" tab
        expect(mockGetQuestionHistorySessions).not.toHaveBeenCalled();
        expect(result.current.questionSessions).toEqual([]);
    });

    // ------------------------------------------
    // 8. History lazy load: IS fetched when tab changes to "history"
    // ------------------------------------------
    it("fetches history data when tab changes to 'history'", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        act(() => {
            result.current.onProfileTabChange("history");
        });

        await waitFor(() => {
            expect(mockGetQuestionHistorySessions).toHaveBeenCalledTimes(1);
        });

        expect(mockGetQuestionHistorySessions).toHaveBeenCalledWith("TestStudent", {
            limit: 20,
            offset: 0,
        });

        await waitFor(() => {
            expect(result.current.questionSessions).toHaveLength(5);
        });

        expect(result.current.isLoadingHistory).toBe(false);
    });

    // ------------------------------------------
    // 9. Wrong answers lazy load when tab changes to "weakAreas"
    // ------------------------------------------
    it("fetches wrong answers when tab changes to 'weakAreas'", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should not have been called yet
        expect(mockGetQuestionHistory).not.toHaveBeenCalled();

        act(() => {
            result.current.onProfileTabChange("weakAreas");
        });

        await waitFor(() => {
            expect(mockGetQuestionHistory).toHaveBeenCalledTimes(1);
        });

        expect(mockGetQuestionHistory).toHaveBeenCalledWith(
            "TestStudent",
            { is_correct: false },
            { limit: 20, offset: 0 },
        );

        await waitFor(() => {
            expect(result.current.wrongAnswerPatterns).toHaveLength(3);
        });

        expect(result.current.isLoadingWrongAnswers).toBe(false);
    });

    // ------------------------------------------
    // 10. Load more history
    // ------------------------------------------
    it("onLoadMoreHistory fetches next page and appends sessions", async () => {
        // First page: 20 items out of 30 total
        mockGetQuestionHistorySessions
            .mockResolvedValueOnce({
                success: true,
                data: {
                    sessions: makeSessionSummaries(20),
                    pagination: makePagination(0, 20, 30),
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    sessions: makeSessionSummaries(10),
                    pagination: makePagination(20, 20, 30),
                },
            });

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Switch to history tab to trigger initial load
        act(() => {
            result.current.onProfileTabChange("history");
        });

        await waitFor(() => {
            expect(result.current.questionSessions).toHaveLength(20);
        });

        // Load more
        await act(async () => {
            await result.current.onLoadMoreHistory();
        });

        expect(mockGetQuestionHistorySessions).toHaveBeenCalledTimes(2);
        expect(mockGetQuestionHistorySessions).toHaveBeenLastCalledWith("TestStudent", {
            limit: 20,
            offset: 20,
        });

        expect(result.current.questionSessions).toHaveLength(30);
    });

    it("onLoadMoreHistory does nothing when all pages loaded", async () => {
        // All items fit in first page
        mockGetQuestionHistorySessions.mockResolvedValueOnce({
            success: true,
            data: {
                sessions: makeSessionSummaries(5),
                pagination: makePagination(0, 20, 5),
            },
        });

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        act(() => {
            result.current.onProfileTabChange("history");
        });

        await waitFor(() => {
            expect(result.current.questionSessions).toHaveLength(5);
        });

        // Try to load more -- nextOffset (20) >= total (5), so nothing happens
        await act(async () => {
            await result.current.onLoadMoreHistory();
        });

        // Still only one call (the initial fetch)
        expect(mockGetQuestionHistorySessions).toHaveBeenCalledTimes(1);
    });

    // ------------------------------------------
    // 11. Session expansion
    // ------------------------------------------
    it("onToggleSession fetches session questions for a new session", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.onToggleSession("session-0");
        });

        expect(mockGetSessionQuestions).toHaveBeenCalledWith("session-0");
        expect(result.current.expandedSessionId).toBe("session-0");

        await waitFor(() => {
            expect(result.current.expandedSessionQuestions).toHaveLength(4);
        });
    });

    // ------------------------------------------
    // 12. Session collapse
    // ------------------------------------------
    it("toggling the same session collapses it", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Expand
        await act(async () => {
            await result.current.onToggleSession("session-0");
        });

        expect(result.current.expandedSessionId).toBe("session-0");

        // Collapse (same id)
        await act(async () => {
            await result.current.onToggleSession("session-0");
        });

        expect(result.current.expandedSessionId).toBeNull();
        expect(result.current.expandedSessionQuestions).toEqual([]);
    });

    // ------------------------------------------
    // 13. Error handling
    // ------------------------------------------
    it("failed API calls don't crash and set reasonable defaults", async () => {
        mockGetProgress.mockRejectedValue(new Error("Network error"));
        mockGetCalibration.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should not crash; defaults should be reasonable
        expect(result.current.progress).toBeNull();
        expect(result.current.calibration).toBeNull();
        expect(result.current.totalXp).toBe(0);
        expect(result.current.accuracy).toBe(0);
        expect(result.current.level).toBe(1);
        expect(result.current.weakConcepts).toEqual([]);
        expect(result.current.studentName).toBe("TestStudent");
    });

    it("failed history load does not crash", async () => {
        mockGetQuestionHistorySessions.mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        act(() => {
            result.current.onProfileTabChange("history");
        });

        await waitFor(() => {
            expect(result.current.isLoadingHistory).toBe(false);
        });

        expect(result.current.questionSessions).toEqual([]);
    });

    it("failed wrong answers load does not crash", async () => {
        mockGetQuestionHistory.mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        act(() => {
            result.current.onProfileTabChange("weakAreas");
        });

        await waitFor(() => {
            expect(result.current.isLoadingWrongAnswers).toBe(false);
        });

        expect(result.current.wrongAnswerPatterns).toEqual([]);
    });

    it("failed session questions load does not crash", async () => {
        mockGetSessionQuestions.mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.onToggleSession("session-0");
        });

        // Session is set as expanded but questions remain empty
        expect(result.current.expandedSessionId).toBe("session-0");
        expect(result.current.expandedSessionQuestions).toEqual([]);
    });

    // ------------------------------------------
    // Bonus: logout is passed through
    // ------------------------------------------
    it("exposes the logout function from auth", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.logout).toBe(mockLogout);
        expect(result.current.onLogout).toBe(mockLogout);
    });

    // ------------------------------------------
    // Bonus: history filter change
    // ------------------------------------------
    it("onHistoryFilterChange updates historyFilter", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.historyFilter).toBe("all");

        act(() => {
            result.current.onHistoryFilterChange("incorrect");
        });

        expect(result.current.historyFilter).toBe("incorrect");
    });

    // ------------------------------------------
    // Bonus: history only fetched once (not re-fetched on tab switch back)
    // ------------------------------------------
    it("does not re-fetch history when switching back to history tab", async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Switch to history
        act(() => {
            result.current.onProfileTabChange("history");
        });

        await waitFor(() => {
            expect(result.current.questionSessions).toHaveLength(5);
        });

        expect(mockGetQuestionHistorySessions).toHaveBeenCalledTimes(1);

        // Switch away and back
        act(() => {
            result.current.onProfileTabChange("overview");
        });
        act(() => {
            result.current.onProfileTabChange("history");
        });

        // Should still be 1 call because historyLoaded is true
        expect(mockGetQuestionHistorySessions).toHaveBeenCalledTimes(1);
    });
});
