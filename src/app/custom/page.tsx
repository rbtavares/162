import type { Metadata } from "next";
import { CustomPainting } from "@/components/CustomPainting";

export const metadata: Metadata = { title: "Custom painting · Minecraft Painting Guide" };

export default function CustomPaintingPage() {
  return <CustomPainting />;
}
