import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paintings } from "@/data/paintings";
import { PaintingViewer } from "@/components/PaintingViewer";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return paintings.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const painting = paintings.find((p) => p.id === id);
  return { title: painting?.title ?? "Painting" };
}

export default async function PaintingPage({ params }: { params: Params }) {
  const { id } = await params;
  const painting = paintings.find((p) => p.id === id);
  if (!painting) notFound();
  return <PaintingViewer painting={painting} />;
}
