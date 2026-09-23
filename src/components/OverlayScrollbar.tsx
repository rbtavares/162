"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Shortest the thumb gets (CSS px), so a long list still has something to grab. */
const MIN_THUMB = 24;
/** Gap (CSS px) between the thumb and the ends of the scroll area. */
const INSET = 2;
/** How long the thumb lingers after scrolling stops, in ms. */
const LINGER = 1000;

/**
 * A slim scrollbar that floats over `viewport`'s right edge and only shows
 * while it scrolls, like macOS's overlay scrollbars, whatever the system's
 * scrollbar setting. Hide the viewport's own scrollbar, and render this next
 * to it inside a `relative` wrapper that clips it. Hovering the thumb brings
 * it back, and it can be dragged.
 */
export function OverlayScrollbar({ viewport }: { viewport: RefObject<HTMLElement | null> }) {
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewport.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    let thumbHeight = 0;
    let hovering = false;
    let drag: { y: number; scrollTop: number } | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const track = () => el.clientHeight - INSET * 2;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const scrollable = scrollHeight > clientHeight + 1;
      thumb.hidden = !scrollable;
      if (!scrollable) return;
      thumbHeight = Math.max(MIN_THUMB, (track() * clientHeight) / scrollHeight);
      const top = INSET + (scrollTop / (scrollHeight - clientHeight)) * (track() - thumbHeight);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${top}px)`;
    };
    const show = () => {
      thumb.dataset.visible = "true";
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!hovering && !drag) thumb.dataset.visible = "false";
      }, LINGER);
    };

    const onScroll = () => {
      update();
      show();
    };
    const onEnter = () => {
      hovering = true;
      show();
    };
    const onLeave = () => {
      hovering = false;
      show();
    };
    const onDown = (e: PointerEvent) => {
      thumb.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, scrollTop: el.scrollTop };
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      // Moving the thumb by its free track moves the list by its full overflow.
      const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, track() - thumbHeight);
      el.scrollTop = drag.scrollTop + (e.clientY - drag.y) * ratio;
    };
    const onUp = () => {
      drag = null;
      show();
    };

    update();
    // The list or its contents can change size (collapsing, a custom painting
    // appearing, the phone list opening), which changes the thumb.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("pointerenter", onEnter);
    thumb.addEventListener("pointerleave", onLeave);
    thumb.addEventListener("pointerdown", onDown);
    thumb.addEventListener("pointermove", onMove);
    thumb.addEventListener("pointerup", onUp);
    thumb.addEventListener("pointercancel", onUp);
    return () => {
      clearTimeout(hideTimer);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerenter", onEnter);
      thumb.removeEventListener("pointerleave", onLeave);
      thumb.removeEventListener("pointerdown", onDown);
      thumb.removeEventListener("pointermove", onMove);
      thumb.removeEventListener("pointerup", onUp);
      thumb.removeEventListener("pointercancel", onUp);
    };
  }, [viewport]);

  return (
    <div
      ref={thumbRef}
      aria-hidden
      data-visible="false"
      className="absolute right-0.5 top-0 w-1.5 touch-none rounded-full bg-zinc-500/60 opacity-0 transition-[opacity,width,background-color] duration-300 hover:w-2 hover:bg-zinc-400/80 data-[visible=true]:opacity-100"
    />
  );
}
