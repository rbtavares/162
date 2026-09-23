"use client";

import { useEffect, useRef } from "react";
import { PaintingModel } from "@/components/PaintingModel";
import { endFlight, touchDown, useFlight, type Rect } from "@/lib/paintingFlight";

/** How long the painting takes to glide into place, in ms. */
const FLY_DURATION = 560;
/** How long it takes to straighten out from how it was turned, in ms. */
const TURN_DURATION = 700;
/** Give up waiting for the destination after this long, in ms. */
const LAND_TIMEOUT = 2000;
/** Shortest glide left when the destination moves mid-flight, in ms. */
const MIN_RETARGET = 200;
/**
 * After touchdown the destination draws its own painting underneath, looking
 * just like the flying copy (see PaintingCanvas); once it has, the copy fades
 * out quickly on top, so nothing flashes through.
 */
const FADE_OUT = 120;
/** Fade anyway if the destination hasn't drawn this long after touchdown, in ms. */
const REVEAL_TIMEOUT = 1500;

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Moves and sizes `el` to `r` (its box, not a transform). */
function place(el: HTMLElement, r: Rect) {
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

/**
 * The painting in flight between pages, as its 3D model: it leaves turned
 * the way the card was and straightens out as it glides to the destination.
 * Lives in the root layout so it survives the navigation it covers.
 *
 * The glide is a transform: the copy is laid out once at its landing size and
 * scaled down to where it is, so the browser can run the animation off the
 * main thread (smooth even while the destination page is busy) and the pixels
 * are drawn at full size (crisp).
 */
export function FlightOverlay() {
  const flight = useFlight();
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const glideRef = useRef<{ number: number; animation: Animation } | null>(null);
  /** Page scroll when the landing spot was last reported (its rect is relative to that). */
  const anchorRef = useRef({ x: 0, y: 0 });

  const number = flight?.number;
  const orientation = flight?.orientation;

  // Straighten out from the card's spin and tilt, starting right away.
  useEffect(() => {
    const frame = frameRef.current;
    const tilt = frame?.querySelector<HTMLElement>(".p3d-tilt");
    const turn = frame?.querySelector<HTMLElement>(".p3d-box");
    if (!tilt || !turn || !orientation) return;
    const timing = { duration: TURN_DURATION, easing: EASE_OUT, fill: "forwards" } as const;
    // The `rotate` property composes with the model's own CSS transforms.
    tilt.animate({ rotate: [`x ${orientation.x}deg`, "x 0deg"] }, timing);
    turn.animate({ rotate: [`y ${orientation.y}deg`, "y 0deg"] }, timing);
  }, [number, orientation]);

  // Give up if the destination never says where to land.
  const waiting = flight !== null && flight.to === null;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => fadeOut(frameRef.current, number), LAND_TIMEOUT);
    return () => clearTimeout(timer);
  }, [waiting, number]);

  // Glide to the landing spot. If the destination moves mid-flight (its
  // layout settling), glide on from wherever the painting is now.
  const to = flight?.to;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !flight || !to || flight.landed) return;
    const previous = glideRef.current?.number === flight.number ? glideRef.current.animation : null;
    // Where it is on screen right now, mid-glide or not.
    const now = frame.getBoundingClientRect();
    // From here on it belongs to the page: re-anchor to the current scroll.
    anchorRef.current = { x: scrollX, y: scrollY };
    if (layerRef.current) layerRef.current.style.transform = "";
    const duration = previous
      ? Math.max(MIN_RETARGET, FLY_DURATION - Number(previous.currentTime ?? 0))
      : FLY_DURATION;
    previous?.cancel();
    place(frame, to);
    const from = {
      transform: `translate(${now.left - to.left}px, ${now.top - to.top}px) scale(${
        now.width / to.width
      }, ${now.height / to.height})`,
    };
    const glide = frame.animate([from, { transform: "none" }], {
      duration,
      easing: EASE_OUT,
      fill: "forwards",
    });
    glideRef.current = { number: flight.number, animation: glide };
    const { number } = flight;
    glide.onfinish = () => touchDown(number);
    // Animations pause in background tabs; don't leave the flight hanging there.
    const fallback = setTimeout(() => touchDown(number), duration + 250);
    return () => clearTimeout(fallback);
  }, [flight, to]);

  // Once it knows where it's landing, the copy moves with the page: scrolling
  // the gallery as it lands carries it along with its card instead of leaving
  // it hanging over the page.
  const anchored = flight?.to != null;
  useEffect(() => {
    const layer = layerRef.current;
    if (!anchored || !layer) return;
    const follow = () => {
      const { x, y } = anchorRef.current;
      layer.style.transform = `translate(${x - scrollX}px, ${y - scrollY}px)`;
    };
    window.addEventListener("scroll", follow, { passive: true });
    return () => window.removeEventListener("scroll", follow);
  }, [anchored, number]);

  // Once the destination has drawn and faded in its painting, fade away; or
  // anyway, if it's taking too long.
  const landed = flight?.landed ?? false;
  const revealed = flight?.revealed ?? false;
  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => fadeOut(frameRef.current, number), revealed ? 0 : REVEAL_TIMEOUT);
    return () => clearTimeout(timer);
  }, [landed, revealed, number]);

  if (!flight) return null;
  const { from, painting } = flight;
  return (
    // Covers the window; shifted by how far the page has scrolled since the
    // landing spot was reported (see above), so rects inside stay in step.
    <div
      key={flight.number}
      ref={layerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100]"
    >
      <div
        // A fresh element per flight (keyed above), so an interrupted one's
        // animations go with it.
        ref={frameRef}
        data-flight-frame
        className="absolute flex origin-top-left items-center justify-center [container-type:size]"
        style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
      >
        <PaintingModel painting={painting} side="max(100cqw, 100cqh)" still />
      </div>
    </div>
  );
}

/** Fades the flying copy out, then ends flight `number`. */
function fadeOut(frame: HTMLElement | null, number: number | undefined) {
  if (!frame) return endFlight(number);
  frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT, fill: "forwards" }).onfinish =
    () => endFlight(number);
  // As above: don't rely on the animation finishing in a background tab.
  setTimeout(() => endFlight(number), FADE_OUT + 250);
}
