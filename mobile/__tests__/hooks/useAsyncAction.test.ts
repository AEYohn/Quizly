import React, { act } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");

// Enable React act() environment warnings
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── Minimal renderHook helper (no DOM required) ──────────────────────

type HookResult<T> = { current: T };

function renderHook<T>(hookFn: () => T): { result: HookResult<T> } {
  const result: HookResult<T> = { current: undefined as unknown as T };

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    TestRenderer.create(React.createElement(TestComponent));
  });

  return { result };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Creates a promise that can be resolved/rejected externally. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("useAsyncAction", () => {
  it("busy starts as false", () => {
    const { result } = renderHook(() => useAsyncAction());
    const [busy] = result.current;

    expect(busy).toBe(false);
  });

  it("busy becomes true during action execution", async () => {
    const { result } = renderHook(() => useAsyncAction());
    const d = deferred<string>();

    // Start the action but don't await it yet — the action is suspended on `d`
    let runPromise: Promise<string | undefined>;
    act(() => {
      runPromise = result.current[1](async () => {
        return await d.promise;
      });
    });

    // After act flushes the setBusy(true) update, busy should be true
    expect(result.current[0]).toBe(true);

    // Let the action finish
    await act(async () => {
      d.resolve("done");
      await runPromise!;
    });
  });

  it("busy returns to false after action completes", async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current[1](async () => "result");
    });

    expect(result.current[0]).toBe(false);
  });

  it("busy returns to false if action throws", async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      try {
        await result.current[1](async () => {
          throw new Error("boom");
        });
      } catch {
        // expected
      }
    });

    expect(result.current[0]).toBe(false);
  });

  it("concurrent calls are blocked — second call returns undefined while first is running", async () => {
    const { result } = renderHook(() => useAsyncAction());
    const d = deferred<string>();

    let secondReturnValue: unknown = "sentinel";

    await act(async () => {
      // Start the first (long-running) action
      const firstPromise = result.current[1](async () => {
        return await d.promise;
      });

      // While the first is still running, attempt a second call
      secondReturnValue = await result.current[1](async () => "second");

      // Now let the first complete
      d.resolve("first");
      await firstPromise;
    });

    expect(secondReturnValue).toBeUndefined();
  });

  it("run returns the action's return value on success", async () => {
    const { result } = renderHook(() => useAsyncAction());

    let returnValue: unknown;

    await act(async () => {
      returnValue = await result.current[1](async () => 42);
    });

    expect(returnValue).toBe(42);
  });

  it("after first action completes, a second call works normally", async () => {
    const { result } = renderHook(() => useAsyncAction());

    // First call
    await act(async () => {
      await result.current[1](async () => "first");
    });

    // Second call after first is done
    let secondReturnValue: unknown;
    await act(async () => {
      secondReturnValue = await result.current[1](async () => "second");
    });

    expect(secondReturnValue).toBe("second");
    expect(result.current[0]).toBe(false);
  });
});
