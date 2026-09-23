"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PIXELS_PER_BLOCK, minColors, paintingSrc, type Painting } from "@/data/paintings";
import { analyzeImage, simplifyToColors, type PaletteColor } from "@/lib/simplify";
import { usePreference } from "@/lib/preferences";
import {
  currentFlight,
  landFlight,
  midAir,
  prefersReducedMotion,
  revealFlight,
  startFlight,
  useFlight,
  useFlightStage,
  type Rect,
} from "@/lib/paintingFlight";

type Props = {
  painting: Painting;
  /** Target number of colors; null keeps every original color (realistic). */
  colors: number | null;
  /** Color (0xRRGGBB) to highlight; every other pixel is dimmed. */
  focusColor: number | null;
  onPalette?: (palette: PaletteColor[]) => void;
  /** Reports how many distinct colors the original painting has. */
  onTotalColors?: (total: number) => void;
  /** Called with the displayed color (0xRRGGBB) of a clicked pixel. */
  onPickColor?: (color: number) => void;
  /** Floating panel at the bottom left, beside the view controls. */
  controls?: ReactNode;
};

/** Space (CSS px) left around the painting when it is fitted to the view; room for the pixel numbers. */
const FIT_GAP = 40;
/** Extra space kept clear above and below the fitted painting for the floating controls. */
const FIT_TOP = 28;
const FIT_BOTTOM = 56;
/** Below this many CSS px per painting pixel the pixel grid is hidden. */
const MIN_GRID_CELL = 4;
/** Zoom limits relative to the fitted size, and absolute max px per pixel. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 16;
const MAX_CELL = 96;
const BUTTON_ZOOM = 1.5;
/** How far (CSS px) a pointer can move and still count as a click. */
const CLICK_SLOP = 5;

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

/** Gap (CSS px) between the painting's edge and its pixel numbers. */
const NUMBER_GAP = 6;
/** Label steps tried, smallest first, when numbers don't all fit. */
const NUMBER_STEPS = [1, 2, 5, 10, 20, 50, 100];
const NUMBER_COLOR = "rgba(161,161,170,0.9)";
const NUMBER_LIT = "rgba(255,255,255,1)";
const NUMBER_DIM = "rgba(113,113,122,0.3)";
/** Band behind the numbers once they stick to the view's edge over the painting. */
const NUMBER_BAND = "rgba(16,16,18,0.85)";

let numberFont: string | null = null;

/**
 * Numbers the painting's columns along its top edge and rows along its left
 * edge, counting from 1. They thin out to every 2nd, 5th, 10th… when pixels
 * are too small for all of them, stick to the view's edge when the painting's
 * edge is scrolled away, and dim where the focused color isn't present.
 */
function drawNumbers(
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    /** Screen x of every column edge and y of every row edge. */
    cols: Int32Array;
    rows: Int32Array;
    box: { left: number; top: number; right: number; bottom: number };
    scale: number;
    focusLines: { cols: Uint8Array; rows: Uint8Array } | null;
  },
) {
  const { width: w, height: h, cols, rows, box, scale, focusLines } = opts;
  const pw = cols.length - 1;
  const ph = rows.length - 1;
  numberFont ??= getComputedStyle(document.body).fontFamily || "sans-serif";
  const size = Math.round(Math.min(12, Math.max(9, scale * 0.5)));
  ctx.font = `${size}px ${numberFont}`;
  const digitWidth = ctx.measureText("0").width;
  const labelWidth = (n: number) => String(n).length * digitWidth;

  const colStep = NUMBER_STEPS.find((s) => s * scale >= labelWidth(pw) + 4) ?? 100;
  const rowStep = NUMBER_STEPS.find((s) => s * scale >= size + 2) ?? 100;
  const color = (lit: Uint8Array | undefined, i: number) =>
    !lit ? NUMBER_COLOR : lit[i] ? NUMBER_LIT : NUMBER_DIM;

  // Top: centered over each column, above the painting or pinned to the top.
  const y = Math.max(box.top - NUMBER_GAP - size / 2, size / 2 + 4);
  if (y + size / 2 + NUMBER_GAP > box.top) {
    ctx.fillStyle = NUMBER_BAND;
    ctx.fillRect(Math.max(0, box.left), 0, Math.min(w, box.right) - Math.max(0, box.left), y + size / 2 + 4);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = colStep - 1; x < pw; x += colStep) {
    const cx = (cols[x] + cols[x + 1]) / 2;
    if (cx < -20 || cx > w + 20) continue;
    ctx.fillStyle = color(focusLines?.cols, x);
    ctx.fillText(String(x + 1), cx, y);
  }

  // Left: right-aligned beside each row, left of the painting or pinned to the left.
  const wide = labelWidth(ph);
  const x = Math.max(box.left - NUMBER_GAP, wide + 8);
  if (x + NUMBER_GAP > box.left) {
    ctx.fillStyle = NUMBER_BAND;
    ctx.fillRect(0, Math.max(0, box.top), x + 4, Math.min(h, box.bottom) - Math.max(0, box.top));
  }
  ctx.textAlign = "right";
  for (let r = rowStep - 1; r < ph; r += rowStep) {
    const cy = (rows[r] + rows[r + 1]) / 2;
    if (cy < -20 || cy > h + 20) continue;
    ctx.fillStyle = color(focusLines?.rows, r);
    ctx.fillText(String(r + 1), x, cy);
  }
}

function fitView(width: number, height: number, pw: number, ph: number): View {
  const top = FIT_GAP + FIT_TOP;
  const bottom = FIT_GAP + FIT_BOTTOM;
  const scale = Math.max(
    0.1,
    Math.min((width - FIT_GAP * 2) / pw, (height - top - bottom) / ph),
  );
  return { scale, x: (width - pw * scale) / 2, y: top + (height - top - bottom - ph * scale) / 2 };
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
  onPickColor,
  controls,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Everything drawn over the painting, on its own layer so it can fade in as one. */
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The user's zoom/pan for this image; null means fitted to the view. Keyed by
  // image rather than id so resizing a custom painting refits it.
  const [userView, setUserView] = useState<{ src: string; view: View } | null>(null);

  const pw = painting.width * PIXELS_PER_BLOCK;
  const ph = painting.height * PIXELS_PER_BLOCK;

  const src = paintingSrc(painting);
  const pixels = usePaintingPixels(src);
  const [showGrid, setShowGrid] = usePreference("pixel-grid", true);
  const [showBlocks, setShowBlocks] = usePreference("block-edges", true);
  const [showNumbers, setShowNumbers] = usePreference("pixel-numbers", true);
  const hasBlocks = painting.width > 1 || painting.height > 1;

  // Arriving from the gallery, the canvas is hidden while the painting flies in
  // (see paintingFlight). Counting and sorting the colors can block the page
  // for a while on big paintings, so it waits until the painting has landed.
  const flight = useFlight();
  const { inAir: inFlight, covered } = useFlightStage(painting.id);
  const analysis = useMemo(
    () => (pixels && !inFlight ? analyzeImage(pixels) : null),
    [pixels, inFlight],
  );

  useEffect(() => {
    if (analysis) onTotalColors?.(analysis.colors.length);
  }, [analysis, onTotalColors]);

  const simplified = useMemo(() => {
    if (!analysis) return null;
    const total = analysis.colors.length;
    const target = colors === null ? total : Math.max(minColors(total), Math.min(total, colors));
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
    // Rows and columns holding the focused color, so their numbers stay lit.
    let focusLines: { cols: Uint8Array; rows: Uint8Array } | null = null;
    if (mask) {
      focusLines = { cols: new Uint8Array(pw), rows: new Uint8Array(ph) };
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        focusLines.cols[i % pw] = 1;
        focusLines.rows[(i / pw) | 0] = 1;
      }
    }
    return { mask, focusLines, fills: pixelsByColor(image) };
  }, [simplified, focusColor, pw, ph]);

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

  /** Where the painting is on screen with view `v`, edges snapped like the drawing. */
  const screenRect = useCallback(
    (v: View): Rect | null => {
      const wrap = wrapRef.current;
      if (!wrap) return null;
      const box = wrap.getBoundingClientRect();
      const left = Math.round(v.x);
      const top = Math.round(v.y);
      return {
        left: box.left + left,
        top: box.top + top,
        width: Math.round(v.x + pw * v.scale) - left,
        height: Math.round(v.y + ph * v.scale) - top,
      };
    },
    [pw, ph],
  );

  // The painting page end of a flight from the gallery (see paintingFlight):
  // once laid out, say where the painting will sit; the canvas stays hidden
  // until the flying copy has landed there.
  // Reported again whenever the fit changes while it's in the air, e.g. once
  // the previous page's scrollbar is gone.
  useEffect(() => {
    const f = currentFlight();
    if (f?.direction !== "open" || f.painting.id !== painting.id || size.width === 0) return;
    const rect = screenRect(fitted);
    if (rect) landFlight(rect);
  }, [flight, painting.id, size.width, fitted, screenRect]);

  // Heading back to the gallery (its link, or the browser's back button):
  // the painting flies from wherever it is on screen back into its card.
  useEffect(() => {
    const takeOff = () => {
      if (prefersReducedMotion()) return;
      // Still arriving? Turn around from wherever it is in the air.
      const air = midAir(painting.id);
      const from = air?.from ?? screenRect(latest.current.view);
      const orientation = air?.orientation ?? { y: 0, x: 0 };
      if (from) startFlight({ painting, direction: "close", from, orientation });
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((e.target as Element).closest?.('a[href="/"]')) takeOff();
    };
    // Back/forward: the Navigation API announces the traversal before Next
    // swaps pages; popstate (the fallback) can arrive after this page is gone.
    const navigation = (window as { navigation?: EventTarget }).navigation;
    const onNavigate = (e: Event) => {
      const { navigationType, destination } = e as Event & {
        navigationType: string;
        destination: { url: string };
      };
      if (navigationType === "traverse" && new URL(destination.url).pathname === "/") takeOff();
    };
    const onPopState = () => {
      if (location.pathname === "/") takeOff();
    };
    document.addEventListener("click", onClick, true);
    if (navigation) navigation.addEventListener("navigate", onNavigate);
    else window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      navigation?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("popstate", onPopState);
    };
  }, [painting, screenRect]);

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

  /** Painting pixel under a point in the canvas, or null outside the painting. */
  const pixelAt = (cx: number, cy: number) => {
    const v = latest.current.view;
    const x = Math.floor((cx - v.x) / v.scale);
    const y = Math.floor((cy - v.y) / v.scale);
    return x >= 0 && y >= 0 && x < pw && y < ph ? { x, y } : null;
  };

  /** Displayed color under a point in the canvas; null off the painting or on a transparent pixel. */
  const colorAt = (cx: number, cy: number) => {
    const p = pixelAt(cx, cy);
    if (!p || !simplified) return null;
    const d = simplified.image.data;
    const o = (p.y * pw + p.x) * 4;
    return d[o + 3] === 0 ? null : (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
  };

  /*
   * With a mouse or pen, clicking the painting picks a color and dragging it
   * does nothing, so a click that wobbles doesn't nudge the view. Dragging
   * pans off the painting, or anywhere with Cmd/Ctrl held. Touch has no
   * modifier keys, so there a tap picks and a drag always pans. Two fingers
   * pinch-zoom.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ pick: boolean; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Whether the mouse would pick a color where it is, for the cursor.
  const [picking, setPicking] = useState(false);
  const hoverAt = useRef<{ x: number; y: number } | null>(null);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const updatePicking = (point: { x: number; y: number } | null, panKey: boolean) => {
    hoverAt.current = point;
    setPicking(point !== null && !panKey && pixelAt(point.x, point.y) !== null);
  };

  // Pressing or releasing Cmd/Ctrl changes the cursor without the mouse moving.
  const updatePickingRef = useRef(updatePicking);
  useEffect(() => {
    updatePickingRef.current = updatePicking;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Meta" && e.key !== "Control") return;
      updatePickingRef.current(hoverAt.current, e.metaKey || e.ctrlKey);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size > 1) {
      // A second finger turns the gesture into a pinch.
      if (gesture.current) gesture.current = { ...gesture.current, pick: false, moved: true };
      setDragging(true);
      return;
    }
    const point = localPoint(e);
    const pick =
      e.pointerType !== "touch" &&
      e.button === 0 &&
      !(e.metaKey || e.ctrlKey) &&
      pixelAt(point.x, point.y) !== null;
    gesture.current = { pick, ...point, moved: false };
    if (!pick) setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev) {
      if (e.pointerType !== "touch") updatePicking(localPoint(e), e.metaKey || e.ctrlKey);
      return;
    }
    const g = gesture.current;
    if (g && !g.moved) {
      const p = localPoint(e);
      g.moved = Math.hypot(p.x - g.x, p.y - g.y) > CLICK_SLOP;
    }
    if (g?.pick) return;
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

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>, click: boolean) => {
    if (!pointers.current.delete(e.pointerId) || pointers.current.size > 0) return;
    setDragging(false);
    const g = gesture.current;
    gesture.current = null;
    if (click && g && !g.moved && (g.pick || e.pointerType === "touch")) {
      const color = colorAt(g.x, g.y);
      if (color !== null) onPickColor?.(color);
    }
    if (e.pointerType !== "touch") updatePicking(localPoint(e), e.metaKey || e.ctrlKey);
  };

  // Draw the painting on the bottom layer and the shadow, frame, grid, block
  // edges, highlight outline and numbers on the top one. Arriving from the
  // gallery, the painting takes over from the flying copy unseen, then the
  // top layer fades in as one.
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !display || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = size;
    const base = canvas.getContext("2d");
    const ctx = overlay.getContext("2d");
    if (!base || !ctx) return;
    for (const [c, context] of [
      [canvas, base],
      [overlay, ctx],
    ] as const) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);
    }

    // Pixel edges snapped to whole CSS px so fills and grid lines line up.
    const ex = (x: number) => Math.round(view.x + x * view.scale);
    const ey = (y: number) => Math.round(view.y + y * view.scale);
    const left = ex(0);
    const top = ey(0);
    const right = ex(pw);
    const bottom = ey(ph);

    // Drop shadow around the painting, on the top layer but clipped to
    // outside the painting so it doesn't darken it; then the hairline frame.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip("evenodd");
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

    // The painting itself, on black where it's transparent.
    base.fillStyle = "#000";
    base.fillRect(left, top, right - left, bottom - top);
    for (const { fill, indices } of display.fills) {
      base.fillStyle = fill;
      for (const i of indices) {
        const x = i % pw;
        const y = (i - x) / pw;
        base.fillRect(cols[x], rows[y], cols[x + 1] - cols[x], rows[y + 1] - rows[y]);
      }
    }

    // Pixel grid, also hidden when zoomed out too far to be useful.
    if (showGrid && view.scale >= MIN_GRID_CELL) {
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
    if (showBlocks && hasBlocks) {
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

    if (showNumbers) {
      drawNumbers(ctx, {
        width: w,
        height: h,
        cols,
        rows,
        box: { left, top, right, bottom },
        scale: view.scale,
        focusLines: display.focusLines,
      });
    }

    // Drawn: a painting that just flew in can take over from the flying copy.
    if (currentFlight()?.painting.id === painting.id) revealFlight();
  }, [painting, pw, ph, size, view, display, showGrid, showBlocks, hasBlocks, showNumbers]);

  const center = () => [size.width / 2, size.height / 2] as const;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${painting.title}, ${pw} by ${ph} pixels`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, true)}
        onPointerCancel={(e) => endPointer(e, false)}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch" && !pointers.current.size) updatePicking(null, false);
        }}
        className={`absolute inset-0 h-full w-full touch-none select-none ${
          dragging ? "cursor-grabbing" : picking ? "cursor-crosshair" : "cursor-grab"
        } ${covered ? "opacity-0" : ""}`}
      />
      <canvas
        ref={overlayRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150 ${
          covered ? "opacity-0" : ""
        }`}
      />
      <p className="flight-enter-top pointer-events-none absolute left-3 top-3 hidden rounded-md bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-500 backdrop-blur pointer-fine:block">
        Click a pixel to highlight its color · <kbd className="font-sans">⌘/Ctrl</kbd>-drag to pan
      </p>
      <div className="flight-enter-top absolute right-3 top-3 flex items-center gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/90 text-sm text-zinc-300 shadow-lg backdrop-blur">
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
      <div className="flight-enter-bottom pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2 [&>*]:pointer-events-auto">
        {controls && (
          <div className="w-80 max-w-full rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-2 shadow-lg backdrop-blur">
            {controls}
          </div>
        )}
        <div className="ml-auto flex items-center gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/90 shadow-lg backdrop-blur">
          <Switch label="Grid" title="Pixel grid" checked={showGrid} onChange={setShowGrid} />
          <Switch label="Numbers" title="Pixel numbers" checked={showNumbers} onChange={setShowNumbers} />
          <Switch
            label="Blocks"
            title={hasBlocks ? "Block edges" : "Block edges (this painting is a single block)"}
            checked={showBlocks}
            onChange={setShowBlocks}
            disabled={!hasBlocks}
          />
        </div>
      </div>
    </div>
  );
}

function Switch({
  label,
  title,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const on = checked && !disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-8 items-center gap-2 px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400 disabled:pointer-events-none disabled:text-zinc-600"
    >
      <span
        aria-hidden
        className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-zinc-700"}`}
      >
        <span
          className={`absolute top-0.5 size-2.5 rounded-full bg-white shadow transition-[left] ${
            on ? "left-3" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}
