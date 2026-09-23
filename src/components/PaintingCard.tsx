import Link from "next/link";
import type { Painting } from "@/data/paintings";
import { PaintingModel } from "@/components/PaintingModel";

type Props = {
  painting: Painting;
  href: string;
  /** Second line under the title; defaults to the author. */
  subtitle?: string;
};

/** A gallery grid cell: the painting as a 3D model with its title and size. */
export function PaintingCard({ painting: p, href, subtitle = p.author }: Props) {
  return (
    <li className="bg-zinc-950">
      <Link
        href={href}
        className="group relative flex aspect-square [container-type:size] items-center justify-center px-8 pb-16 pt-8 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 md:px-10 md:pt-10"
      >
        <PaintingModel painting={p} side="min(100cqw, 100cqh)" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium text-zinc-100 group-hover:text-emerald-200">
                {p.title}
              </h2>
              {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">
              {p.width}×{p.height}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
