/**
 * Tests for fetchApi and fetchFormDataAuth via exported API namespaces.
 *
 * fetchApi is a module-level (non-exported) async function in learnApi.ts.
 * We exercise it through scrollApi, learnApi, resourcesApi, etc.
 */

jest.mock("@/lib/authTokenBridge", () => ({
  getAuthToken: jest.fn().mockResolvedValue("test-token"),
}));

// Provide a deterministic API_BASE so assertions are stable
const TEST_API_BASE = "https://test-api.example.com";
process.env.EXPO_PUBLIC_API_URL = TEST_API_BASE;

import { scrollApi, learnApi, resourcesApi } from "@/lib/learnApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

/** Build a minimal Response-like object that fetch returns */
function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  };
}

function errorResponse(status: number, body: unknown = { detail: `HTTP ${status}` }) {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  };
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("learnApi - fetchApi via exported namespaces", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    jest.spyOn(global, "clearTimeout");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Successful request returns data
  // =========================================================================
  it("successful request returns data", async () => {
    const payload = { student_name: "Alice", concepts: {} };
    mockFetch.mockResolvedValueOnce(okResponse(payload));

    const promise = learnApi.getProgress("Alice");
    // Advance timers so any pending setTimeout (the 30s abort) can be cleared
    jest.advanceTimersByTime(0);
    const result = await promise;

    expect(result).toEqual({ success: true, data: payload });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Verify the URL includes the API base
    expect(mockFetch.mock.calls[0][0]).toContain(TEST_API_BASE);
  });

  // =========================================================================
  // 2. Request that takes >30s gets aborted, returns "Request timed out"
  // =========================================================================
  it("request exceeding 30s timeout returns 'Request timed out'", async () => {
    // fetch will never resolve on its own; the AbortController will fire.
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        // When the signal aborts, reject with AbortError
        init.signal?.addEventListener("abort", () => {
          reject(abortError());
        });
      });
    });

    // learnApi.getCalibration calls fetchApiAuth -> fetchApi, retry defaults on
    // maxRetries=3 so we need to exhaust all attempts
    const promise = learnApi.getCalibration("Alice");

    // Exhaust all 4 attempts (initial + 3 retries).
    // Each attempt: 30s timeout fires, then a backoff sleep follows before next attempt.
    // Attempt 0: 30s timeout
    await jest.advanceTimersByTimeAsync(30_000);
    // Backoff after attempt 0: ~500ms base * 2^0 + jitter, max 5000. Advance generously.
    await jest.advanceTimersByTimeAsync(5_000);
    // Attempt 1: 30s timeout
    await jest.advanceTimersByTimeAsync(30_000);
    await jest.advanceTimersByTimeAsync(5_000);
    // Attempt 2: 30s timeout
    await jest.advanceTimersByTimeAsync(30_000);
    await jest.advanceTimersByTimeAsync(5_000);
    // Attempt 3 (last): 30s timeout
    await jest.advanceTimersByTimeAsync(30_000);
    await jest.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result).toEqual({ success: false, error: "Request timed out" });
  });

  // =========================================================================
  // 3. AbortError triggers retry (fetch is called multiple times)
  // =========================================================================
  it("AbortError triggers retry and fetch is called multiple times", async () => {
    const successPayload = { session_id: "s1", cards: [], stats: {} };

    // First call: abort
    // Second call: succeed
    let callCount = 0;
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(abortError());
          });
        });
      }
      return Promise.resolve(okResponse(successPayload));
    });

    const promise = scrollApi.getNextCards("session-1", 3);

    // Advance past the 30s timeout for the first attempt
    await jest.advanceTimersByTimeAsync(30_000);
    // Advance past the backoff sleep
    await jest.advanceTimersByTimeAsync(5_000);
    // Second attempt succeeds immediately, but advance a tick for clearTimeout
    await jest.advanceTimersByTimeAsync(0);

    const result = await promise;
    expect(result).toEqual({ success: true, data: successPayload });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 4. clearTimeout is called after successful response
  // =========================================================================
  it("clearTimeout is called after successful response", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));

    const promise = learnApi.getProgress("Bob");
    await jest.advanceTimersByTimeAsync(0);
    await promise;

    // clearTimeout is called in the finally block of fetchApi
    expect(clearTimeout).toHaveBeenCalled();
  });

  // =========================================================================
  // 5. Non-retryable HTTP error (400) returns error without retry
  // =========================================================================
  it("non-retryable HTTP 400 returns error without retry", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(400, { detail: "Bad request" }),
    );

    const promise = learnApi.getProgress("Charlie");
    await jest.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result).toEqual({ success: false, error: "Bad request" });
    // 400 is not in retryableStatuses, so fetch is only called once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // 6. fetchFormDataAuth: timeout at 60s returns "Upload timed out"
  // =========================================================================
  it("fetchFormDataAuth timeout at 60s returns 'Upload timed out'", async () => {
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(abortError());
        });
      });
    });

    const formData = new FormData();
    // resourcesApi.upload calls fetchFormDataAuth internally
    const promise = resourcesApi.upload(formData);

    // 30s should NOT be enough to trigger the 60s upload timeout
    await jest.advanceTimersByTimeAsync(30_000);
    // The promise should still be pending -- we can't assert that directly,
    // but we verify fetch was called and no result yet.

    // Advance the remaining 30s to hit 60s total
    await jest.advanceTimersByTimeAsync(30_000);
    await jest.advanceTimersByTimeAsync(0);

    const result = await promise;
    expect(result).toEqual({ success: false, error: "Upload timed out" });
    // fetchFormDataAuth does NOT retry, so fetch called once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
