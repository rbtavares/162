"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CUSTOM_ID, type Painting } from "@/data/paintings";
import {
  CUSTOM_MAX_BLOCKS,
  DEFAULT_CROP,
  DEFAULT_FRAME,
  MAX_CROP_ZOOM,
  findFrame,
  loadImage,
  renderPainting,
  type Crop,
} from "@/lib/customPainting";

export type Custom = {
  name: string;
  /** The uploaded picture, downscaled, as a PNG data URL. */
  source: string;
  width: number;
  height: number;
  /** Id of one of FRAMES. */
  frame: string;
  /** Which part of the picture fills the painting. */
  crop: Crop;
};

/*
 * The custom painting lives in memory and, when it fits, in localStorage so it
 * survives reloads. Storage can be full or blocked; the page works without it.
 */
const STORAGE_KEY = "custom-painting";
const listeners = new Set<() => void>();
/** Serialized Custom, null when there is none, undefined until read. */
let stored: string | null | undefined;

// Follow changes made in other tabs.
function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  stored = e.newValue;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  if (stored === undefined) {
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
  }
  return stored;
}

export function writeCustom(custom: Custom) {
  stored = JSON.stringify(custom);
  try {
    localStorage.setItem(STORAGE_KEY, stored);
  } catch {
    // Too big or blocked; keep it for this visit only.
  }
  listeners.forEach((l) => l());
}

function parseCustom(raw: string | null): Custom | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    const blocks = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= CUSTOM_MAX_BLOCKS;
    if (typeof c?.name === "string" && typeof c.source === "string" && blocks(c.width) && blocks(c.height)) {
      // Fill in settings saved before they existed, and drop broken ones.
      const inRange = (n: unknown, lo: number, hi: number) =>
        typeof n === "number" && n >= lo && n <= hi;
      const crop =
        inRange(c.crop?.x, 0, 1) && inRange(c.crop?.y, 0, 1) && inRange(c.crop?.zoom, 1, MAX_CROP_ZOOM)
          ? { x: c.crop.x, y: c.crop.y, zoom: c.crop.zoom }
          : DEFAULT_CROP;
      const frame = typeof c.frame === "string" ? findFrame(c.frame).id : DEFAULT_FRAME;
      return { ...c, frame, crop };
    }
  } catch {}
  return null;
}

/** The saved custom painting right now, outside of React. */
export function readCustom() {
  return parseCustom(getSnapshot() ?? null);
}

/**
 * The saved custom painting: undefined until storage has been read (on the
 * server and during hydration), then the painting or null.
 */
export function useCustom() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseCustom(raw)), [raw]);
}

/** Decoded pictures, kept across pages so the sidebar and gallery don't reload them. */
const images = new Map<string, Promise<HTMLImageElement>>();

/** Decodes the uploaded picture. `failed` is true when it can't be read. */
export function useCustomImage(source: string | undefined) {
  const [state, setState] = useState<{ source: string; img: HTMLImageElement | null } | null>(null);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let promise = images.get(source);
    if (!promise) {
      // Only the current picture is worth keeping.
      images.clear();
      promise = loadImage(source);
      images.set(source, promise);
    }
    promise.then(
      (img) => !cancelled && setState({ source, img }),
      () => {
        images.delete(source);
        if (!cancelled) setState({ source, img: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);
  const current = state && state.source === source ? state : null;
  return { img: current?.img ?? null, failed: current !== null && current.img === null };
}

/** The last render, so pages showing the same painting don't redo it. */
let lastRender: { img: HTMLImageElement; key: string; src: string } | null = null;

/** The custom painting as a Painting, rendered with `crop` (defaults to its saved one). */
export function customPainting(img: HTMLImageElement, custom: Custom, crop = custom.crop): Painting {
  const key = [custom.width, custom.height, custom.frame, crop.x, crop.y, crop.zoom].join();
  if (lastRender?.img !== img || lastRender.key !== key) {
    lastRender = { img, key, src: renderPainting(img, custom.width, custom.height, custom.frame, crop) };
  }
  return {
    id: CUSTOM_ID,
    title: custom.name,
    author: "",
    width: custom.width,
    height: custom.height,
    src: lastRender.src,
  };
}

/**
 * The saved custom painting, rendered, for previews. Null when there is
 * none, or while it loads.
 */
export function useCustomPainting() {
  const custom = useCustom();
  const { img } = useCustomImage(custom?.source);
  return useMemo(() => (custom && img ? customPainting(img, custom) : null), [custom, img]);
}
