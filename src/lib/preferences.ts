"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Viewer preferences (on/off switches) remembered in localStorage. Storage can
 * be blocked; the switches then just reset on reload.
 */
const PREFIX = "pref:";
const listeners = new Set<() => void>();
/** Remembered values; null when the user hasn't chosen yet. */
const memory = new Map<string, boolean | null>();

// Follow changes made in other tabs.
function onStorage(e: StorageEvent) {
  if (e.key === null) memory.clear();
  else if (e.key.startsWith(PREFIX)) memory.delete(e.key.slice(PREFIX.length));
  else return;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function read(key: string) {
  if (!memory.has(key)) {
    let value: boolean | null = null;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === "1" || raw === "0") value = raw === "1";
    } catch {}
    memory.set(key, value);
  }
  return memory.get(key)!;
}

/**
 * A remembered on/off preference, or `fallback` when the user hasn't chosen
 * (and on the server). Pass null to tell "not chosen" apart from a choice.
 */
export function usePreference<F extends boolean | null>(key: string, fallback: F) {
  const value = useSyncExternalStore<boolean | F>(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        localStorage.setItem(PREFIX + key, next ? "1" : "0");
      } catch {}
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set] as const;
}
