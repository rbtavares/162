"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/*
 * A spot in the sidebar's top bar, beside the site name, that the painting's
 * title moves into on phones (see PaintingViewer), so the two share one bar.
 */
const SlotContext = createContext<{
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
}>({ slot: null, setSlot: () => {} });

export function TitleSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>;
}

/** The element to portal the title into, once it's mounted. */
export function useTitleSlot() {
  return useContext(SlotContext).slot;
}

export function TitleSlot({ className }: { className?: string }) {
  const { setSlot } = useContext(SlotContext);
  return <div ref={setSlot} className={className} />;
}
