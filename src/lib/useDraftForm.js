import { useEffect, useState } from "react";

const PREFIX = "ghb_draft";

function storageKey(key, userId) {
  return userId ? `${PREFIX}:${key}:${userId}` : null;
}

/**
 * Persist a form draft in localStorage, keyed per user, so that a page reload
 * or a mobile background-kill does not wipe in-progress input.
 *
 * Returns [value, setValue, clearDraft].
 * Pass `enabled: false` to drop a draft (e.g. once the related request exists
 * server-side) or to opt out for anonymous visitors without a user id.
 *
 * @template T
 * @param {string} key Unique draft name (e.g. "deposit").
 * @param {T} initial Default values.
 * @param {{ userId?: string, enabled?: boolean }} [options]
 * @returns {[T, (value: T | ((current: T) => T)) => void, () => void]}
 */
export function useDraftForm(key, initial, { userId, enabled = true } = {}) {
  const keyStore = storageKey(key, userId);
  const [value, setValue] = useState(() => {
    if (!keyStore || !enabled) return initial;
    try {
      const raw = localStorage.getItem(keyStore);
      if (!raw) return initial;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return initial;
      return { ...initial, ...saved };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!keyStore || !enabled) return;
    try {
      localStorage.setItem(keyStore, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (quota, private mode) — fail silently.
    }
  }, [value, keyStore, enabled]);

  const clearDraft = () => {
    if (keyStore) {
      try {
        localStorage.removeItem(keyStore);
      } catch {
        // ignore
      }
    }
    setValue(initial);
  };

  return [value, setValue, clearDraft];
}
