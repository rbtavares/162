import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, TITLE_SEPARATOR } from "@/data/site";
import { FlightOverlay } from "@/components/FlightOverlay";
import { OverlayScrollbar } from "@/components/OverlayScrollbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages give their own title, e.g. "Backyard · 16²". The default is only for
  // pages without one (like "not found").
  title: { default: SITE_NAME, template: `%s${TITLE_SEPARATOR}${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  // Makes the preview image links absolute, as social sites need them.
  metadataBase: new URL(SITE_URL),
  // How links to the site look when shared. The preview images come from the
  // opengraph-image files; X falls back to these for its own tags.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* The page's own scrollbar (the gallery, and phone layouts). */}
        <OverlayScrollbar />
        <FlightOverlay />
      </body>
    </html>
  );
}
