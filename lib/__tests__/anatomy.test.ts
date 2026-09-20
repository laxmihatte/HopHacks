import { describe, expect, it } from "vitest";
import { ANKLE, ELBOW, HAND, HEAD, HEIGHT, KNEE, NECK, WRIST, mirror } from "@/lib/anatomy";
import { ACUPOINTS, POINT_IDS } from "@/lib/acupoints";
import type { Region } from "@/lib/types";

/**
 * The height band each region occupies on the figure.
 *
 * This is why the hotspots need no hand-tweaking. A point declares the part of
 * the body its clinical description names, and the band is computed from the
 * same landmark constants that build the mesh — so moving a limb in
 * lib/anatomy.ts fails the build instead of silently sliding a dot into space.
 */
const BAND: Record<Region, [number, number]> = {
  head: [NECK.y, HEAD.y + HEAD.r * 1.2],
  neck: [NECK.y - 0.08, HEAD.y],
  shoulder: [1.4, 1.53],
  elbow: [ELBOW.y - 0.06, ELBOW.y + 0.06],
  forearm: [WRIST.y, ELBOW.y],
  wrist: [WRIST.y - 0.02, WRIST.y + 0.03],
  hand: [HAND.y - HAND.r * 2, WRIST.y],
  knee: [KNEE.y - 0.06, KNEE.y + 0.06],
  leg: [ANKLE.y, KNEE.y],
  calf: [ANKLE.y, KNEE.y],
  ankle: [ANKLE.y, KNEE.y],
  foot: [0, ANKLE.y + 0.03],
};

describe("every acupoint sits on the part of the body it names", () => {
  for (const id of POINT_IDS) {
    const p = ACUPOINTS[id];

    it(`${id} is on the ${p.region}`, () => {
      const [lo, hi] = BAND[p.region];
      expect(p.coords3D[1]).toBeGreaterThanOrEqual(lo);
      expect(p.coords3D[1]).toBeLessThanOrEqual(hi);
    });

    it(`${id} is inside the figure's bounding volume`, () => {
      const [x, y, z] = p.coords3D;
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(HEIGHT);
      expect(Math.abs(x)).toBeLessThan(0.35);
      expect(Math.abs(z)).toBeLessThan(0.2);
    });

    it(`${id} is defined on the figure's right, so mirroring produces the left`, () => {
      expect(p.coords3D[0]).toBeGreaterThanOrEqual(0);
    });

    it(`${id} has a usable camera shot`, () => {
      expect(p.cameraDistance).toBeGreaterThan(0.2);
      expect(p.cameraDistance).toBeLessThan(2);
      const [dx, dy, dz] = p.cameraDir;
      expect(Math.hypot(dx, dy, dz), "cameraDir must be a unit vector").toBeCloseTo(1, 2);
    });
  }
});

describe("the camera can actually see each point", () => {
  /** Where the camera ends up when it flies to a point. */
  const shot = (id: (typeof POINT_IDS)[number]) => {
    const p = ACUPOINTS[id];
    return p.coords3D.map((c, i) => c + p.cameraDir[i] * p.cameraDistance) as [
      number,
      number,
      number,
    ];
  };

  it("never parks the camera inside the figure", () => {
    // The failure this catches is specific and was real: a point on the inner
    // forearm viewed from the front-right puts the arm between the camera and
    // the dot, so the marker is occluded and the reveal shows nothing. A
    // camera either stands clear of the body's central column or is above the
    // crown looking down.
    for (const id of POINT_IDS) {
      const [x, y, z] = shot(id);
      const fromAxis = Math.hypot(x, z);
      const overhead = y > HEIGHT;
      expect(fromAxis > 0.3 || overhead, `${id}: camera at ${fromAxis.toFixed(2)}m from axis`).toBe(
        true,
      );
    }
  });

  it("views a point from the same side of the limb the point is on", () => {
    // Anything appreciably off the mid-plane must be viewed from its own side,
    // front or back. This is what "approach: front" got wrong for the two
    // points on the little-finger side of the arm.
    for (const id of POINT_IDS) {
      const p = ACUPOINTS[id];
      if (Math.abs(p.coords3D[2]) < 0.04) continue;
      expect(Math.sign(p.cameraDir[2]), id).toBe(Math.sign(p.coords3D[2]));
    }
  });

  it("looks down onto the points that sit on a top surface", () => {
    // Crown, shoulder and instep are only visible from above.
    for (const id of ["GV20", "GB21", "LR3"] as const) {
      expect(ACUPOINTS[id].cameraDir[1], id).toBeGreaterThan(0.5);
    }
  });
});

describe("points measured in cun land where the measurement says", () => {
  it("puts PC6 two cun above the wrist crease", () => {
    expect(ACUPOINTS.PC6.coords3D[1] - WRIST.y).toBeCloseTo((2 * HEIGHT) / 75, 2);
  });

  it("puts LU7 one and a half cun above the wrist crease", () => {
    expect(ACUPOINTS.LU7.coords3D[1] - WRIST.y).toBeCloseTo((1.5 * HEIGHT) / 75, 2);
  });

  it("puts GV20 at the crown, above everything else", () => {
    const others = POINT_IDS.filter((i) => i !== "GV20").map((i) => ACUPOINTS[i].coords3D[1]);
    expect(ACUPOINTS.GV20.coords3D[1]).toBeGreaterThan(Math.max(...others));
  });
});

describe("the points are distinguishable to a finger", () => {
  it("keeps every pair at least a centimetre apart", () => {
    // Two dots closer than this would be one target on screen, and the user
    // could not tell which one they pressed.
    for (const a of POINT_IDS) {
      for (const b of POINT_IDS) {
        if (a >= b) continue;
        const [ax, ay, az] = ACUPOINTS[a].coords3D;
        const [bx, by, bz] = ACUPOINTS[b].coords3D;
        const d = Math.hypot(ax - bx, ay - by, az - bz);
        expect(d, `${a} vs ${b}`).toBeGreaterThan(0.01);
      }
    }
  });

  it("has a unique id per entry", () => {
    expect(new Set(POINT_IDS).size).toBe(POINT_IDS.length);
  });
});

describe("mirror", () => {
  it("flips X and leaves height and depth alone", () => {
    expect(mirror([0.2, 1.5, -0.1])).toEqual([-0.2, 1.5, -0.1]);
  });
});
