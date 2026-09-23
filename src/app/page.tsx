import Link from "next/link";
import { paintings } from "@/data/paintings";
import { PaintingModel } from "@/components/PaintingModel";

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
          {paintings.length} paintings. Pick one to see its pixel grid and simplify its colors.
        </p>
      </header>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-px border-y border-zinc-800 bg-zinc-800">
        {sorted.map((p) => (
          <li key={p.id} className="bg-zinc-950">
            <Link
              href={`/painting/${p.id}`}
              className="group relative flex aspect-square [container-type:size] items-center justify-center px-8 pb-16 pt-8 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 md:px-10 md:pt-10"
            >
              <PaintingModel painting={p} side="min(100cqw, 100cqh)" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium text-zinc-100 group-hover:text-emerald-200">
                      {p.title}
                    </h2>
                    {p.author && <p className="truncate text-xs text-zinc-500">{p.author}</p>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {p.width}×{p.height}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
