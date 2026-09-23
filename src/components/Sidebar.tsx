"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CUSTOM_ID } from "@/data/paintings";
import { PaintingPicker } from "@/components/PaintingPicker";
import { usePreference } from "@/lib/preferences";

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

  return (
    <aside
      className={`flight-enter-left flex shrink-0 flex-col border-b border-zinc-800 md:border-b-0 md:border-r ${
        rail ? "md:w-16" : "md:w-72"
      }`}
    >
      <header
        className={`flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 ${
          rail ? "md:justify-center md:px-0" : ""
        }`}
      >
        <div className={`min-w-0 ${rail ? "md:hidden" : ""}`}>
          <h1 className="truncate text-sm font-semibold tracking-tight">Minecraft Painting Guide</h1>
          <Link
            href="/"
            className="group/back -ml-0.5 inline-flex items-center gap-0.5 text-xs text-zinc-500 transition-colors hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-3 transition-transform group-hover/back:-translate-x-0.5"
            >
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
            Back to gallery
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="painting-list"
          aria-label={collapsed ? "Show paintings" : "Hide paintings"}
          title={collapsed ? "Show paintings" : "Hide paintings"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <SidebarIcon className="size-4" />
        </button>
      </header>
      <div
        id="painting-list"
        className={`max-h-64 overflow-y-auto p-2 md:block md:max-h-none md:flex-1 ${
          collapsedChoice === false ? "" : "hidden"
        } ${
          // A scrollbar would take a quarter of the narrow strip; it still scrolls.
          rail ? "md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden" : ""
        }`}
      >
        <PaintingPicker selectedId={selectedId} compact={rail} />
      </div>
    </aside>
  );
}

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
      <path d="M6 2.75v10.5" />
    </svg>
  );
}
