"use client";

import { Html } from "@react-three/drei";
import type { CSSProperties, RefObject } from "react";
import type * as THREE from "three";
import { mirror, type Vec3 } from "@/lib/anatomy";
import { step } from "@/lib/pressure";
import type { Acupoint } from "@/lib/types";

/**
 * A pressure marker pinned to a 3D coordinate.
 *
 * The marker's colour is the depth of pressure, on a single-hue red ramp.
 * Depth is also carried by the ring thickness and by a text label, so the
 * reading never depends on hue alone.
 *
 * `occlude` is given the body group explicitly rather than left to raycast the
 * whole scene: a point on the back of the neck is then correctly hidden while
 * the camera is in front, without the flicker that scene-wide occlusion
 * testing causes when the dots test against each other.
 */
function Marker({
  at,
  point,
  active,
  selected,
  occluder,
  onSelect,
}: {
  at: Vec3;
  point: Acupoint;
  active: boolean;
  selected: boolean;
  occluder: RefObject<THREE.Group | null>;
  onSelect: (id: Acupoint["id"]) => void;
}) {
  const p = step(point.pressure);
  const style = {
    "--dot": p.color,
    "--dot-glow": p.glow,
    "--dot-ring": `${p.ring}px`,
    pointerEvents: "auto",
  } as CSSProperties;

  return (
    <Html
      position={at}
      center
      occlude={[occluder as RefObject<THREE.Object3D>]}
      zIndexRange={[40, 0]}
      // Keeps the dot a constant on-screen size as the camera flies in, so it
      // does not balloon when the camera closes to 40cm for the hand.
      distanceFactor={1.4}
      style={style}
    >
      <button
        type="button"
        className={`hotspot ${active ? "is-active" : "is-dim"} ${selected ? "is-selected" : ""}`}
        aria-label={`${point.id}, ${point.name}, on the ${point.region}. ${p.label} pressure.`}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(point.id);
        }}
      >
        <span className="hotspot-ring" aria-hidden="true" />
        <span className="hotspot-core" aria-hidden="true" />
        <span className="hotspot-tag">
          {point.id}
          <em>{p.label}</em>
        </span>
      </button>
    </Html>
  );
}

export default function Hotspot({
  point,
  active,
  selected,
  occluder,
  onSelect,
}: {
  point: Acupoint;
  /** Recommended by the router this session. Dim markers are the rest of the library. */
  active: boolean;
  selected: boolean;
  occluder: RefObject<THREE.Group | null>;
  onSelect: (id: Acupoint["id"]) => void;
}) {
  const shared = { point, active, selected, occluder, onSelect };
  return (
    <>
      <Marker at={point.coords3D} {...shared} />
      {point.bilateral && <Marker at={mirror(point.coords3D)} {...shared} />}
    </>
  );
}
