import data from "./paintings.json";

export const PIXELS_PER_BLOCK = 16;

/** Id of the painting made from the user's own picture (see /custom). */
export const CUSTOM_ID = "custom";

/**
 * Stands in for the custom painting before one has been made: a vanilla-style
 * canvas that's only partly painted, with the brush still on it.
 */
export const CUSTOM_PLACEHOLDER: Painting = {
  id: "custom-placeholder",
  title: "Custom painting",
  author: "",
  width: 1,
  height: 1,
  src: "/custom-painting.png",
};

export type Painting = {
  id: string;
  title: string;
  author: string;
  /** Width in blocks */
  width: number;
  /** Height in blocks */
  height: number;
  /** Image URL, for paintings not shipped in public/paintings (custom uploads). */
  src?: string;
};

export const paintings: Painting[] = data;

/** Fewest colors simplification reduces a painting to; below this they lose their character. */
const MIN_COLORS = 20;

/** Fewest colors a painting with `total` distinct colors can be simplified to. */
export function minColors(total: number) {
  return Math.min(MIN_COLORS, total);
}

export function paintingSrc(p: Painting) {
  return p.src ?? `/paintings/${p.id}.png`;
}
