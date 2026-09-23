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
  // Items, headings and gaps are the same size in both modes, so thumbnails
  // stay exactly where they are when the sidebar collapses or expands: 6px of
  // side padding puts a 36px thumbnail dead center in the 48px-wide strip.
  // (In the strip the names are hidden for screen readers only, taking no room.)
  const item = "w-full gap-3 px-1.5 py-1.5";
  const label = compact ? "sr-only" : "min-w-0";
  // Group headings: "1×1 blocks" in the full list, just "1×1" centered in the
  // compact strip. They never wrap: while the sidebar narrows or widens they
  // are cut off at its edge instead.
  const heading = `mb-2 overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase text-zinc-500 ${
    compact ? "text-center" : "px-1.5 tracking-widest"
  }`;
  return (
    <nav aria-label="Paintings" className="flex flex-col gap-5">
      {sortedGroups.map(([size, items]) => (
        <section key={size}>
          <h2 className={heading}>
            {size}
            <span className={compact ? "sr-only" : undefined}> blocks</span>
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
                        ? "bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/40"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {/* The painting fills the box by its longest side (a 1×1 fills it,
                        a 1×2 its full height), scaled up with crisp pixels. */}
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-800/80">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={paintingSrc(p)}
                        alt=""
                        width={p.width * 16}
                        height={p.height * 16}
                        className="size-full object-contain [image-rendering:pixelated]"
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
      <section>
        <h2 className={heading}>Custom</h2>
        <Link
          href="/custom"
          aria-current={selectedId === CUSTOM_ID ? "page" : undefined}
          title={compact ? (custom?.title ?? "Custom painting") : undefined}
          className={`flex items-center rounded-md text-left transition-colors ${item} ${
            selectedId === CUSTOM_ID
              ? "bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/40"
              : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-800/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paintingSrc(thumbnail)}
              alt=""
              width={thumbnail.width * 16}
              height={thumbnail.height * 16}
              className="size-full object-contain [image-rendering:pixelated]"
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
