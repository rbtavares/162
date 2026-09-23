"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { PIXELS_PER_BLOCK, paintingSrc, type Painting } from "@/data/paintings";

type Props = {
  painting: Painting;
  /** CSS length for the square area the model must fit in. */
  side: string;
};

/** One full turn, in ms. */
const SPIN_PERIOD = 8000;
/** Easing back to face-forward: this long for no turn, plus up to RETURN_EXTRA for half a turn. */
const RETURN_BASE = 500;
const RETURN_EXTRA = 400;

/**
 * Spins the model while the enclosing `.group` is hovered. When the pointer
 * leaves, it eases back to face-forward the short way round before the flat
 * image takes over again. Runs in JS because CSS can't read where an endless
 * animation is to finish it smoothly.
 */
function useSpin(sceneRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const scene = sceneRef.current;
    const box = scene?.querySelector<HTMLElement>(".p3d-box");
    const group = scene?.closest<HTMLElement>(".group");
    if (!scene || !box || !group) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Where the box is (degrees) and what's moving it.
    let angle = 0;
    let startAngle = 0;
    let spin: Animation | null = null;
    let settle: Animation | null = null;

    const currentAngle = () => {
      if (spin) return startAngle + (((spin.currentTime as number) ?? 0) / SPIN_PERIOD) * 360;
      if (settle) {
        const t = new DOMMatrixReadOnly(getComputedStyle(box).transform);
        return (Math.atan2(-t.m13, t.m11) * 180) / Math.PI;
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
      // Normalise to (-180, 180] so the way back is the short one.
      const from = ((((currentAngle() + 180) % 360) + 360) % 360) - 180;
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

    group.addEventListener("pointerenter", onEnter);
    group.addEventListener("pointerleave", onLeave);
    return () => {
      group.removeEventListener("pointerenter", onEnter);
      group.removeEventListener("pointerleave", onLeave);
      spin?.cancel();
      settle?.cancel();
      scene.classList.remove("p3d-active", "p3d-spinning");
    };
  }, [sceneRef]);
}

/**
 * A 3D box of the painting built from CSS transforms. The front face is the
 * painting, the other faces use the in-game painting back texture, and the
 * depth equals one painting pixel. Spins while the enclosing `.group` is hovered.
 */
export function PaintingModel({ painting, side }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  useSpin(sceneRef);
  const max = Math.max(painting.width, painting.height);
  const style = {
    "--fw": `calc(${side} * ${painting.width / max})`,
    "--fh": `calc(${side} * ${painting.height / max})`,
    "--d": `calc(${side} / ${max * PIXELS_PER_BLOCK})`,
    "--block": `calc(${side} / ${max})`,
  } as CSSProperties;

  return (
    <div ref={sceneRef} className="p3d-scene" style={style}>
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
            alt={painting.title}
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
