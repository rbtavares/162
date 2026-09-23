"use client";

import { useEffect, useRef, useState } from "react";
import { OverlayScrollbar } from "@/components/OverlayScrollbar";
import { prefersReducedMotion } from "@/lib/paintingFlight";

/** Room (CSS px) left around a square scrolled into view. */
const SCROLL_MARGIN = 12;
import type { PaletteColor } from "@/lib/simplify";

type Props = {
  palette: PaletteColor[] | null;
  focusColor: number | null;
  onFocusChange: (color: number | null) => void;
};

function hex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function ColorPanel({ palette, focusColor, onFocusChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  // Escape clears the focus.
  useEffect(() => {
    if (focusColor === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFocusChange(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusColor, onFocusChange]);

  const total = palette?.reduce((sum, c) => sum + c.count, 0) ?? 0;

  // The selected color's details keep showing the last selection while the
  // section slides shut, instead of going blank.
  const [shownColor, setShownColor] = useState<number | null>(null);
  if (focusColor !== null && focusColor !== shownColor) setShownColor(focusColor);
  const shown = palette?.find((c) => c.key === shownColor) ?? null;
  const open = focusColor !== null;

  // Picking a color (on the painting, say) whose square is out of view scrolls
  // the list, and only the list, just enough to show it. If the selected color
  // section is just opening, it's about to push the list down by its height:
  // aim for where the square will be once it has, and scroll right away, so
  // the push and the scroll happen as one movement.
  const detailsRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (focusColor === null) return;
    const list = listRef.current;
    const square = list?.querySelector(`[data-color="${focusColor}"]`);
    if (!list || !square) return;
    const push = opening ? (detailsRef.current?.offsetHeight ?? 0) : 0;
    const view = list.getBoundingClientRect();
    const box = square.getBoundingClientRect();
    // The push moves the list's top and its content down together, so a square
    // keeps its place relative to the top; the bottom stays, so less fits.
    const above = box.top - view.top - SCROLL_MARGIN;
    const below = box.bottom + push - view.bottom + SCROLL_MARGIN;
    if (above >= 0 && below <= 0) return;
    list.scrollBy({
      top: above < 0 ? above : below,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [focusColor, open]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* As tall as the page headers beside it, so their bottom borders line up. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3 md:h-16 md:py-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Colors</h3>
          <p className="text-xs tabular-nums text-zinc-500">
            {palette ? `${palette.length.toLocaleString()} ${palette.length === 1 ? "color" : "colors"}` : "…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFocusChange(null)}
          disabled={focusColor === null}
          className="rounded px-2 py-1 text-xs font-medium text-accent-300 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:text-zinc-600"
        >
          Show all
        </button>
      </div>
      {/* The selected color, sliding open under the header (its row grows from nothing). */}
      <div
        inert={!open}
        aria-live="polite"
        className={`grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {shown && (
            <div ref={detailsRef} className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
              <span
                className="size-12 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                style={{ backgroundColor: hex(shown.key) }}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Selected color
                </p>
                <p className="font-mono text-sm uppercase text-zinc-100">{hex(shown.key)}</p>
                <p className="text-xs tabular-nums text-zinc-400">
                  {shown.count.toLocaleString()} {shown.count === 1 ? "pixel" : "pixels"} ·{" "}
                  {((shown.count / total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Scrolls with the site's overlay scrollbar (see OverlayScrollbar). */}
      <div className="relative flex min-h-0 max-h-72 flex-col overflow-hidden md:max-h-none md:flex-1">
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto md:overscroll-contain"
        >
          {/* Just the colors, as squares; the selected one's details show above. */}
          <ul className="grid grid-cols-3 gap-2 p-2">
            {palette?.map((c) => {
              const active = c.key === focusColor;
              const details = `${hex(c.key).toUpperCase()}, ${c.count.toLocaleString()} ${
                c.count === 1 ? "pixel" : "pixels"
              }, ${((c.count / total) * 100).toFixed(1)}%`;
              return (
                <li key={c.key} data-color={c.key}>
                  <button
                    type="button"
                    onClick={() => onFocusChange(active ? null : c.key)}
                    aria-pressed={active}
                    aria-label={details}
                    title={details}
                    style={{ backgroundColor: hex(c.key) }}
                    className={`block aspect-square w-full rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 ${
                      active ? "ring-2 ring-accent-400 ring-offset-2 ring-offset-background" : ""
                    } ${focusColor !== null && !active ? "opacity-40 hover:opacity-100" : ""}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <OverlayScrollbar viewport={listRef} />
      </div>
    </div>
  );
}
