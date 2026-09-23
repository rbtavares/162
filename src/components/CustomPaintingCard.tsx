"use client";

import { CUSTOM_PLACEHOLDER } from "@/data/paintings";
import { PaintingCard } from "@/components/PaintingCard";
import { useCustomPainting } from "@/lib/customStore";

/**
 * Gallery card for the custom painting: the painting like any other once one
 * has been made, otherwise a placeholder painting inviting you to make one.
 */
export function CustomPaintingCard() {
  const painting = useCustomPainting();

  if (!painting) {
    return (
      <PaintingCard
        painting={CUSTOM_PLACEHOLDER}
        href="/custom"
        subtitle="Upload a picture and choose its size in blocks"
        showSize={false}
        // The upload page has no painting for it to land on.
        flies={false}
      />
    );
  }

  return <PaintingCard painting={painting} href="/custom" subtitle="Custom painting" />;
}
