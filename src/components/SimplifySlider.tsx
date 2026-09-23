"use client";

import { useRef, useState } from "react";
import { minColors } from "@/data/paintings";
import { SIMPLIFY_METHODS, type SimplifyMethod } from "@/lib/simplify";

type Props = {
  /** Target number of colors; null keeps every original color. */
  colors: number | null;
  onChange: (colors: number | null) => void;
  /** Distinct colors in the original painting (null while loading). */
  total: number | null;
  /** Distinct colors actually shown (null while loading). */
  colorCount: number | null;
  /** How the colors are reduced. */
  method: SimplifyMethod;
  onMethodChange: (method: SimplifyMethod) => void;
};

const STEPS = 1000;

/**
 * Maps slider position (0 = realistic, 1 = simplified) to a color count on a
 * log scale so the slider feels even across its range.
 */
function positionToColors(position: number, total: number, min: number) {
  const c = Math.exp(Math.log(total) + (Math.log(min) - Math.log(total)) * position);
  return Math.max(min, Math.min(total, Math.round(c)));
}

function colorsToPosition(colors: number, total: number, min: number) {
  if (total <= min) return 0;
  const c = Math.max(min, Math.min(total, colors));
  return (Math.log(total) - Math.log(c)) / (Math.log(total) - Math.log(min));
}

export function SimplifySlider({ colors, onChange, total, colorCount, method, onMethodChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const min = total === null ? null : minColors(total);
  const cancelled = useRef(false);

  const position =
    total === null || min === null || colors === null ? 0 : colorsToPosition(colors, total, min);
  const disabled = total === null || min === null || total <= min;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || total === null || min === null) return;
    const clamped = Math.max(min, Math.min(total, n));
    onChange(clamped >= total ? null : clamped);
  };

  // The technique only matters once the painting is simplified. The card then
  // widens to the right to show it; the slider keeps its width, so it doesn't
  // move under the pointer that's dragging it.
  const simplified = colors !== null;

  const technique = (
    <label className="flex flex-col items-center gap-1 whitespace-nowrap text-xs text-zinc-500">
      Technique
      <select
        title={SIMPLIFY_METHODS.find((m) => m.id === method)?.description}
        value={method}
        onChange={(e) => onMethodChange(e.target.value as SimplifyMethod)}
        className="h-7 cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-1.5 text-xs text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus-visible:border-accent-400"
      >
        {SIMPLIFY_METHODS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex">
      <div className="w-[18.5rem] max-w-full shrink-0">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">Realistic</span>
          <label className="flex items-center gap-1.5 text-zinc-500">
            <input
              type="text"
              inputMode="numeric"
              aria-label={`Number of colors (${min ?? "…"} to ${total ?? "…"})`}
              title={`${min ?? "…"}–${total ?? "…"}`}
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
              className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-center tabular-nums text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus:border-accent-400"
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
            if (total === null || min === null) return;
            const p = Number(e.target.value) / STEPS;
            onChange(p === 0 ? null : positionToColors(p, total, min));
          }}
          aria-label="Simplification level"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-accent-400 disabled:cursor-default disabled:opacity-50"
        />
      </div>
      <div
        inert={!simplified}
        className={`grid transition-[grid-template-columns,opacity] duration-300 ease-out ${
          simplified ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
        }`}
      >
        <div className="min-w-0 overflow-hidden">
          <div className="ml-3 flex h-full items-center border-l border-zinc-800 pl-3">{technique}</div>
        </div>
      </div>
    </div>
  );
}
