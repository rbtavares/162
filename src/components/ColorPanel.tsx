"use client";

import { useEffect } from "react";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* As tall as the page headers beside it, so their bottom borders line up. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3 md:h-16 md:py-0">
        <h3 className="text-sm font-semibold">
          Colors
          {palette && <span className="ml-1.5 font-normal text-zinc-500">{palette.length}</span>}
        </h3>
        <button
          type="button"
          onClick={() => onFocusChange(null)}
          disabled={focusColor === null}
          className="rounded px-2 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:text-zinc-600"
        >
          Show all
        </button>
      </div>
      <ul className="max-h-72 overflow-y-auto p-2 md:max-h-none md:flex-1 md:overscroll-contain">
        {palette?.map((c, i) => {
          const active = c.key === focusColor;
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onFocusChange(active ? null : c.key)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  active ? "bg-zinc-800 ring-1 ring-inset ring-emerald-400" : "hover:bg-zinc-900"
                } ${focusColor !== null && !active ? "opacity-60 hover:opacity-100" : ""}`}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                  {i + 1}
                </span>
                <span
                  className="size-7 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                  style={{ backgroundColor: hex(c.key) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs uppercase text-zinc-200">
                    {hex(c.key)}
                  </span>
                  <span className="block text-xs tabular-nums text-zinc-500">
                    {c.count} px · {((c.count / total) * 100).toFixed(1)}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
