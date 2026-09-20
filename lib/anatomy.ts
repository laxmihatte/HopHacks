import type { Sex } from "./types";

/**
 * The skeleton of the figure, in metres, as plain numbers.
 *
 * Both the 3D body (components/Mannequin.tsx) and the acupoint coordinates
 * (data/acupoints.json, checked against this file by lib/__tests__/anatomy.test.ts)
 * are built from these constants. That is deliberate: if a hotspot were
 * positioned by eye against an imported .glb, every tweak to the model would
 * silently move the anatomy out from under the dot. Here a point like PC6 is
 * defined as "two cun proximal of WRIST on the flexor surface", so it stays
 * correct even if the figure's build changes.
 *
 * Scene convention: Y is up, the figure faces +Z, and the origin sits on the
 * floor between the feet. The figure's own right hand is at +X, which is
 * screen-left when the camera looks at its front.
 */

/** Standing height, crown to floor. */
export const HEIGHT = 1.8;

/**
 * The traditional proportional unit used to locate points. One body-inch,
 * roughly the width of the patient's thumb; we scale it off total height so
 * the ratios hold if the figure is ever resized.
 */
export const CUN = HEIGHT / 75;

export const HEAD = { y: 1.62, r: 0.105 } as const;
export const NECK = { y: 1.47, r: 0.055, halfHeight: 0.06 } as const;

export const SHOULDER = { y: 1.42 } as const;

/**
 * Landmarks the acupoints are measured from.
 *
 * These are identical for both builds, and that is the point: all five MVP
 * points sit on the limbs or the skull, where male and female skeletons differ
 * by a few millimetres at this scale. Only the trunk silhouette changes, so
 * switching the figure can never move a dot. `anatomy.test.ts` asserts it.
 */
export const ELBOW = { y: 1.13, x: 0.21 } as const;
/** Wrist crease at ~0.47 of stature, which is where an adult arm actually
 *  hangs. Sitting it lower makes the figure read as ape-armed. */
export const WRIST = { y: 0.84, x: 0.225 } as const;
export const HAND = { y: 0.765, x: 0.23, r: 0.045 } as const;

export const HIP = { y: 0.9 } as const;
export const KNEE = { y: 0.5, x: 0.105 } as const;
export const ANKLE = { y: 0.08, x: 0.105 } as const;

/** Limb radii, tapering distally. */
export const LIMB = {
  shoulderJoint: 0.062,
  upperArmTop: 0.053,
  upperArmBottom: 0.044,
  forearmTop: 0.046,
  forearmBottom: 0.032,
  thighTop: 0.088,
  thighBottom: 0.062,
  calfTop: 0.062,
  calfBottom: 0.036,
} as const;

/**
 * Trunk silhouette, as a lathe profile of [radius, height] pairs revolved
 * around the vertical axis and then flattened front-to-back.
 *
 * The two builds differ where adult skeletons actually differ: shoulder
 * breadth, waist indent, and the width of the pelvis. Nothing else.
 */
export interface Build {
  label: string;
  /** Half-width of the shoulder line, where the arms hang from. */
  shoulderX: number;
  hipX: number;
  /** Front-to-back flattening applied to the revolved trunk. */
  depth: number;
  /** [radius, y] up the trunk, bottom to top. */
  profile: [number, number][];
  /** Modest chest volume; zero for the male build. */
  bust: number;
}

export const BUILD: Record<Sex, Build> = {
  male: {
    label: "Man",
    shoulderX: 0.195,
    hipX: 0.1,
    depth: 0.7,
    bust: 0,
    profile: [
      [0.012, 0.8],
      [0.105, 0.83],
      [0.152, 0.9],
      [0.148, 0.98],
      [0.136, 1.05],
      [0.152, 1.16],
      [0.176, 1.28],
      [0.184, 1.37],
      [0.15, 1.44],
      [0.058, 1.47],
    ],
  },
  female: {
    label: "Woman",
    shoulderX: 0.168,
    hipX: 0.115,
    depth: 0.72,
    bust: 0.046,
    profile: [
      [0.012, 0.8],
      [0.112, 0.83],
      [0.168, 0.9],
      [0.158, 0.98],
      [0.118, 1.06],
      [0.142, 1.17],
      [0.158, 1.28],
      [0.15, 1.37],
      [0.13, 1.44],
      [0.058, 1.47],
    ],
  },
};

/** Where a point sits on the surface, so dots never sink into the mesh. */
export const SURFACE_LIFT = 0.008;

export type Vec3 = [number, number, number];

/** Mirror a right-side coordinate onto the left. */
export function mirror([x, y, z]: Vec3): Vec3 {
  return [-x, y, z];
}
