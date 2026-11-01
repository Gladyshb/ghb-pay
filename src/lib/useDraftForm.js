import { useEffect, useRef, useState } from "react";

const PREFIX = "ghb_draft";

function storageKey(key, userId) {
  return userId ? `${PREFIX}:${key}:${userId}` : null;
}

function readDraft(storeKey, initial) {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
    return { ...initial, ...saved };
  } catch {
    return null;
  }
}

function writeDraft(storeKey, value) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (quota, private mode) — fail silently.
  }
}

/**
 * Persist a form draft in localStorage, keyed per user, so that a page reload
 * or a mobile background-kill does not wipe in-progress input.
 *
 * The draft is hydrated lazily: on a cold reload the Supabase session is not
 * known during the first render, so the stored draft is merged in as soon as
 * the user id becomes available.
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
  const initialRef = useRef(initial);
  const [value, setValue] = useState(initial);
  const [hydratedKey, setHydratedKey] = useState(null);

  // Hydrate once per store key (handles the session arriving after mount).
  useEffect(() => {
    if (!keyStore || hydratedKey === keyStore) return undefined;
    const saved = readDraft(keyStore, initialRef.current);
    if (saved) setValue((current) => ({ ...current, ...saved }));
    setHydratedKey(keyStore);
    return undefined;
  }, [keyStore, hydratedKey]);

  // Persist on every change once we have a store key.
  useEffect(() => {
    if (!keyStore || !enabled) return undefined;
    writeDraft(keyStore, value);
    return undefined;
  }, [value, keyStore, enabled]);

  // Synchronous safety net: flush the very last state before the page is
  // hidden/killed (the effect above may not have run yet in the final frame).
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (!keyStore) return undefined;
    const flush = () => writeDraft(keyStore, valueRef.current);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [keyStore]);

  const clearDraft = () => {
    if (keyStore) {
      try {
        localStorage.removeItem(keyStore);
      } catch {
        // ignore
      }
    }
    setHydratedKey(null);
    setValue({ ...initialRef.current });
    if (keyStore) writeDraft(keyStore, initialRef.current);
  };

  return [value, setValue, clearDraft];
}
