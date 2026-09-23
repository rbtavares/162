"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PIXELS_PER_BLOCK } from "@/data/paintings";
import {
  CUSTOM_MAX_BLOCKS,
  DEFAULT_CROP,
  DEFAULT_FRAME,
  FRAMES,
  findFrame,
  loadImage,
  pictureSize,
  prepareSource,
  suggestSize,
  type Crop,
} from "@/lib/customPainting";
import {
  customPainting,
  readCustom,
  useCustom,
  useCustomImage,
  writeCustom,
  type Custom,
} from "@/lib/customStore";
import { CropEditor } from "@/components/CropEditor";
import { PaintingViewer } from "@/components/PaintingViewer";

const READ_ERROR = "Couldn't read that picture. Try a PNG, JPEG, WebP or GIF.";

function useUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't a picture.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const source = await prepareSource(file);
      const img = await loadImage(source);
      // Read now rather than when the upload started, so a size or frame
      // changed while it loaded isn't overwritten.
      const current = readCustom();
      writeCustom({
        name: file.name.replace(/\.[^.]*$/, "") || "Custom painting",
        source,
        crop: DEFAULT_CROP,
        // Keep the chosen size and frame when swapping pictures.
        ...(current
          ? { width: current.width, height: current.height, frame: current.frame }
          : { ...suggestSize(img.naturalWidth, img.naturalHeight), frame: DEFAULT_FRAME }),
      });
    } catch {
      setError(READ_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, upload };
}

export function CustomPainting() {
  const saved = useCustom();
  const custom = saved ?? null;
  const { busy, error, upload } = useUpload();
  // The decoded picture, re-rendered at the chosen size.
  const { img, failed } = useCustomImage(custom?.source);

  // While the picture is being moved, the crop lives here and is saved once
  // the user pauses, rather than writing the whole picture to storage per move.
  const [draftCrop, setDraftCrop] = useState<Crop | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const draftRef = useRef<Crop | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveCrop = useCallback(() => {
    clearTimeout(saveTimer.current);
    const draft = draftRef.current;
    const current = readCustom();
    if (draft && current) writeCustom({ ...current, crop: draft });
    draftRef.current = null;
    setDraftCrop(null);
  }, []);
  const moveCrop = (crop: Crop) => {
    draftRef.current = crop;
    setDraftCrop(crop);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveCrop, 400);
  };
  const closeEditor = useCallback(() => {
    saveCrop();
    setAdjusting(false);
  }, [saveCrop]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const crop = draftCrop ?? custom?.crop ?? DEFAULT_CROP;
  // Rendering big paintings takes a moment; let dragging stay smooth.
  const renderCrop = useDeferredValue(crop);

  const painting = useMemo(
    () => (custom && img ? customPainting(img, custom, renderCrop) : null),
    [custom, img, renderCrop],
  );

  // Server render and first paint, before storage has been read.
  if (saved === undefined) return <div className="flex-1" />;

  if (!custom || failed) {
    return <UploadScreen busy={busy} error={error ?? (custom ? READ_ERROR : null)} onFile={upload} />;
  }

  if (!painting) return <div className="flex-1" />;

  const change = (settings: Partial<Pick<Custom, "width" | "height" | "frame">>) =>
    writeCustom({ ...custom, ...settings });

  return (
    <PaintingViewer
      // A new picture starts from its own colors.
      key={custom.source}
      painting={painting}
      headerRight={
        <div className="relative flex shrink-0 items-center gap-3 text-sm text-zinc-400">
          {error && (
            <p role="alert" className="hidden max-w-56 truncate text-xs text-red-400 lg:block" title={error}>
              {error}
            </p>
          )}
          <FrameSelect value={custom.frame} onChange={(frame) => change({ frame })} />
          <div className="flex items-center gap-1.5 tabular-nums">
            <BlockSelect label="Width in blocks" value={custom.width} onChange={(width) => change({ width })} />
            <span aria-hidden>×</span>
            <BlockSelect label="Height in blocks" value={custom.height} onChange={(height) => change({ height })} />
            <span>blocks</span>
            <span className="hidden xl:inline">
              · {custom.width * PIXELS_PER_BLOCK}×{custom.height * PIXELS_PER_BLOCK} px
            </span>
          </div>
          <button
            type="button"
            onClick={() => (adjusting ? closeEditor() : setAdjusting(true))}
            aria-expanded={adjusting}
            className={`h-8 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-400 ${
              adjusting
                ? "border-accent-500/40 bg-accent-500/15 text-accent-200"
                : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
            }`}
          >
            Adjust picture
          </button>
          <FileButton busy={busy} onFile={upload} />
          {adjusting && img && (
            <CropEditor
              img={img}
              blocks={{ width: custom.width, height: custom.height }}
              picture={pictureSize(custom.width, custom.height, custom.frame)}
              crop={crop}
              onChange={moveCrop}
              onClose={closeEditor}
            />
          )}
        </div>
      }
    />
  );
}

function BlockSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-1.5 text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus-visible:border-accent-400"
    >
      {Array.from({ length: CUSTOM_MAX_BLOCKS }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function FrameSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const frame = findFrame(value);
  return (
    <label className="flex items-center gap-1.5">
      <span className="hidden sm:inline">Frame</span>
      <span className="relative flex items-center">
        {/* Preview of the frame's wood, or a dashed box for none. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute left-2 size-3.5 rounded-[3px] ${
            frame.shades.length ? "" : "border border-dashed border-zinc-600"
          }`}
          style={
            frame.shades.length
              ? {
                  background: `linear-gradient(135deg, ${frame.corner}, ${frame.shades.join(", ")})`,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
                }
              : undefined
          }
        />
        <select
          aria-label="Frame"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 pl-7 pr-1.5 text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus-visible:border-accent-400"
        >
          {FRAMES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function FileButton({ busy, onFile }: { busy: boolean; onFile: (file: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="h-8 rounded-md border border-zinc-800 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400 disabled:opacity-50"
      >
        {busy ? "Loading…" : "Change picture"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function UploadScreen({
  busy,
  error,
  onFile,
}: {
  busy: boolean;
  error: string | null;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors focus-within:border-accent-400 ${
          dragging
            ? "border-accent-400 bg-accent-500/10"
            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
        }`}
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Make a custom painting</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Drop a picture here. You pick the size in blocks, at 16 pixels per block.
          </p>
        </div>
        <span className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-zinc-950">
          {busy ? "Loading…" : "Choose a picture"}
        </span>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </label>
    </main>
  );
}
