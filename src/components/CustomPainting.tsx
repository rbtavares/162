"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_PLACEHOLDER, PIXELS_PER_BLOCK } from "@/data/paintings";
import {
  CUSTOM_MAX_BLOCKS,
  DEFAULT_CROP,
  DEFAULT_FRAME,
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
import { PictureSettings } from "@/components/PictureSettings";
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
          {/* Shown in the popup instead while it's open. */}
          {error && !adjusting && (
            <p role="alert" className="hidden max-w-56 truncate text-xs text-red-400 lg:block" title={error}>
              {error}
            </p>
          )}
          {/* Phones show the size under the title instead. */}
          <p className="hidden tabular-nums md:block">
            {custom.width}×{custom.height} blocks
            <span className="hidden xl:inline">
              {" "}
              · {custom.width * PIXELS_PER_BLOCK}×{custom.height * PIXELS_PER_BLOCK} px
            </span>
          </p>
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
            Picture settings
          </button>
          {adjusting && img && (
            <PictureSettings
              img={img}
              name={custom.name}
              blocks={{ width: custom.width, height: custom.height }}
              picture={pictureSize(custom.width, custom.height, custom.frame)}
              crop={crop}
              onChange={moveCrop}
              onBlocks={(size) => change(size)}
              frame={custom.frame}
              onFrame={(frame) => change({ frame })}
              onFile={(file) => {
                // Save a pending move now, or it would land on the new picture.
                saveCrop();
                upload(file);
              }}
              busy={busy}
              error={error}
              onClose={closeEditor}
            />
          )}
        </div>
      }
    />
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
        onDragLeave={(e) => {
          // Also fired moving onto the box's own contents; only leaving counts.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={`group flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border px-6 pt-12 pb-8 text-center transition-colors focus-within:border-accent-400 ${
          dragging ? "border-accent-400 bg-accent-500/5" : "border-zinc-800 hover:border-zinc-700"
        }`}
      >
        {/* The gallery card's placeholder painting, pixel for pixel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CUSTOM_PLACEHOLDER.src}
          alt=""
          width={96}
          height={96}
          draggable={false}
          className={`size-24 [image-rendering:pixelated] drop-shadow-[0_8px_16px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            dragging ? "-translate-y-1 scale-110" : "group-hover:-translate-y-0.5"
          }`}
        />

        <h1 className="mt-8 text-lg font-semibold tracking-tight">Make a custom painting</h1>
        <p className="mt-1 max-w-xs text-sm text-zinc-500">
          Turn a picture of your own into a Minecraft painting, then pick its size and frame.
        </p>

        <span
          className={`mt-6 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            dragging ? "bg-white text-zinc-950" : "bg-zinc-100 text-zinc-950 group-hover:bg-white"
          }`}
        >
          {busy ? "Loading…" : dragging ? "Drop to use it" : "Choose a picture"}
        </span>
        <p className="mt-2 text-xs text-zinc-500">or drop one here</p>

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
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <p className="mt-8 text-xs text-zinc-600">
          Up to {CUSTOM_MAX_BLOCKS}×{CUSTOM_MAX_BLOCKS} blocks · {PIXELS_PER_BLOCK} pixels per block ·
          Kept in your browser
        </p>
      </label>
    </main>
  );
}
