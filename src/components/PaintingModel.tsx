"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { PIXELS_PER_BLOCK, paintingSrc, type Painting } from "@/data/paintings";
import {
  currentFlight,
  landFlight,
  midAir,
  prefersReducedMotion,
  rectOf,
  startFlight,
  useHiddenForFlight,
  type Orientation,
} from "@/lib/paintingFlight";

type Props = {
  painting: Painting;
  /** CSS length for the square area the model must fit in. */
  side: string;
  /**
   * Shown as the 3D box with no behaviour of its own, for the copy that flies
   * between pages; FlightOverlay turns it.
   */
  still?: boolean;
};

/** One full turn, in ms. */
const SPIN_PERIOD = 8000;
/** Easing back to face-forward: this long for no turn, plus up to RETURN_EXTRA for half a turn. */
const RETURN_BASE = 500;
const RETURN_EXTRA = 400;
/** How long the gallery fades out before navigating to the painting, in ms. */
const TAKEOFF_DELAY = 180;
/** The navigation waiting for the gallery to fade; a newer click replaces it. */
let pendingNavigation: ReturnType<typeof setTimeout> | undefined;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
/** Normalises an angle to (-180, 180], so turning back to 0 takes the short way. */
const shortAngle = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

type SpinControls = {
  /** Stops the spin and says how the model was turned at that moment. */
  takeOff: () => Orientation;
};

/**
 * Spins the model while the enclosing `.group` is hovered. When the pointer
 * leaves, it eases back to face-forward the short way round before the flat
 * image takes over again. Runs in JS because CSS can't read where an endless
 * animation is to finish it smoothly.
 */
function useSpin(sceneRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const controls = useRef<SpinControls | null>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const tilt = scene?.querySelector<HTMLElement>(".p3d-tilt");
    const box = scene?.querySelector<HTMLElement>(".p3d-box");
    const group = scene?.closest<HTMLElement>(".group");
    if (!enabled || !scene || !tilt || !box || !group) return;
    if (prefersReducedMotion()) return;

    // Where the box is (degrees) and what's moving it.
    let angle = 0;
    let startAngle = 0;
    let spin: Animation | null = null;
    let settle: Animation | null = null;

    const currentAngle = () => {
      if (spin) return startAngle + (((spin.currentTime as number) ?? 0) / SPIN_PERIOD) * 360;
      if (settle) {
        const t = new DOMMatrixReadOnly(getComputedStyle(box).transform);
        return toDegrees(Math.atan2(-t.m13, t.m11));
      }
      return angle;
    };

    const onEnter = () => {
      startAngle = currentAngle();
      settle?.cancel();
      settle = null;
      scene.classList.add("p3d-active", "p3d-spinning");
      spin = box.animate(
        [{ transform: `rotateY(${startAngle}deg)` }, { transform: `rotateY(${startAngle + 360}deg)` }],
        { duration: SPIN_PERIOD, iterations: Infinity },
      );
    };

    const onLeave = () => {
      if (!spin) return;
      const from = shortAngle(currentAngle());
      spin.cancel();
      spin = null;
      scene.classList.remove("p3d-spinning");
      settle = box.animate([{ transform: `rotateY(${from}deg)` }, { transform: "rotateY(0deg)" }], {
        duration: RETURN_BASE + (Math.abs(from) / 180) * RETURN_EXTRA,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
      settle.onfinish = () => {
        settle = null;
        angle = 0;
        scene.classList.remove("p3d-active");
      };
    };

    controls.current = {
      takeOff: () => {
        // The tilt eases in and out with a CSS transition; read where it is.
        const t = new DOMMatrixReadOnly(getComputedStyle(tilt).transform);
        const orientation = { y: shortAngle(currentAngle()), x: toDegrees(Math.atan2(t.m23, t.m22)) };
        // Settle the card itself flat for when the painting comes back; the
        // flying copy carries on from the orientation above.
        spin?.cancel();
        settle?.cancel();
        spin = settle = null;
        angle = 0;
        scene.classList.remove("p3d-active", "p3d-spinning");
        return orientation;
      },
    };

    group.addEventListener("pointerenter", onEnter);
    group.addEventListener("pointerleave", onLeave);
    return () => {
      controls.current = null;
      group.removeEventListener("pointerenter", onEnter);
      group.removeEventListener("pointerleave", onLeave);
      spin?.cancel();
      settle?.cancel();
      scene.classList.remove("p3d-active", "p3d-spinning");
    };
  }, [sceneRef, enabled]);

  return controls;
}

/**
 * The gallery end of a painting's flight (see paintingFlight): clicking the
 * card lifts the painting off it, just as it is turned, fades the gallery out
 * and then navigates; coming back from the painting page, the card scrolls
 * into view and reports where the painting should land.
 */
function useFlightEnd(
  sceneRef: RefObject<HTMLDivElement | null>,
  spin: RefObject<SpinControls | null>,
  painting: Painting,
  enabled: boolean,
) {
  const router = useRouter();
  // The painting object is recreated on renders; its identity is its id and image.
  const paintingRef = useRef(painting);
  useEffect(() => {
    paintingRef.current = painting;
  });
  const { id } = painting;

  useEffect(() => {
    const scene = sceneRef.current;
    const link = scene?.closest<HTMLAnchorElement>("a[href]");
    if (!enabled || !scene || !link) return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (prefersReducedMotion()) return;
      // Link skips its own navigation for a prevented click; navigate once
      // the gallery has had a moment to fade.
      e.preventDefault();
      const painting = paintingRef.current;
      // Still landing here from its page? Take off from where it is in the air.
      const air = midAir(painting.id);
      const turned = spin.current?.takeOff();
      startFlight({
        painting,
        direction: "open",
        from: air?.from ?? rectOf(scene),
        orientation: air?.orientation ?? turned ?? { y: 0, x: 0 },
      });
      const href = link.getAttribute("href")!;
      clearTimeout(pendingNavigation);
      pendingNavigation = setTimeout(() => router.push(href), TAKEOFF_DELAY);
    };
    link.addEventListener("click", onClick);
    return () => link.removeEventListener("click", onClick);
  }, [sceneRef, spin, router, enabled]);

  // Landing back here: bring the card into view, then say where it is.
  useEffect(() => {
    const scene = sceneRef.current;
    const flight = currentFlight();
    if (!enabled || !scene || flight?.direction !== "close" || flight.painting.id !== id) return;
    const r = scene.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) scene.scrollIntoView({ block: "center", behavior: "instant" });
    landFlight(rectOf(scene));
  }, [sceneRef, id, enabled]);
}

/**
 * A 3D box of the painting built from CSS transforms. The front face is the
 * painting, the other faces use the in-game painting back texture, and the
 * depth equals one painting pixel. Spins while the enclosing `.group` is hovered.
 */
export function PaintingModel({ painting, side, still = false }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const spin = useSpin(sceneRef, !still);
  useFlightEnd(sceneRef, spin, painting, !still);
  // While this painting is in the air, the flying copy stands in for it.
  const hidden = useHiddenForFlight(painting.id) && !still;
  const max = Math.max(painting.width, painting.height);
  const style = {
    "--fw": `calc(${side} * ${painting.width / max})`,
    "--fh": `calc(${side} * ${painting.height / max})`,
    "--d": `calc(${side} / ${max * PIXELS_PER_BLOCK})`,
    "--block": `calc(${side} / ${max})`,
  } as CSSProperties;

  return (
    <div
      ref={sceneRef}
      className={`p3d-scene ${still ? "p3d-active" : ""} ${hidden ? "invisible" : ""}`}
      style={style}
    >
      {/* Flat image shown at rest; the 3D box only renders while it moves. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={paintingSrc(painting)}
        alt=""
        aria-hidden
        width={painting.width * PIXELS_PER_BLOCK}
        height={painting.height * PIXELS_PER_BLOCK}
        className="p3d-flat"
      />
      <div className="p3d-tilt">
        <div className="p3d-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={paintingSrc(painting)}
            alt={still ? "" : painting.title}
            width={painting.width * PIXELS_PER_BLOCK}
            height={painting.height * PIXELS_PER_BLOCK}
            className="p3d-face p3d-front"
          />
          <div className="p3d-face p3d-back" />
          <div className="p3d-face p3d-left" />
          <div className="p3d-face p3d-right" />
          <div className="p3d-face p3d-top" />
          <div className="p3d-face p3d-bottom" />
        </div>
      </div>
    </div>
  );
}
