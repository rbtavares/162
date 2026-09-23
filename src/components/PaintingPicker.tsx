"use client";

import Link from "next/link";
import { CUSTOM_ID, paintings, paintingSrc, type Painting } from "@/data/paintings";
import { PlusIcon } from "@/components/icons";

type Props = {
  selectedId: string;
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

export function PaintingPicker({ selectedId }: Props) {
  return (
    <nav aria-label="Paintings" className="flex flex-col gap-5">
      <Link
        href="/custom"
        aria-current={selectedId === CUSTOM_ID ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
          selectedId === CUSTOM_ID
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
            : "text-zinc-300 hover:bg-zinc-800"
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-400">
          <PlusIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">Custom painting</span>
          <span className="block truncate text-xs text-zinc-500">From your own picture</span>
        </span>
      </Link>
      {sortedGroups.map(([size, items]) => (
        <section key={size}>
          <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
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
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
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
                    <span className="min-w-0">
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
    </nav>
  );
}
