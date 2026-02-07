import { createJSONStorage, type StateStorage } from "zustand/middleware";

const DEBOUNCE_MS = 1_000; // 1-second debounce for localStorage writes

/**
 * Creates a StateStorage adapter that debounces `setItem` calls while keeping
 * `getItem` (reads) and `removeItem` (deletes) immediate. This prevents
 * excessive localStorage writes during rapid state updates (card transitions,
 * stat ticks, etc.) that can degrade performance.
 *
 * Usage: pass the returned storage into `createJSONStorage`:
 *   storage: createDebouncedJSONStorage()
 */
function createDebouncedStateStorage(): StateStorage {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let pendingWrites: Map<string, string> = new Map();

    return {
        getItem: (name: string): string | null => {
            return localStorage.getItem(name);
        },

        setItem: (name: string, value: string): void => {
            pendingWrites.set(name, value);
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                for (const [key, val] of pendingWrites) {
                    localStorage.setItem(key, val);
                }
                pendingWrites.clear();
                timeout = null;
            }, DEBOUNCE_MS);
        },

        removeItem: (name: string): void => {
            // Cancel any pending debounced write for this key
            pendingWrites.delete(name);
            if (pendingWrites.size === 0 && timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            localStorage.removeItem(name);
        },
    };
}

/**
 * Returns a PersistStorage instance (compatible with Zustand persist's
 * `storage` option) that debounces localStorage writes by 1 second.
 */
export function createDebouncedJSONStorage<S>() {
    return createJSONStorage<S>(() => createDebouncedStateStorage());
}
