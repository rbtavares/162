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
    <div className="gallery-root w-full">
      <header className="px-4 py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {SITE_NAME}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {SITE_TAGLINE} {paintings.length} paintings, plus one of your own.
        </p>
      </header>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-px border-y border-zinc-800 bg-zinc-800">
        <CustomPaintingCard />
        {sorted.map((p) => (
          <PaintingCard key={p.id} painting={p} href={`/painting/${p.id}`} />
        ))}
      </ul>
    </div>
  );
}
