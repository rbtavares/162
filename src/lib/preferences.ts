"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Viewer preferences (on/off switches and picks from a list) remembered in
 * localStorage. Storage can be blocked; they then just reset on reload.
 */
const PREFIX = "pref:";
const listeners = new Set<() => void>();
/** Stored values as saved; null when the user hasn't chosen yet. */
const memory = new Map<string, string | null>();

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
    let value: string | null = null;
    try {
      value = localStorage.getItem(PREFIX + key);
    } catch {}
    memory.set(key, value);
  }
  return memory.get(key)!;
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {}
  listeners.forEach((l) => l());
}

const parseBoolean = (raw: string | null) => (raw === "1" ? true : raw === "0" ? false : null);

/**
 * A remembered on/off preference, or `fallback` when the user hasn't chosen
 * (and on the server). Pass null to tell "not chosen" apart from a choice.
 */
export function usePreference<F extends boolean | null>(key: string, fallback: F) {
  const value = useSyncExternalStore<boolean | F>(
    subscribe,
    () => parseBoolean(read(key)) ?? fallback,
    () => fallback,
  );
  const set = useCallback((next: boolean) => write(key, next ? "1" : "0"), [key]);
  return [value, set] as const;
}

/**
 * A remembered pick from `options`, or `fallback` when the user hasn't
 * chosen, the stored pick is no longer an option, or on the server.
 */
export function useChoice<T extends string>(key: string, options: readonly T[], fallback: T) {
  const value = useSyncExternalStore<T>(
    subscribe,
    () => {
      const raw = read(key);
      return options.includes(raw as T) ? (raw as T) : fallback;
    },
    () => fallback,
  );
  const set = useCallback((next: T) => write(key, next), [key]);
  return [value, set] as const;
}
