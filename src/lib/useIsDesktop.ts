"use client";

import { useSyncExternalStore } from "react";

/** Matches Tailwind's `md` breakpoint, where the viewer's panels sit side by side. */
const DESKTOP = "(min-width: 48rem)";

function subscribe(onChange: () => void) {
  const query = matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the screen is at least `md` wide; true on the server. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => matchMedia(DESKTOP).matches, () => true);
}
