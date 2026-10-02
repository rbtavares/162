import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { paintings } from "@/data/paintings";
import { SITE_NAME, SITE_TAGLINE } from "@/data/site";
import { OG_BACKGROUND, OG_FOREGROUND, OG_MUTED, OG_SIZE, paintingImage } from "@/lib/ogImage";

export const alt = "A Minecraft painting, pixel by pixel, on 16²";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return paintings.map((p) => ({ id: p.id }));
}

/** Room for the painting, on the left of the preview. */
const PAINTING_BOX = 502;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const painting = paintings.find((p) => p.id === id);
  if (!painting) notFound();
  const blockSize = PAINTING_BOX / Math.max(painting.width, painting.height);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: 64,
          background: OG_BACKGROUND,
          color: OG_FOREGROUND,
        }}
      >
        <div style={{ display: "flex", width: PAINTING_BOX, height: PAINTING_BOX, alignItems: "center", justifyContent: "center" }}>
          {await paintingImage(painting, blockSize)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -2, lineHeight: 1.1 }}>{painting.title}</div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 32, color: OG_MUTED, lineHeight: 1.3 }}>
              <div>{`by ${painting.author}`}</div>
              <div>{`${painting.width}×${painting.height} blocks`}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -2 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 24, color: OG_MUTED, lineHeight: 1.3 }}>{SITE_TAGLINE}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
