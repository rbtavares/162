"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CUSTOM_ID } from "@/data/paintings";
import { SITE_NAME } from "@/data/site";
import { Credits } from "@/components/Credits";
import { OverlayScrollbar } from "@/components/OverlayScrollbar";
import { PaintingPicker } from "@/components/PaintingPicker";
import { usePreference } from "@/lib/preferences";
import { prefersReducedMotion } from "@/lib/paintingFlight";

/** How long the sidebar takes to widen or narrow (matches duration-300 below). */
const SLIDE_MS = 300;

/** Matches Tailwind's `md` breakpoint, where the sidebar moves to the side. */
const DESKTOP = "(min-width: 48rem)";

function subscribeDesktop(onChange: () => void) {
  const query = matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => matchMedia(DESKTOP).matches, () => true);
}

/** The painting the current page shows, from the URL. */
function useSelectedId() {
  const pathname = usePathname();
  if (pathname === "/custom") return CUSTOM_ID;
  return decodeURIComponent(pathname.match(/^\/painting\/([^/]+)/)?.[1] ?? "");
}

/**
 * The list of paintings beside the viewer. It lives in the viewer layout, so
 * it stays mounted (keeping its scroll position) while pages change.
 */
export function Sidebar() {
  const selectedId = useSelectedId();

  // Starts open on desktop and closed on phones, where it sits above the
  // painting; once toggled, the choice is remembered. Until then the
  // responsive classes below do the work, so phones never flash it open.
  const [collapsedChoice, setCollapsed] = usePreference("sidebar-collapsed", null);
  const isDesktop = useIsDesktop();
  const collapsed = collapsedChoice ?? !isDesktop;
  // Desktop only: a thin strip of thumbnails.
  const rail = collapsedChoice === true;
  // Phones: the list is shown only once opened.
  const listOpen = collapsedChoice === false;

  // Collapsing, the sidebar narrows with its full list still in place (names
  // cut off as it goes) and only then switches to the compact strip, whose
  // thumbnails sit where the full list's were. Expanding switches straight
  // back, and the names are revealed as it widens.
  const listRef = useRef<HTMLDivElement>(null);
  const [narrowing, setNarrowing] = useState(false);
  const compact = rail && !narrowing;
  const narrowTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const settle = () => {
    clearTimeout(narrowTimer.current);
    setNarrowing(false);
  };
  useEffect(() => () => clearTimeout(narrowTimer.current), []);

  const toggle = () => {
    if (!collapsed && isDesktop && !prefersReducedMotion()) {
      setNarrowing(true);
      // In case the width transition doesn't run or report its end.
      narrowTimer.current = setTimeout(settle, SLIDE_MS + 100);
    } else {
      settle();
    }
    setCollapsed(!collapsed);
  };

  return (
    <aside
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "width") settle();
      }}
      className={`flight-enter-left flex shrink-0 flex-col border-b border-zinc-800 md:overflow-hidden md:border-b-0 md:border-r md:transition-[width] md:duration-300 md:ease-in-out motion-reduce:transition-none ${
        rail ? "md:w-16" : "md:w-72"
      }`}
    >
      <header
        className={`flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 ${
          compact ? "md:justify-center md:px-0" : ""
        }`}
      >
        <h1 className={`min-w-0 overflow-hidden ${compact ? "md:hidden" : ""}`}>
          {/* The name doubles as the way back to the gallery. */}
          <Link
            href="/"
            title="Back to gallery"
            className="shimmer-text rounded-sm text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            {SITE_NAME}
          </Link>
        </h1>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="painting-list"
          aria-label={collapsed ? "Show paintings" : "Hide paintings"}
          title={collapsed ? "Show paintings" : "Hide paintings"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-accent-400"
        >
          {/* Points where the sidebar goes: left/right beside the page on
              desktop, up/down above it on phones. */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`size-4 transition-transform duration-200 ${
              collapsed ? "-rotate-90 md:rotate-180" : "rotate-90 md:rotate-0"
            }`}
          >
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>
      </header>
      {/* On phones the list slides open and shut (its row grows from nothing);
          on desktop it simply fills the sidebar. */}
      <div
        inert={!isDesktop && !listOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none md:flex md:min-h-0 md:flex-1 md:flex-col ${
          listOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="relative flex min-h-0 max-h-64 flex-col overflow-hidden md:max-h-none md:flex-1">
          <div
            ref={listRef}
            id="painting-list"
            // `relative` keeps the collapsed list's screen-reader-only labels (which
            // are absolutely positioned) inside it; otherwise they stretch the page.
            className="relative min-h-0 flex-1 overflow-y-auto md:overscroll-contain"
          >
            <div className="p-2">
              <PaintingPicker selectedId={selectedId} compact={compact} />
            </div>
          </div>
          <OverlayScrollbar viewport={listRef} />
        </div>
      </div>
      {/* Desktop only, and not in the thumbnail strip, which is too narrow.
          Kept to one line: while the sidebar narrows it's cut off like the
          painting names rather than rewrapping. */}
      <footer
        className={`hidden shrink-0 overflow-hidden whitespace-nowrap border-t border-zinc-800 px-2 py-2 text-xs leading-4 text-zinc-500 ${
          compact ? "" : "md:block"
        }`}
      >
        <Credits />
      </footer>
    </aside>
  );
}
