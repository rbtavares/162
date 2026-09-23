import { paintings } from "@/data/paintings";
import { PaintingCard } from "@/components/PaintingCard";
import { CustomPaintingCard } from "@/components/CustomPaintingCard";

const sorted = [...paintings].sort(
  (a, b) =>
    a.width * a.height - b.width * b.height ||
    a.width - b.width ||
    a.title.localeCompare(b.title),
);

export default function GalleryPage() {
  return (
    <div className="w-full">
      <header className="px-4 py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Minecraft Painting Guide
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {paintings.length} paintings. Pick one to see its pixel grid and simplify its colors, or make your own.
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
