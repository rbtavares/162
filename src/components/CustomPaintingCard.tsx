"use client";

import Link from "next/link";
import { PaintingCard } from "@/components/PaintingCard";
import { PlusIcon } from "@/components/icons";
import { useCustomPainting } from "@/lib/customStore";

/**
 * Gallery card for the custom painting: the painting like any other once one
 * has been made, otherwise an invitation to make one.
 */
export function CustomPaintingCard() {
  const painting = useCustomPainting();

  if (!painting) {
    return (
      <li className="bg-zinc-950">
        <Link
          href="/custom"
          className="group relative flex aspect-square flex-col items-center justify-center gap-4 px-8 text-center outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
        >
          <span className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-zinc-400 transition-colors group-hover:border-emerald-400 group-hover:text-emerald-300">
            <PlusIcon className="size-6" />
          </span>
          <span>
            <span className="block text-sm font-medium text-zinc-100 group-hover:text-emerald-200">
              Custom painting
            </span>
            <span className="block text-xs text-zinc-500">
              Upload a picture and choose its size in blocks
            </span>
          </span>
        </Link>
      </li>
    );
  }

  return <PaintingCard painting={painting} href="/custom" subtitle="Custom painting" />;
}
