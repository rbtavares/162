import type { CSSProperties } from "react";
import { PIXELS_PER_BLOCK, paintingSrc, type Painting } from "@/data/paintings";

type Props = {
  painting: Painting;
  /** CSS length for the square area the model must fit in. */
  side: string;
};

/**
 * A 3D box of the painting built from CSS transforms. The front face is the
 * painting, the other faces use the in-game painting back texture, and the
 * depth equals one painting pixel. Spins while the enclosing `.group` is hovered.
 */
export function PaintingModel({ painting, side }: Props) {
  const max = Math.max(painting.width, painting.height);
  const style = {
    "--fw": `calc(${side} * ${painting.width / max})`,
    "--fh": `calc(${side} * ${painting.height / max})`,
    "--d": `calc(${side} / ${max * PIXELS_PER_BLOCK})`,
    "--block": `calc(${side} / ${max})`,
  } as CSSProperties;

  return (
    <div className="p3d-scene" style={style}>
      {/* Flat image shown at rest; the 3D box only renders while hovered. */}
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
