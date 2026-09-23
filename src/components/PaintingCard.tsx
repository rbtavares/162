import Link from "next/link";
import type { Painting } from "@/data/paintings";
import { PaintingModel } from "@/components/PaintingModel";

type Props = {
  painting: Painting;
  href: string;
  /** Second line under the title; defaults to the author. */
  subtitle?: string;
  /** Shows the size in blocks at the right. */
  showSize?: boolean;
  /** See PaintingModel. */
  flies?: boolean;
};

/** A gallery grid cell: the painting as a 3D model with its title and size. */
export function PaintingCard({
  painting: p,
  href,
  subtitle = p.author,
  showSize = true,
  flies = true,
}: Props) {
  return (
    // The 1px outline fills the grid's 1px gaps, drawing the lines between cards.
    <li className="shadow-[0_0_0_1px_var(--color-zinc-800)]">
      {/* Equal padding on opposite sides keeps the painting centered in the
          cell; the bottom's 64px also leaves room for the title over it. */}
      <Link
        href={href}
        className="group relative flex aspect-square [container-type:size] items-center justify-center px-12 py-16 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400 md:px-16"
      >
        <PaintingModel painting={p} side="min(100cqw, 100cqh)" flies={flies} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
          {/* The size lines up with the last line (the subtitle), at the bottom right. */}
          <div className="flex items-baseline-last justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium text-zinc-100 group-hover:text-accent-200">
                {p.title}
              </h2>
              {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
            </div>
            {showSize && (
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {p.width}×{p.height}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
