import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PIXELS_PER_BLOCK, type Painting } from "@/data/paintings";

/** Social preview images, at the size X and Open Graph recommend. */
export const OG_SIZE = { width: 1200, height: 630 };

/** Page background and text colors, as in globals.css. */
export const OG_BACKGROUND = "#09090b";
export const OG_FOREGROUND = "#ededed";
export const OG_MUTED = "#71717a"; // zinc-500

/**
 * A painting's texture scaled up to `width` × `height` with sharp pixels, as
 * a data URL. The texture is wrapped in an SVG because the image renderer
 * ignores `image-rendering` on plain images but honors it inside an SVG.
 */
async function textureUrl(painting: Painting, width: number, height: number) {
  const file = await readFile(join(process.cwd(), "public/paintings", `${painting.id}.png`));
  const png = `data:image/png;base64,${file.toString("base64")}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<image href="${png}" width="${width}" height="${height}" image-rendering="optimizeSpeed"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * A painting drawn up to `blockSize` pixels per block. The scale is a whole
 * number of image pixels per texture pixel so every pixel is the same size. A
 * function rather than a component: images can't render async components.
 */
export async function paintingImage(painting: Painting, blockSize: number) {
  const scale = Math.max(1, Math.floor(blockSize / PIXELS_PER_BLOCK));
  const width = painting.width * PIXELS_PER_BLOCK * scale;
  const height = painting.height * PIXELS_PER_BLOCK * scale;
  const src = await textureUrl(painting, width, height);
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} width={width} height={height} />
  );
}
