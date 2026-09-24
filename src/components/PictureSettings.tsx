"use client";

import { useEffect, useRef, useState } from "react";
import { PIXELS_PER_BLOCK } from "@/data/paintings";
import { CUSTOM_MAX_BLOCKS, DEFAULT_CROP, FRAMES, MAX_CROP_ZOOM, cropRect, findFrame, type Crop, type Frame } from "@/lib/customPainting";

type Props = {
  /** The uploaded picture, and its file name. */
  img: HTMLImageElement;
  name: string;
  /** Painting size in blocks. */
  blocks: { width: number; height: number };
  onBlocks: (size: { width?: number; height?: number }) => void;
  /** Size (px) of the area the picture fills, and how far it sits inside the painting's edge. */
  picture: { width: number; height: number; inset: number };
  crop: Crop;
  onChange: (crop: Crop) => void;
  /** Id of the frame around the painting. */
  frame: string;
  onFrame: (id: string) => void;
  /** Swaps in another picture; busy while one is loading. */
  onFile: (file: File | undefined) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
};

/** Largest size (CSS px) the picture preview is shown at. */
const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 240;
const STEPS = 1000;
/** Blocks per side in the size grid; bigger sizes are picked with the selects. */
const GRID_BLOCKS = 6;

const zoomToPosition = (zoom: number) => Math.log(zoom) / Math.log(MAX_CROP_ZOOM);
const positionToZoom = (p: number) => Math.exp(p * Math.log(MAX_CROP_ZOOM));

/**
 * The picture behind the custom painting: swap it for another, pick its
 * frame, and choose which part fills the painting. Shows the whole picture with that part
 * outlined; drag to move it, and the slider or scroll wheel zooms.
 */
export function PictureSettings({
  img,
  name,
  blocks,
  onBlocks,
  picture,
  crop,
  onChange,
  frame,
  onFrame,
  onFile,
  busy,
  error,
  onClose,
}: Props) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(PREVIEW_WIDTH / iw, PREVIEW_HEIGHT / ih);
  const aspect = picture.width / picture.height;
  const rect = cropRect(iw, ih, aspect, crop);

  // Stores the crop's actual center, so dragging past an edge doesn't build
  // up an offset that has to be dragged back first.
  const place = (sx: number, sy: number, zoom: number) => {
    const r = cropRect(iw, ih, aspect, { x: 0.5, y: 0.5, zoom });
    const x = Math.min(iw - r.sw, Math.max(0, sx));
    const y = Math.min(ih - r.sh, Math.max(0, sy));
    onChange({ x: (x + r.sw / 2) / iw, y: (y + r.sh / 2) / ih, zoom });
  };

  /** Zooms keeping the crop's center where it is. */
  const zoomTo = (zoom: number) => {
    const z = Math.min(MAX_CROP_ZOOM, Math.max(1, zoom));
    const r = cropRect(iw, ih, aspect, { ...crop, zoom: z });
    const cx = rect.sx + rect.sw / 2;
    const cy = rect.sy + rect.sh / 2;
    place(cx - r.sw / 2, cy - r.sh / 2, z);
  };

  const latest = useRef({ rect, crop, place, zoomTo });
  useEffect(() => {
    latest.current = { rect, crop, place, zoomTo };
  });

  // Wheel zoom, attached manually so it can stop the page from scrolling.
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { crop, zoomTo } = latest.current;
      zoomTo(crop.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, sx: rect.sx, sy: rect.sy };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { crop, place } = latest.current;
    place(d.sx + (e.clientX - d.x) / scale, d.sy + (e.clientY - d.y) / scale, crop.zoom);
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  // Arrow keys nudge the crop by one painting pixel (ten with Shift).
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const step = (rect.sw / picture.width) * (e.shiftKey ? 10 : 1);
    place(rect.sx + dir[0] * step, rect.sy + dir[1] * step, crop.zoom);
  };

  // Block boundaries inside the crop, as fractions of the picture area.
  const lines = (count: number, size: number) =>
    Array.from({ length: count - 1 }, (_, i) => ((i + 1) * PIXELS_PER_BLOCK - picture.inset) / size);

  const moved = crop.x !== DEFAULT_CROP.x || crop.y !== DEFAULT_CROP.y || crop.zoom !== DEFAULT_CROP.zoom;

  return (
    <div
      role="dialog"
      aria-label="Picture settings"
      // Phones: pinned under the header. Desktop: hangs off the controls it
      // opens from, so it stays with the page when the page is width-capped.
      // Two columns once there's room: the picture, then the painting's size
      // and frame.
      className="fixed right-4 top-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 text-sm shadow-2xl shadow-black/60 md:absolute md:right-0 md:top-[calc(100%+1.5rem)] lg:max-w-[38rem]"
    >
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-zinc-100">Picture settings</h3>
          <p className="truncate text-xs text-zinc-500" title={name}>
            {name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="h-8 shrink-0 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Change picture"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      {error && (
        <p role="alert" className="border-b border-zinc-800 bg-red-500/5 px-4 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-5 p-4 lg:flex-row lg:gap-6">
        <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Placement">
          <SectionLabel
            label="Placement"
            detail={
              <button
                type="button"
                onClick={() => onChange(DEFAULT_CROP)}
                disabled={!moved}
                className="rounded-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400 disabled:pointer-events-none disabled:text-zinc-600"
              >
                Reset
              </button>
            }
          />
          {/* A well the size of the largest preview, so the dialog keeps its
              shape whatever the picture's proportions. */}
          <div
            className="flex items-center justify-center rounded-md bg-zinc-950 p-2 lg:p-3"
            style={{ minHeight: PREVIEW_HEIGHT + 16 }}
          >
            <div
              ref={previewRef}
              tabIndex={0}
              aria-label="Picture placement. Arrow keys move it, Shift for bigger steps."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className="relative cursor-move touch-none select-none overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              style={{ width: iw * scale, height: ih * scale }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" draggable={false} className="absolute inset-0 size-full" />
              <div
                className="absolute outline outline-2 outline-white/90"
                style={{
                  left: rect.sx * scale,
                  top: rect.sy * scale,
                  width: rect.sw * scale,
                  height: rect.sh * scale,
                  boxShadow: "0 0 0 9999px rgba(9,9,11,0.65)",
                }}
              >
                <svg className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 1 1" aria-hidden>
                  {lines(blocks.width, picture.width).map((x) => (
                    <line key={`x${x}`} x1={x} x2={x} y1={0} y2={1} />
                  ))}
                  {lines(blocks.height, picture.height).map((y) => (
                    <line key={`y${y}`} x1={0} x2={1} y1={y} y2={y} />
                  ))}
                  <style>{`line { stroke: rgba(255,255,255,0.45); stroke-width: 1px; vector-effect: non-scaling-stroke; }`}</style>
                </svg>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 text-xs text-zinc-400">
            <span>Zoom</span>
            <input
              type="range"
              min={0}
              max={STEPS}
              value={Math.round(zoomToPosition(crop.zoom) * STEPS)}
              onChange={(e) => zoomTo(positionToZoom(Number(e.target.value) / STEPS))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-zinc-200"
            />
            <span className="w-8 text-right tabular-nums text-zinc-300">{crop.zoom.toFixed(1)}×</span>
          </label>
          <p className="text-xs text-zinc-500">Drag the picture to move it. Scroll or use the slider to zoom.</p>
        </section>

        <div className="flex shrink-0 flex-col gap-5 lg:w-[13rem]">
          <section className="flex flex-col gap-3" aria-label="Size">
            <SectionLabel
              label="Size"
              detail={`${blocks.width * PIXELS_PER_BLOCK}×${blocks.height * PIXELS_PER_BLOCK} px`}
            />
            <BlockGrid blocks={blocks} onPick={onBlocks} />
            <div className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-400">
              <BlockSelect label="Width in blocks" value={blocks.width} onChange={(width) => onBlocks({ width })} />
              <span aria-hidden>×</span>
              <BlockSelect label="Height in blocks" value={blocks.height} onChange={(height) => onBlocks({ height })} />
              <span>blocks</span>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel id="frame-label" label="Frame" detail={findFrame(frame).name} />
            <div role="radiogroup" aria-labelledby="frame-label" className="grid grid-cols-8 gap-1.5 lg:grid-cols-4 lg:gap-2">
              {FRAMES.map((f) => (
                <label key={f.id} title={f.name} className="cursor-pointer">
                  <input
                    type="radio"
                    name="frame"
                    value={f.id}
                    checked={f.id === frame}
                    onChange={() => onFrame(f.id)}
                    aria-label={f.name}
                    className="peer sr-only"
                  />
                  <FrameSwatch frame={f} />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="flex justify-end border-t border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

/** A section's name, with a value or action at the other end. */
function SectionLabel({ id, label, detail }: { id?: string; label: string; detail?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <p id={id} className="font-medium text-zinc-300">
        {label}
      </p>
      <div className="tabular-nums text-zinc-500">{detail}</div>
    </div>
  );
}

/**
 * The painting's size picked straight from a grid of blocks, like picking a
 * table size in a word processor: point at the bottom-right block and click.
 * Covers the common sizes, up to 6×6; the selects under it go up to the
 * maximum, and are the way in for keyboards.
 */
function BlockGrid({
  blocks,
  onPick,
}: {
  blocks: { width: number; height: number };
  onPick: (size: { width: number; height: number }) => void;
}) {
  const [hover, setHover] = useState<{ width: number; height: number } | null>(null);
  const shown = hover ?? blocks;

  const at = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(GRID_BLOCKS, Math.max(1, Math.ceil(v * GRID_BLOCKS)));
    return { width: clamp((e.clientX - r.left) / r.width), height: clamp((e.clientY - r.top) / r.height) };
  };

  return (
    // Wide screens only: on phones it would double the dialog's length.
    <div className="relative hidden lg:block">
      <div
        aria-hidden
        onPointerMove={(e) => e.pointerType === "mouse" && setHover(at(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onPick(at(e))}
        className="grid aspect-square w-full cursor-pointer grid-cols-6 gap-1"
      >
        {Array.from({ length: GRID_BLOCKS * GRID_BLOCKS }, (_, i) => {
          const x = i % GRID_BLOCKS;
          const y = Math.floor(i / GRID_BLOCKS);
          const inShown = x < shown.width && y < shown.height;
          const inSaved = x < blocks.width && y < blocks.height;
          return (
            <span
              key={i}
              className={`rounded-sm transition-colors duration-75 ${
                inShown ? (hover && !inSaved ? "bg-zinc-500" : "bg-zinc-200") : hover && inSaved ? "bg-zinc-600" : "bg-zinc-800"
              }`}
            />
          );
        })}
      </div>
      {/* While pointing, the size a click would pick. */}
      {hover && (
        <p className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-sm bg-zinc-950/90 px-1.5 py-0.5 text-xs tabular-nums text-zinc-100">
          {hover.width}×{hover.height}
        </p>
      )}
    </div>
  );
}

/**
 * A frame drawn as a tiny frame: its wood as a border around a dark canvas,
 * or a dashed outline for none. Rings when chosen (it follows a radio input).
 */
function FrameSwatch({ frame }: { frame: Frame }) {
  const wood = frame.shades.length > 0;
  return (
    <span
      aria-hidden
      className={`flex aspect-square w-full items-center justify-center rounded-sm ring-offset-2 ring-offset-zinc-900 transition-shadow hover:ring-1 hover:ring-zinc-500 peer-checked:ring-2 peer-checked:ring-zinc-100 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400 ${
        wood ? "" : "border border-dashed border-zinc-600"
      }`}
      style={wood ? { background: `linear-gradient(135deg, ${frame.corner}, ${frame.shades.join(", ")})` } : undefined}
    >
      <span className={`size-[62%] ${wood ? "bg-zinc-800 shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]" : "bg-zinc-800/50"}`} />
    </span>
  );
}

function BlockSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-zinc-200 outline-none transition-colors hover:border-zinc-600 focus-visible:border-accent-400"
    >
      {Array.from({ length: CUSTOM_MAX_BLOCKS }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
