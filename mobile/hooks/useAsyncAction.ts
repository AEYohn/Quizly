import { useState, useCallback, useRef } from "react";

/**
 * Hook that wraps an async action with a busy guard.
 * Prevents double-taps by blocking concurrent calls.
 * Clears busy state on both success and error (try/finally).
 *
 * @returns [busy, run] — busy is true while the action is in-flight,
 *   run() takes an async function and executes it with the guard.
 */
export function useAsyncAction(): [
  boolean,
  <T>(action: () => Promise<T>) => Promise<T | undefined>,
] {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setBusy(true);
      try {
        return await action();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return [busy, run];
}
