import { paintings } from "@/data/paintings";
import type { Metadata } from "next";
import { SITE_NAME, SITE_TAGLINE, TITLE_SEPARATOR } from "@/data/site";
import { PaintingCard } from "@/components/PaintingCard";
import { CustomPaintingCard } from "@/components/CustomPaintingCard";

const sorted = [...paintings].sort(
  (a, b) =>
    a.width * a.height - b.width * b.height ||
    a.width - b.width ||
    a.title.localeCompare(b.title),
);

// Written out in full: the root layout's title template doesn't apply to the
// page in its own folder.
export const metadata: Metadata = { title: `Gallery${TITLE_SEPARATOR}${SITE_NAME}` };

export default function GalleryPage() {
  return (
    <div className="gallery-root page-width">
      <header className="px-4 py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {SITE_NAME}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {SITE_TAGLINE} {paintings.length} paintings, plus one of your own.
        </p>
      </header>

      {/* Cards are at least 360px (or the full width on narrow screens), and at
          least a fifth of the row, so there are never more than 5 per row. The
          fifth leaves a pixel of slack so rounding can't drop the row to 4. The
          lines between cards come from the cards (see PaintingCard), so empty
          spots in the last row show the page. */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(max(min(100%,360px),calc((100%_-_5px)/5)),1fr))] gap-px border-y border-zinc-800">
        {sorted.map((p) => (
          <PaintingCard key={p.id} painting={p} href={`/painting/${p.id}`} />
        ))}
        <CustomPaintingCard />
      </ul>
    </div>
  );
}
