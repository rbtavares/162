"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PIXELS_PER_BLOCK, type Painting } from "@/data/paintings";
import { SIMPLIFY_METHODS, type PaletteColor } from "@/lib/simplify";
import { useChoice } from "@/lib/preferences";
import { ColorPanel } from "@/components/ColorPanel";
import { PaintingCanvas } from "@/components/PaintingCanvas";
import { SimplifySlider } from "@/components/SimplifySlider";
import { useTitleSlot } from "@/components/TitleSlot";
import { useIsDesktop } from "@/lib/useIsDesktop";

type Props = {
  painting: Painting;
  /** Replaces the size readout at the right of the painting header (and sits beside the title on phones). */
  headerRight?: ReactNode;
};

export function PaintingViewer({ painting, headerRight }: Props) {
  const [colors, setColors] = useState<number | null>(null);
  const [method, setMethod] = useChoice(
    "simplify-method",
    SIMPLIFY_METHODS.map((m) => m.id),
    "balanced",
  );
  const [totalColors, setTotalColors] = useState<number | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  // Simplifying can merge the focused color away; drop the focus when it does.
  const focusColor = focus !== null && palette?.some((c) => c.key === focus) ? focus : null;

  // Phones: the title joins the site name in the sidebar's top bar, with the
  // size after the author since there's no room for it on its own.
  const titleSlot = useTitleSlot();
  const isDesktop = useIsDesktop();
  const size = `${painting.width}×${painting.height} blocks`;
  const mobileTitle =
    !isDesktop &&
    titleSlot &&
    createPortal(
      <>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-tight">{painting.title}</h2>
          <p className="truncate text-xs text-zinc-500">
            {painting.author ? `by ${painting.author} · ${size}` : size}
          </p>
        </div>
        {headerRight}
      </>,
      titleSlot,
    );

  return (
    // The colors panel runs the full height beside the painting, header and
    // all; the painting's header only spans the painting.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {mobileTitle}
        <header
          className={`flight-enter-top h-16 ${mobileTitle ? "hidden" : "flex"} shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-6`}
        >
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight">{painting.title}</h2>
            {painting.author && (
              <p className="truncate text-sm text-zinc-500">by {painting.author}</p>
            )}
          </div>
          {!mobileTitle && (headerRight ?? (
            <p className="shrink-0 text-sm tabular-nums text-zinc-400">
              {size} ·{" "}
              {painting.width * PIXELS_PER_BLOCK}×{painting.height * PIXELS_PER_BLOCK} px
            </p>
          ))}
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Phones: a set height, since the page scrolls rather than fitting
              the screen, and the canvas fills its box by percentage, which
              needs one (a min-height alone left it 0 px tall). svh so it
              doesn't resize as the browser's toolbars come and go. */}
          <div className="h-[60svh] md:h-auto md:min-h-0 md:flex-1">
            <PaintingCanvas
              painting={painting}
              colors={colors}
              method={method}
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
                  method={method}
                  onMethodChange={setMethod}
                />
              }
            />
          </div>
        </main>
      </div>

      <aside className="flight-enter-right flex shrink-0 flex-col border-t border-zinc-800 md:w-56 md:border-l md:border-t-0">
        <ColorPanel palette={palette} focusColor={focusColor} onFocusChange={setFocus} />
      </aside>
    </div>
  );
}
