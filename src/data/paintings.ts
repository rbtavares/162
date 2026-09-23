import data from "./paintings.json";

export const PIXELS_PER_BLOCK = 16;

export type Painting = {
  id: string;
  title: string;
  author: string;
  /** Width in blocks */
  width: number;
  /** Height in blocks */
  height: number;
};

export const paintings: Painting[] = data;

export function paintingSrc(p: Painting) {
  return `/paintings/${p.id}.png`;
}
