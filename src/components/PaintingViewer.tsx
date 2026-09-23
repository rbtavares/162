"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PIXELS_PER_BLOCK, type Painting } from "@/data/paintings";
import type { PaletteColor } from "@/lib/simplify";
import { ColorPanel } from "@/components/ColorPanel";
import { PaintingCanvas } from "@/components/PaintingCanvas";
import { PaintingPicker } from "@/components/PaintingPicker";
import { SimplifySlider } from "@/components/SimplifySlider";

type Props = {
  painting: Painting;
  /** Replaces the size readout at the right of the painting header. */
  headerRight?: ReactNode;
};

export function PaintingViewer({ painting, headerRight }: Props) {
  const [colors, setColors] = useState<number | null>(null);
  const [totalColors, setTotalColors] = useState<number | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  // Simplifying can merge the focused color away; drop the focus when it does.
  const focusColor = focus !== null && palette?.some((c) => c.key === focus) ? focus : null;

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-800 md:w-72 md:border-b-0 md:border-r">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
          <Link
            href="/"
            aria-label="Back to gallery"
            title="Back to gallery"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-4"
            >
              <path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" />
            </svg>
          </Link>
          <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">
            Minecraft Painting Guide
          </h1>
        </header>
        <div className="max-h-64 overflow-y-auto p-2 md:max-h-none md:flex-1">
          <PaintingPicker selectedId={painting.id} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight">{painting.title}</h2>
            {painting.author && (
              <p className="truncate text-sm text-zinc-500">by {painting.author}</p>
            )}
          </div>
          {headerRight ?? (
            <p className="shrink-0 text-sm tabular-nums text-zinc-400">
              {painting.width}×{painting.height} blocks ·{" "}
              {painting.width * PIXELS_PER_BLOCK}×{painting.height * PIXELS_PER_BLOCK} px
            </p>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-[60vh] flex-1 md:min-h-0">
              <PaintingCanvas
                painting={painting}
                colors={colors}
                focusColor={focusColor}
                onPalette={setPalette}
                onTotalColors={setTotalColors}
              />
            </div>
            <div className="border-t border-zinc-800 px-6 py-4">
              <SimplifySlider
                colors={colors}
                onChange={setColors}
                total={totalColors}
                colorCount={palette?.length ?? null}
              />
            </div>
          </main>

          <aside className="flex shrink-0 flex-col border-t border-zinc-800 md:w-64 md:border-l md:border-t-0">
            <ColorPanel palette={palette} focusColor={focusColor} onFocusChange={setFocus} />
          </aside>
        </div>
      </div>
    </div>
  );
}
