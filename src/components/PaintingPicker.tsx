"use client";

import Link from "next/link";
import { CUSTOM_ID, CUSTOM_PLACEHOLDER, paintings, paintingSrc, type Painting } from "@/data/paintings";
import { useCustomPainting } from "@/lib/customStore";

type Props = {
  selectedId: string;
  /** Thumbnails only (names show on hover), for the collapsed sidebar. */
  compact?: boolean;
};

const sizeKey = (p: Painting) => `${p.width}×${p.height}`;

const groups = paintings.reduce<Map<string, Painting[]>>((acc, p) => {
  const key = sizeKey(p);
  acc.set(key, [...(acc.get(key) ?? []), p]);
  return acc;
}, new Map());

const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
  const [aw, ah] = a.split("×").map(Number);
  const [bw, bh] = b.split("×").map(Number);
  return aw * ah - bw * bh || aw - bw;
});

export function PaintingPicker({ selectedId, compact = false }: Props) {
  const custom = useCustomPainting();
  const thumbnail = custom ?? CUSTOM_PLACEHOLDER;
  // Compact items are squares hugging the thumbnail, so the selection outline frames it evenly.
  const item = compact ? "mx-auto size-11 shrink-0 justify-center" : "w-full gap-3 px-2 py-1.5";
  const label = compact ? "sr-only" : "min-w-0";
  return (
    <nav aria-label="Paintings" className={`flex flex-col ${compact ? "gap-3" : "gap-5"}`}>
      {sortedGroups.map(([size, items]) => (
        <section key={size} className={compact ? "border-t border-zinc-800 pt-3" : undefined}>
          <h2
            className={
              compact
                ? "sr-only"
                : "mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
            }
          >
            {size} blocks
          </h2>
          <ul className="flex flex-col gap-0.5">
            {items.map((p) => {
              const active = p.id === selectedId;
              return (
                <li key={p.id}>
                  <Link
                    href={`/painting/${p.id}`}
                    aria-current={active ? "page" : undefined}
                    title={compact ? p.title : undefined}
                    className={`flex items-center rounded-md text-left transition-colors ${item} ${
                      active
                        ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-800/80">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={paintingSrc(p)}
                        alt=""
                        width={p.width * 16}
                        height={p.height * 16}
                        className="max-h-8 max-w-8 object-contain [image-rendering:pixelated]"
                      />
                    </span>
                    <span className={label}>
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      {p.author && (
                        <span className="block truncate text-xs text-zinc-500">{p.author}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section className={compact ? "border-t border-zinc-800 pt-3" : undefined}>
        <h2
          className={
            compact ? "sr-only" : "mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          }
        >
          Custom
        </h2>
        <Link
          href="/custom"
          aria-current={selectedId === CUSTOM_ID ? "page" : undefined}
          title={compact ? (custom?.title ?? "Custom painting") : undefined}
          className={`flex items-center rounded-md text-left transition-colors ${item} ${
            selectedId === CUSTOM_ID
              ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
              : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-800/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paintingSrc(thumbnail)}
              alt=""
              width={thumbnail.width * 16}
              height={thumbnail.height * 16}
              className="max-h-8 max-w-8 object-contain [image-rendering:pixelated]"
            />
          </span>
          <span className={label}>
            <span className="block truncate text-sm font-medium">{custom?.title ?? "Custom painting"}</span>
            <span className="block truncate text-xs text-zinc-500">
              {custom ? `Custom painting · ${custom.width}×${custom.height}` : "From your own picture"}
            </span>
          </span>
        </Link>
      </section>
    </nav>
  );
}
