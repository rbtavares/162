"use client";

import { useRef, useState } from "react";
import { MIN_COLORS } from "@/lib/simplify";

type Props = {
  /** Target number of colors; null keeps every original color. */
  colors: number | null;
  onChange: (colors: number | null) => void;
  /** Distinct colors in the original painting (null while loading). */
  total: number | null;
  /** Distinct colors actually shown (null while loading). */
  colorCount: number | null;
};

const STEPS = 1000;

/**
 * Maps slider position (0 = realistic, 1 = simplified) to a color count on a
 * log scale so the slider feels even across its range.
 */
function positionToColors(position: number, total: number) {
  const c = Math.exp(Math.log(total) + (Math.log(MIN_COLORS) - Math.log(total)) * position);
  return Math.max(MIN_COLORS, Math.min(total, Math.round(c)));
}

function colorsToPosition(colors: number, total: number) {
  if (total <= MIN_COLORS) return 0;
  const c = Math.max(MIN_COLORS, Math.min(total, colors));
  return (Math.log(total) - Math.log(c)) / (Math.log(total) - Math.log(MIN_COLORS));
}

export function SimplifySlider({ colors, onChange, total, colorCount }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  const position = total === null || colors === null ? 0 : colorsToPosition(colors, total);
  const disabled = total === null || total <= MIN_COLORS;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || total === null) return;
    const clamped = Math.max(MIN_COLORS, Math.min(total, n));
    onChange(clamped >= total ? null : clamped);
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-300">Realistic</span>
        <label className="flex items-center gap-1.5 text-zinc-500">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Number of colors (${MIN_COLORS} to ${total ?? "…"})`}
            title={`${MIN_COLORS}–${total ?? "…"}`}
            disabled={total === null}
            value={draft ?? (colorCount === null ? "" : String(colorCount))}
            placeholder="…"
            onFocus={(e) => {
              setDraft(e.target.value);
              e.target.select();
            }}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                // Don't let Escape also clear the focused color.
                e.stopPropagation();
                cancelled.current = true;
                e.currentTarget.blur();
              }
            }}
            className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-center tabular-nums text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400"
          />
          {colorCount === 1 ? "color" : "colors"}
        </label>
        <span className="font-medium text-zinc-300">Simplified</span>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(position * STEPS)}
        disabled={disabled}
        onChange={(e) => {
          if (total === null) return;
          const p = Number(e.target.value) / STEPS;
          onChange(p === 0 ? null : positionToColors(p, total));
        }}
        aria-label="Simplification level"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-400 disabled:cursor-default disabled:opacity-50"
      />
    </div>
  );
}
