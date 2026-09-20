import { describe, expect, it } from "vitest";
import { ANKLE, ELBOW, HAND, HEAD, HEIGHT, KNEE, NECK, WRIST, mirror } from "@/lib/anatomy";
import { ACUPOINTS, POINT_IDS } from "@/lib/acupoints";
import type { PointId } from "@/lib/types";

/**
 * These assertions are the reason the hotspots do not need hand-tweaking.
 * Each point is checked against the landmark its clinical description names,
 * so moving a limb in lib/anatomy.ts fails the build instead of silently
 * sliding a dot off the body.
 */
const NEAR: Record<PointId, { y: [number, number]; note: string }> = {
  LI4: { y: [HAND.y - HAND.r * 2, WRIST.y], note: "on the hand, below the wrist" },
  GB20: { y: [NECK.y, HEAD.y], note: "at the base of the skull" },
  PC6: { y: [WRIST.y, ELBOW.y], note: "on the forearm between wrist and elbow" },
  ST36: { y: [ANKLE.y, KNEE.y], note: "on the shin below the knee" },
  SP6: { y: [ANKLE.y, KNEE.y], note: "above the ankle, below the knee" },
};

describe("acupoint coordinates sit on the mannequin", () => {
  for (const id of POINT_IDS) {
    const p = ACUPOINTS[id];

    it(`${id} is ${NEAR[id].note}`, () => {
      const [, y] = p.coords3D;
      const [lo, hi] = NEAR[id].y;
      expect(y).toBeGreaterThanOrEqual(lo);
      expect(y).toBeLessThanOrEqual(hi);
    });

    it(`${id} is inside the figure's bounding volume`, () => {
      const [x, y, z] = p.coords3D;
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(HEIGHT);
      // Nothing is further out than an outstretched hand or thicker than the chest.
      expect(Math.abs(x)).toBeLessThan(0.35);
      expect(Math.abs(z)).toBeLessThan(0.2);
    });

    it(`${id} is defined on the figure's right, so mirroring produces the left`, () => {
      expect(p.coords3D[0]).toBeGreaterThanOrEqual(0);
    });

    it(`${id} has a usable camera shot`, () => {
      expect(p.cameraDistance).toBeGreaterThan(0.2);
      expect(p.cameraDistance).toBeLessThan(2);
      expect(["front", "back"]).toContain(p.approach);
    });
  }

  it("puts GB20 behind the figure and the rest in front", () => {
    expect(ACUPOINTS.GB20.coords3D[2]).toBeLessThan(0);
    expect(ACUPOINTS.GB20.approach).toBe("back");
    for (const id of POINT_IDS.filter((i) => i !== "GB20")) {
      expect(ACUPOINTS[id].coords3D[2]).toBeGreaterThanOrEqual(0);
      expect(ACUPOINTS[id].approach).toBe("front");
    }
  });

  it("places PC6 two cun above the wrist, as its description claims", () => {
    // 2 cun = 2 * HEIGHT/75 ≈ 4.8cm. Allow a centimetre of modelling slack.
    expect(ACUPOINTS.PC6.coords3D[1] - WRIST.y).toBeCloseTo((2 * HEIGHT) / 75, 1);
  });
});

describe("mirror", () => {
  it("flips X and leaves height and depth alone", () => {
    expect(mirror([0.2, 1.5, -0.1])).toEqual([-0.2, 1.5, -0.1]);
  });
});
