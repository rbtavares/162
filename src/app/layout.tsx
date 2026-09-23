import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, TITLE_SEPARATOR } from "@/data/site";
import { FlightOverlay } from "@/components/FlightOverlay";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <FlightOverlay />
      </body>
    </html>
  );
}
