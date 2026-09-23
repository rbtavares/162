import data from "./paintings.json";

export const PIXELS_PER_BLOCK = 16;

/** Id of the painting made from the user's own picture (see /custom). */
export const CUSTOM_ID = "custom";

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

export function paintingSrc(p: Painting) {
  return p.src ?? `/paintings/${p.id}.png`;
}
