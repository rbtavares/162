"use client";

import { useSyncExternalStore } from "react";
import type { Painting } from "@/data/paintings";

/*
 * A painting "flying" between the gallery and its page: a copy of it is pinned
 * over the screen (see FlightOverlay) at the spot it left, then glides to the
 * spot the destination reports once it has laid itself out. Both ends hide
 * their own copy of the painting while it is in the air.
 */

export type Rect = { left: number; top: number; width: number; height: number };

/** How the 3D model is turned (degrees): spun around Y, tilted around X. */
export type Orientation = { y: number; x: number };

export type Flight = {
  /** Counts up with every takeoff, to tell flights apart. */
  number: number;
  painting: Painting;
  /** "open": gallery to painting page; "close": back to the gallery. */
  direction: "open" | "close";
  /** Screen rect it leaves from. */
  from: Rect;
  /** How it's turned as it leaves; it straightens out on the way. */
  orientation: Orientation;
  /** Screen rect it lands on, once the destination has reported it. */
  to: Rect | null;
  /**
   * Touched down: the destination shows its own painting again (under the
   * flying copy, which then fades away).
   */
  landed: boolean;
  /**
   * The destination has drawn its painting, so the flying copy can fade.
   * The painting page draws only after touchdown (see PaintingCanvas).
   */
  revealed: boolean;
};

let flight: Flight | null = null;
let flights = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** The angle (degrees) of an element's `rotate` property, e.g. "x -7deg" or "0 1 0 45deg". */
function rotateAngle(el: Element | null | undefined) {
  const m = el && getComputedStyle(el).rotate.match(/(-?[\d.]+)deg/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * If painting `id` is already in the air, where the flying copy is right now
 * and how it's turned, so a new flight can take over from there instead of
 * jumping back to where the painting sits on the page.
 */
export function midAir(id: string): { from: Rect; orientation: Orientation } | null {
  const frame = document.querySelector("[data-flight-frame]");
  if (!flight || flight.painting.id !== id || !frame) return null;
  return {
    from: rectOf(frame),
    orientation: {
      y: rotateAngle(frame.querySelector(".p3d-box")),
      x: rotateAngle(frame.querySelector(".p3d-tilt")),
    },
  };
}

/**
 * Takes off, replacing any flight still under way. The <html> element gets
 * data-flight so CSS can animate the pages around it.
 */
export function startFlight(next: Omit<Flight, "number" | "to" | "landed" | "revealed">) {
  flight = { ...next, number: ++flights, to: null, landed: false, revealed: false };
  document.documentElement.dataset.flight = next.direction;
  emit();
}

/**
 * The destination reports where the painting will sit. It may report again
 * if its layout shifts while the painting is still in the air.
 */
export function landFlight(to: Rect) {
  if (!flight || flight.landed) return;
  const t = flight.to;
  if (t && t.left === to.left && t.top === to.top && t.width === to.width && t.height === to.height) return;
  flight = { ...flight, to };
  emit();
}

/**
 * Touched down: the destination may show its painting again. With `number`,
 * only if that flight is still the current one (for late timers).
 */
export function touchDown(number?: number) {
  if (!flight || flight.landed || (number !== undefined && flight.number !== number)) return;
  // A gallery card is just an image, drawn the moment it's shown again.
  flight = { ...flight, landed: true, revealed: flight.direction === "close" };
  emit();
}

/** The destination has drawn its painting under the flying copy. */
export function revealFlight() {
  if (!flight || !flight.landed || flight.revealed) return;
  flight = { ...flight, revealed: true };
  emit();
}

/** The flying copy has faded away (or the flight was abandoned). With `number`, as above. */
export function endFlight(number?: number) {
  if (!flight || (number !== undefined && flight.number !== number)) return;
  flight = null;
  delete document.documentElement.dataset.flight;
  emit();
}

export function currentFlight() {
  return flight;
}

export function useFlight() {
  return useSyncExternalStore(subscribe, currentFlight, () => null);
}

/** Whether painting `id` is in the air, so its own copy should stay hidden. */
export function useHiddenForFlight(id: string) {
  const f = useFlight();
  return f !== null && f.painting.id === id && !f.landed;
}

/**
 * For the painting page: `inAir` until painting `id` touches down, and
 * `covered` until its own drawing has taken over from the flying copy.
 */
export function useFlightStage(id: string) {
  const f = useFlight();
  const mine = f !== null && f.painting.id === id;
  return { inAir: mine && !f.landed, covered: mine && !f.revealed };
}
