import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paintings } from "@/data/paintings";
import { SITE_NAME } from "@/data/site";
import { PaintingViewer } from "@/components/PaintingViewer";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return paintings.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const painting = paintings.find((p) => p.id === id);
  const title = painting?.title ?? "Painting";
  const description = painting
    ? `Every pixel of ${painting.title} by ${painting.author}, laid out to study, simplify and paint.`
    : undefined;
  // Replaces the root layout's openGraph, so it repeats the site name.
  return {
    title,
    description,
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url: `/painting/${id}` },
  };
}

export default async function PaintingPage({ params }: { params: Params }) {
  const { id } = await params;
  const painting = paintings.find((p) => p.id === id);
  if (!painting) notFound();
  return <PaintingViewer painting={painting} />;
}
