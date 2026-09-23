import { PIXELS_PER_BLOCK } from "@/data/paintings";

/** Largest custom painting side, in blocks. */
export const CUSTOM_MAX_BLOCKS = 16;
/** Largest side suggested for a fresh upload (the biggest vanilla painting is 4×4). */
const SUGGESTED_MAX_BLOCKS = 4;
/**
 * Photos have thousands of distinct colors, which is both unpaintable and too
 * slow for the simplifier, so custom paintings are reduced to this many.
 */
const CUSTOM_MAX_COLORS = 256;
/** Longest side (px) the uploaded picture is stored at; enough for 16 blocks. */
const SOURCE_MAX_SIDE = CUSTOM_MAX_BLOCKS * PIXELS_PER_BLOCK * 2;

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { canvas: c, ctx };
}

/**
 * Draws `sx, sy, sw, sh` of `source` at `width × height`. Big reductions are
 * done in halving steps, because one bilinear step skips most source pixels.
 */
function resample(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  width: number,
  height: number,
) {
  let src = source;
  while (sw > width * 2 && sh > height * 2) {
    const w = Math.ceil(sw / 2);
    const h = Math.ceil(sh / 2);
    const step = canvas(w, h);
    step.ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    [src, sx, sy, sw, sh] = [step.canvas, 0, 0, w, h];
  }
  const out = canvas(width, height);
  out.ctx.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);
  return out;
}

/** Reads an uploaded file into a PNG data URL small enough to keep around. */
export async function prepareSource(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new Error("Could not read the image");
    const k = Math.min(1, SOURCE_MAX_SIDE / Math.max(w, h));
    const width = Math.max(1, Math.round(w * k));
    const height = Math.max(1, Math.round(h * k));
    return resample(img, 0, 0, w, h, width, height).canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The painting size (in blocks, up to 4×4) closest to the picture's shape. */
export function suggestSize(width: number, height: number) {
  const aspect = Math.log(width / height);
  let best = { width: 1, height: 1 };
  let bestError = Infinity;
  for (let w = 1; w <= SUGGESTED_MAX_BLOCKS; w++) {
    for (let h = 1; h <= SUGGESTED_MAX_BLOCKS; h++) {
      const error = Math.abs(Math.log(w / h) - aspect);
      // Prefer the larger size when two fit equally well (1×1 vs 4×4).
      if (error < bestError - 1e-9 || (error < bestError + 1e-9 && w * h > best.width * best.height)) {
        best = { width: w, height: h };
        bestError = error;
      }
    }
  }
  return best;
}

type Entry = { key: number; count: number; rgb: [number, number, number] };

/**
 * Median cut: repeatedly splits the box of colors with the widest spread
 * (weighted by pixel count) at its median, then maps every color to the
 * pixel-weighted average of its box.
 */
function medianCut(entries: Entry[], max: number) {
  const spread = (box: Entry[]) => {
    let best = { channel: 0, range: 0 };
    for (let c = 0; c < 3; c++) {
      let lo = 255;
      let hi = 0;
      for (const e of box) {
        lo = Math.min(lo, e.rgb[c]);
        hi = Math.max(hi, e.rgb[c]);
      }
      if (hi - lo > best.range) best = { channel: c, range: hi - lo };
    }
    return best;
  };
  const weight = (box: Entry[]) => box.reduce((n, e) => n + e.count, 0);

  const boxes = [entries];
  while (boxes.length < max) {
    let pick = -1;
    let score = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const s = spread(boxes[i]).range * weight(boxes[i]);
      if (s > score) [pick, score] = [i, s];
    }
    if (pick === -1) break;
    const box = boxes[pick];
    const { channel } = spread(box);
    box.sort((a, b) => a.rgb[channel] - b.rgb[channel]);
    const half = weight(box) / 2;
    let split = 1;
    for (let n = box[0].count; split < box.length - 1 && n + box[split].count <= half; split++) {
      n += box[split].count;
    }
    boxes.splice(pick, 1, box.slice(0, split), box.slice(split));
  }

  const mapping = new Map<number, [number, number, number]>();
  for (const box of boxes) {
    const sum = [0, 0, 0];
    const total = weight(box);
    for (const e of box) for (let c = 0; c < 3; c++) sum[c] += e.rgb[c] * e.count;
    const avg = sum.map((v) => Math.round(v / total)) as [number, number, number];
    for (const e of box) mapping.set(e.key, avg);
  }
  return mapping;
}

/** Makes every pixel fully opaque or fully transparent and caps the color count. */
function toPaintingColors(image: ImageData) {
  const d = image.data;
  const counts = new Map<number, number>();
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] < 128) {
      d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
      continue;
    }
    d[o + 3] = 255;
    const key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size <= CUSTOM_MAX_COLORS) return;

  const entries = [...counts].map(
    ([key, count]): Entry => ({ key, count, rgb: [key >> 16, (key >> 8) & 255, key & 255] }),
  );
  const mapping = medianCut(entries, CUSTOM_MAX_COLORS);
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] === 0) continue;
    [d[o], d[o + 1], d[o + 2]] = mapping.get((d[o] << 16) | (d[o + 1] << 8) | d[o + 2])!;
  }
}

/**
 * A 1 px border like the wooden frames painted into vanilla textures: runs of
 * two pixels in similar shades, with a lighter pixel at each corner.
 */
export type Frame = { id: string; name: string; corner: string; shades: string[] };

export const FRAMES: Frame[] = [
  { id: "none", name: "None", corner: "", shades: [] },
  // Sampled from the vanilla textures (Albanian, Orb, Graham, Sunflowers).
  {
    id: "oak",
    name: "Oak",
    corner: "#4e3010",
    shades: ["#4b2212", "#4c2b0e", "#4b3712", "#4d2c0e", "#4c2714", "#43200e", "#411d0d", "#3e190c"],
  },
  {
    id: "ebony",
    name: "Ebony",
    corner: "#281d0c",
    shades: ["#211307", "#241608", "#201107", "#231309", "#251409", "#1d0d07", "#201008"],
  },
  {
    id: "crimson",
    name: "Crimson",
    corner: "#8b4640",
    shades: ["#88434a", "#83413f", "#6f3631", "#592d23", "#521e1c", "#682827", "#7c3c41", "#723237"],
  },
  {
    id: "walnut",
    name: "Walnut",
    corner: "#402e06",
    shades: ["#3f2905", "#351803", "#382003", "#3f2006", "#402203", "#3f2802", "#411f03"],
  },
  {
    id: "birch",
    name: "Birch",
    corner: "#e3d5a0",
    shades: ["#d7c185", "#c8b074", "#bfa36a", "#cdb87c", "#b89d62"],
  },
  {
    id: "gold",
    name: "Gold",
    corner: "#fff1a0",
    shades: ["#f5d451", "#e8b93a", "#d9a02b", "#c98a1f", "#f0c948"],
  },
  {
    id: "stone",
    name: "Stone",
    corner: "#8f8f8f",
    shades: ["#7a7a7a", "#6f6f6f", "#838383", "#666666", "#747474"],
  },
];

export const DEFAULT_FRAME = "oak";

export function findFrame(id: string) {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Paints `frame` around the edge of the image, clockwise from the top left. */
function drawFrame(image: ImageData, frame: Frame) {
  const { width: w, height: h, data } = image;
  const corner = hexToRgb(frame.corner);
  const shades = frame.shades.map(hexToRgb);
  const set = (x: number, y: number, [r, g, b]: number[]) => {
    const o = (y * w + x) * 4;
    [data[o], data[o + 1], data[o + 2], data[o + 3]] = [r, g, b, 255];
  };
  const perimeter: [number, number][] = [];
  for (let x = 1; x < w - 1; x++) perimeter.push([x, 0]);
  for (let y = 1; y < h - 1; y++) perimeter.push([w - 1, y]);
  for (let x = w - 2; x > 0; x--) perimeter.push([x, h - 1]);
  for (let y = h - 2; y > 0; y--) perimeter.push([0, y]);
  perimeter.forEach(([x, y], i) => {
    // Integer hash of the run index, so the grain is random but stable.
    let n = Math.imul((i >> 1) + 1, 0x9e3779b1);
    n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
    set(x, y, shades[((n ^ (n >>> 13)) >>> 0) % shades.length]);
  });
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) set(x, y, corner);
}

/**
 * Which part of the picture fills the painting: the crop's center as a
 * fraction of the picture's width and height, and how far it is zoomed in
 * from the largest crop that fits.
 */
export type Crop = { x: number; y: number; zoom: number };

export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_CROP_ZOOM = 8;

/** Pixel size of the area the picture fills: the painting minus its frame. */
export function pictureSize(width: number, height: number, frameId: string) {
  const inset = findFrame(frameId).shades.length > 0 ? 1 : 0;
  return {
    inset,
    width: width * PIXELS_PER_BLOCK - inset * 2,
    height: height * PIXELS_PER_BLOCK - inset * 2,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The source rectangle of an `iw × ih` picture that `crop` selects for an
 * area of the given aspect ratio, kept inside the picture.
 */
export function cropRect(iw: number, ih: number, aspect: number, crop: Crop) {
  const fit = Math.min(iw, ih * aspect);
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM);
  const sw = fit / zoom;
  const sh = fit / aspect / zoom;
  return {
    sx: clamp(crop.x * iw - sw / 2, 0, iw - sw),
    sy: clamp(crop.y * ih - sh / 2, 0, ih - sh),
    sw,
    sh,
  };
}

/**
 * Renders the picture as a `width × height` block painting at 16 px per
 * block, as a PNG data URL. `crop` picks the part of the picture that fills
 * the painting, or the area inside the frame when there is one.
 */
export function renderPainting(
  img: HTMLImageElement,
  width: number,
  height: number,
  frameId: string,
  crop: Crop,
) {
  const frame = findFrame(frameId);
  const { inset, width: iw2, height: ih2 } = pictureSize(width, height, frameId);
  const pw = width * PIXELS_PER_BLOCK;
  const ph = height * PIXELS_PER_BLOCK;
  const { sx, sy, sw, sh } = cropRect(img.naturalWidth, img.naturalHeight, iw2 / ih2, crop);
  const picture = resample(img, sx, sy, sw, sh, iw2, ih2);
  const out = canvas(pw, ph);
  out.ctx.drawImage(picture.canvas, inset, inset);
  const image = out.ctx.getImageData(0, 0, pw, ph);
  toPaintingColors(image);
  // After the color cap, so the frame keeps its exact shades.
  if (inset) drawFrame(image, frame);
  out.ctx.putImageData(image, 0, 0);
  return out.canvas.toDataURL("image/png");
}
