import { ImageResponse } from "next/og";
import { paintings } from "@/data/paintings";
import { SITE_NAME, SITE_TAGLINE } from "@/data/site";
import { OG_BACKGROUND, OG_FOREGROUND, OG_MUTED, OG_SIZE, paintingImage } from "@/lib/ogImage";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Paintings along the bottom of the preview, left to right. */
const SHOWN = ["pointer", "skeleton", "pond", "wanderer", "sunflowers", "orb"];

export default async function Image() {
  const shown = SHOWN.map((id) => paintings.find((p) => p.id === id)).filter((p) => p !== undefined);
  const images = await Promise.all(shown.map((p) => paintingImage(p, 48)));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: OG_BACKGROUND,
          color: OG_FOREGROUND,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 112, fontWeight: 600, letterSpacing: -4, lineHeight: 1 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 36, color: OG_MUTED, maxWidth: 900, lineHeight: 1.3 }}>{SITE_TAGLINE}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>{images}</div>
      </div>
    ),
    size,
  );
}
