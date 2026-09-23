import { Sidebar } from "@/components/Sidebar";

/**
 * Shared by the painting pages and the custom painting: the sidebar lives
 * here so it stays put, scroll position included, while only the page beside
 * it changes.
 */
export default function ViewerLayout({ children }: LayoutProps<"/">) {
  return (
    // Clipped sideways: panels sliding in from past the edge (see globals.css)
    // must not add scrollbars, which would shift the painting as they vanish.
    <div className="flex min-h-dvh flex-col overflow-x-clip md:h-dvh md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
