"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PIXELS_PER_BLOCK, paintingSrc, type Painting } from "@/data/paintings";
import { MIN_COLORS, analyzeImage, simplifyToColors, type PaletteColor } from "@/lib/simplify";

type Props = {
  painting: Painting;
  /** Target number of colors; null keeps every original color (realistic). */
  colors: number | null;
  /** Color (0xRRGGBB) to highlight; every other pixel is dimmed. */
  focusColor: number | null;
  onPalette?: (palette: PaletteColor[]) => void;
  /** Reports how many distinct colors the original painting has. */
  onTotalColors?: (total: number) => void;
};

/** Space (CSS px) left around the painting when it is fitted to the view. */
const FIT_GAP = 32;
/** Below this many CSS px per painting pixel the pixel grid is hidden. */
const MIN_GRID_CELL = 4;
/** Zoom limits relative to the fitted size, and absolute max px per pixel. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 16;
const MAX_CELL = 96;
const BUTTON_ZOOM = 1.5;

/** Screen position of painting pixel (0, 0) and CSS px per painting pixel. */
type View = { x: number; y: number; scale: number };

function usePaintingPixels(src: string) {
  const [loaded, setLoaded] = useState<{ src: string; pixels: ImageData } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      setLoaded({ src, pixels: ctx.getImageData(0, 0, off.width, off.height) });
    };
    return () => {
      cancelled = true;
    };
  }, [src]);
  return loaded && loaded.src === src ? loaded.pixels : null;
}

/** Background the dimmed pixels fade toward (matches --background). */
const DIM_BG: [number, number, number] = [16, 16, 18];
const DIM_AMOUNT = 0.85;

/**
 * Keeps pixels of `color` as-is and fades the rest to a dark gray. Also
 * returns a mask (1 per focused pixel) for outlining the focused regions.
 */
function focusImage(image: ImageData, color: number) {
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const mask = new Uint8Array(image.width * image.height);
  const d = out.data;
  const fr = color >> 16;
  const fg = (color >> 8) & 255;
  const fb = color & 255;
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] !== 0 && d[o] === fr && d[o + 1] === fg && d[o + 2] === fb) {
      mask[o / 4] = 1;
      continue;
    }
    const gray = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
    d[o] = DIM_BG[0] * DIM_AMOUNT + gray * (1 - DIM_AMOUNT);
    d[o + 1] = DIM_BG[1] * DIM_AMOUNT + gray * (1 - DIM_AMOUNT);
    d[o + 2] = DIM_BG[2] * DIM_AMOUNT + gray * (1 - DIM_AMOUNT);
  }
  return { image: out, mask };
}

function fitView(width: number, height: number, pw: number, ph: number): View {
  const scale = Math.max(
    0.1,
    Math.min((width - FIT_GAP * 2) / pw, (height - FIT_GAP * 2) / ph),
  );
  return { scale, x: (width - pw * scale) / 2, y: (height - ph * scale) / 2 };
}

/** Groups pixel indices by CSS color so each color is filled in one pass. */
function pixelsByColor(image: ImageData) {
  const groups = new Map<number, number[]>();
  const d = image.data;
  for (let i = 0, o = 0; o < d.length; i++, o += 4) {
    if (d[o + 3] === 0) continue;
    const key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(i);
  }
  return [...groups].map(([key, indices]) => ({
    fill: `#${key.toString(16).padStart(6, "0")}`,
    indices,
  }));
}

export function PaintingCanvas({
  painting,
  colors,
  focusColor,
  onPalette,
  onTotalColors,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The user's zoom/pan for this image; null means fitted to the view. Keyed by
  // image rather than id so resizing a custom painting refits it.
  const [userView, setUserView] = useState<{ src: string; view: View } | null>(null);

  const pw = painting.width * PIXELS_PER_BLOCK;
  const ph = painting.height * PIXELS_PER_BLOCK;

  const src = paintingSrc(painting);
  const pixels = usePaintingPixels(src);

  const analysis = useMemo(() => (pixels ? analyzeImage(pixels) : null), [pixels]);

  useEffect(() => {
    if (analysis) onTotalColors?.(analysis.colors.length);
  }, [analysis, onTotalColors]);

  const simplified = useMemo(() => {
    if (!analysis) return null;
    const total = analysis.colors.length;
    const target = colors === null ? total : Math.max(MIN_COLORS, Math.min(total, colors));
    return simplifyToColors(analysis, target);
  }, [analysis, colors]);

  useEffect(() => {
    if (simplified) onPalette?.(simplified.palette);
  }, [simplified, onPalette]);

  const display = useMemo(() => {
    if (!simplified) return null;
    const { image, mask } =
      focusColor === null
        ? { image: simplified.image, mask: null }
        : focusImage(simplified.image, focusColor);
    return { mask, fills: pixelsByColor(image) };
  }, [simplified, focusColor]);

  const fitted = useMemo(
    () => fitView(size.width, size.height, pw, ph),
    [size.width, size.height, pw, ph],
  );
  const zoomed = userView !== null && userView.src === src;
  const view = zoomed ? userView.view : fitted;

  // Latest values for the event handlers attached outside React.
  const latest = useRef({ view, fitted, src });
  useEffect(() => {
    latest.current = { view, fitted, src };
  });

  const setView = useCallback(
    (next: View) => setUserView({ src: latest.current.src, view: next }),
    [],
  );

  /** Zooms by `factor` keeping screen point (cx, cy) fixed. */
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const { view: v, fitted: f } = latest.current;
      const max = Math.max(f.scale * MAX_ZOOM, MAX_CELL);
      const scale = Math.min(max, Math.max(f.scale * MIN_ZOOM, v.scale * factor));
      const k = scale / v.scale;
      setView({ scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    },
    [setView],
  );

  // Track the available space.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({ width, height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel / trackpad pinch zooms around the pointer. Attached manually because
  // React's wheel listener is passive and can't prevent page scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      // Pinch gestures arrive as ctrl+wheel with small deltas; scale them up.
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 4 : 1);
      zoomAt(Math.exp(-delta * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Drag to pan; two fingers to pinch-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const others = [...pts].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = latest.current.view;
    if (others.length === 0) {
      setView({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y });
      return;
    }
    // Pinch: scale by the change in finger distance around their midpoint,
    // and pan by how far the midpoint moved.
    const o = others[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const before = Math.hypot(prev.x - o.x, prev.y - o.y);
    const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
    if (before < 1) return;
    const mx = (e.clientX + o.x) / 2 - rect.left;
    const my = (e.clientY + o.y) / 2 - rect.top;
    const panned = {
      ...v,
      x: v.x + (e.clientX - prev.x) / 2,
      y: v.y + (e.clientY - prev.y) / 2,
    };
    latest.current.view = panned;
    zoomAt(after / before, mx, my);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  // Draw the painting and the pixel grid.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !display || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = size;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Pixel edges snapped to whole CSS px so fills and grid lines line up.
    const ex = (x: number) => Math.round(view.x + x * view.scale);
    const ey = (y: number) => Math.round(view.y + y * view.scale);
    const left = ex(0);
    const top = ey(0);
    const right = ex(pw);
    const bottom = ey(ph);

    // Drop shadow and hairline frame behind the painting.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = "#000";
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left - 0.5, top - 0.5, right - left + 1, bottom - top + 1);

    const cols = new Int32Array(pw + 1);
    const rows = new Int32Array(ph + 1);
    for (let x = 0; x <= pw; x++) cols[x] = ex(x);
    for (let y = 0; y <= ph; y++) rows[y] = ey(y);

    for (const { fill, indices } of display.fills) {
      ctx.fillStyle = fill;
      for (const i of indices) {
        const x = i % pw;
        const y = (i - x) / pw;
        ctx.fillRect(cols[x], rows[y], cols[x + 1] - cols[x], rows[y + 1] - rows[y]);
      }
    }

    // Pixel grid, hidden when zoomed out too far to be useful.
    if (view.scale >= MIN_GRID_CELL) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      for (let x = 1; x < pw; x++) {
        ctx.moveTo(cols[x] + 0.5, top);
        ctx.lineTo(cols[x] + 0.5, bottom);
      }
      for (let y = 1; y < ph; y++) {
        ctx.moveTo(left, rows[y] + 0.5);
        ctx.lineTo(right, rows[y] + 0.5);
      }
      ctx.stroke();
    }

    // Block boundaries
    if (painting.width > 1 || painting.height > 1) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      for (let bx = 1; bx < painting.width; bx++) {
        const px = cols[bx * PIXELS_PER_BLOCK];
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
      }
      for (let by = 1; by < painting.height; by++) {
        const py = rows[by * PIXELS_PER_BLOCK];
        ctx.moveTo(left, py);
        ctx.lineTo(right, py);
      }
      ctx.stroke();
    }

    // Outline the focused regions: an edge wherever a focused pixel meets an
    // unfocused one or the painting border.
    const { mask } = display;
    if (mask) {
      const atX = (x: number) => Math.min(cols[x] + 0.5, right - 0.5);
      const atY = (y: number) => Math.min(rows[y] + 0.5, bottom - 0.5);
      const on = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < pw && y < ph && mask[y * pw + x] === 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          if (!on(x, y)) continue;
          if (!on(x, y - 1)) {
            ctx.moveTo(atX(x), atY(y));
            ctx.lineTo(atX(x + 1), atY(y));
          }
          if (!on(x, y + 1)) {
            ctx.moveTo(atX(x), atY(y + 1));
            ctx.lineTo(atX(x + 1), atY(y + 1));
          }
          if (!on(x - 1, y)) {
            ctx.moveTo(atX(x), atY(y));
            ctx.lineTo(atX(x), atY(y + 1));
          }
          if (!on(x + 1, y)) {
            ctx.moveTo(atX(x + 1), atY(y));
            ctx.lineTo(atX(x + 1), atY(y + 1));
          }
        }
      }
      ctx.stroke();
    }
  }, [painting, pw, ph, size, view, display]);

  const center = () => [size.width / 2, size.height / 2] as const;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${painting.title}, ${pw} by ${ph} pixels`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`absolute inset-0 h-full w-full touch-none select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/90 text-sm text-zinc-300 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => zoomAt(1 / BUTTON_ZOOM, ...center())}
          aria-label="Zoom out"
          className="size-8 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-zinc-500">
          {Math.round((view.scale / fitted.scale) * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomAt(BUTTON_ZOOM, ...center())}
          aria-label="Zoom in"
          className="size-8 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setUserView(null)}
          disabled={!zoomed}
          className="h-8 border-l border-zinc-800 px-3 text-xs font-medium transition-colors hover:bg-zinc-800 hover:text-white disabled:pointer-events-none disabled:text-zinc-600"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
