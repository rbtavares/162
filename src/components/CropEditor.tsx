"use client";

import { useEffect, useRef } from "react";
import { PIXELS_PER_BLOCK } from "@/data/paintings";
import { DEFAULT_CROP, MAX_CROP_ZOOM, cropRect, type Crop } from "@/lib/customPainting";

type Props = {
  /** The uploaded picture. */
  img: HTMLImageElement;
  /** Painting size in blocks, for the block grid over the crop. */
  blocks: { width: number; height: number };
  /** Size (px) of the area the picture fills, and how far it sits inside the painting's edge. */
  picture: { width: number; height: number; inset: number };
  crop: Crop;
  onChange: (crop: Crop) => void;
  onClose: () => void;
};

/** Largest size (CSS px) the picture preview is shown at. */
const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 240;
const STEPS = 1000;

const zoomToPosition = (zoom: number) => Math.log(zoom) / Math.log(MAX_CROP_ZOOM);
const positionToZoom = (p: number) => Math.exp(p * Math.log(MAX_CROP_ZOOM));

/**
 * Shows the whole picture with the part that fills the painting outlined.
 * Drag to move it; the slider or scroll wheel zooms.
 */
export function CropEditor({ img, blocks, picture, crop, onChange, onClose }: Props) {
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
      aria-label="Adjust picture"
      // Phones: pinned under the header. Desktop: hangs off the controls it
      // opens from, so it stays with the page when the page is width-capped.
      className="fixed right-4 top-[4.5rem] z-50 w-[calc(100vw-2rem)] max-w-80 md:absolute md:right-0 md:top-[calc(100%+1.5rem)] rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm shadow-2xl shadow-black/60"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-zinc-100">Adjust picture</h3>
        <p className="text-xs text-zinc-500">Drag to move</p>
      </div>

      <div className="flex justify-center">
        <div
          ref={previewRef}
          tabIndex={0}
          aria-label="Picture placement. Arrow keys move it, Shift for bigger steps."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="relative cursor-move touch-none select-none overflow-hidden rounded outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
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

      <label className="mt-4 flex items-center gap-3 text-xs text-zinc-400">
        <span className="w-9">Zoom</span>
        <input
          type="range"
          min={0}
          max={STEPS}
          value={Math.round(zoomToPosition(crop.zoom) * STEPS)}
          onChange={(e) => zoomTo(positionToZoom(Number(e.target.value) / STEPS))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-accent-400"
        />
        <span className="w-9 text-right tabular-nums">{crop.zoom.toFixed(1)}×</span>
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onChange(DEFAULT_CROP)}
          disabled={!moved}
          className="h-8 rounded-md px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:pointer-events-none disabled:text-zinc-600"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md bg-accent-500 px-3 text-xs font-medium text-zinc-950 transition-colors hover:bg-accent-400"
        >
          Done
        </button>
      </div>
    </div>
  );
}
