"use client";

import { useState, type ReactNode } from "react";
import { PIXELS_PER_BLOCK, type Painting } from "@/data/paintings";
import type { PaletteColor } from "@/lib/simplify";
import { ColorPanel } from "@/components/ColorPanel";
import { PaintingCanvas } from "@/components/PaintingCanvas";
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flight-enter-top flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-6">
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
              // Clicking the highlighted color again clears the highlight.
              onPickColor={(color) => setFocus(color === focusColor ? null : color)}
              controls={
                <SimplifySlider
                  colors={colors}
                  onChange={setColors}
                  total={totalColors}
                  colorCount={palette?.length ?? null}
                />
              }
            />
          </div>
        </main>

        <aside className="flight-enter-right flex shrink-0 flex-col border-t border-zinc-800 md:w-64 md:border-l md:border-t-0">
          <ColorPanel palette={palette} focusColor={focusColor} onFocusChange={setFocus} />
        </aside>
      </div>
    </div>
  );
}
