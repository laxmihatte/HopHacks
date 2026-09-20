import { describe, expect, it } from "vitest";
import { ACUPOINTS, POINT_IDS } from "@/lib/acupoints";
import { BUILD } from "@/lib/anatomy";
import { PRESSURE, PRESSURE_ORDER, step } from "@/lib/pressure";
import type { Sex } from "@/lib/types";

/** Relative luminance, per WCAG, for checking the ramp is ordered. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Hue in degrees, to prove the ramp is one hue rather than a rainbow. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("the pressure ramp", () => {
  it("has a step for every level, in order", () => {
    expect(PRESSURE_ORDER).toEqual(["light", "moderate", "firm", "deep"]);
    for (const level of PRESSURE_ORDER) expect(PRESSURE[level]).toBeDefined();
  });

  it("gets darker as pressure deepens, monotonically", () => {
    // This is what makes the encoding readable: magnitude rides on lightness,
    // so the order survives greyscale, a washed-out projector, and every form
    // of colour-vision deficiency.
    const ls = PRESSURE_ORDER.map((l) => luminance(PRESSURE[l].color));
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i], `${PRESSURE_ORDER[i]} vs ${PRESSURE_ORDER[i - 1]}`).toBeLessThan(ls[i - 1]);
    }
  });

  it("is a single hue, not a rainbow", () => {
    const hues = PRESSURE_ORDER.map((l) => hue(PRESSURE[l].color));
    // All within a narrow red/rose band.
    for (const h of hues) expect(h > 330 || h < 15).toBe(true);
    expect(Math.max(...hues) - Math.min(...hues)).toBeLessThan(30);
  });

  it("thickens the ring as pressure deepens, so depth is not colour-only", () => {
    const rings = PRESSURE_ORDER.map((l) => PRESSURE[l].ring);
    for (let i = 1; i < rings.length; i++) expect(rings[i]).toBeGreaterThan(rings[i - 1]);
  });

  it("names the force in words for every level", () => {
    for (const level of PRESSURE_ORDER) {
      expect(PRESSURE[level].label).toBeTruthy();
      expect(PRESSURE[level].force.length).toBeGreaterThan(30);
    }
  });
});

describe("every point declares a pressure depth", () => {
  for (const id of POINT_IDS) {
    it(`${id} has a valid level with a renderable step`, () => {
      expect(PRESSURE_ORDER).toContain(ACUPOINTS[id].pressure);
      expect(step(ACUPOINTS[id].pressure).color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  }

  it("uses more than one level, so the ramp is actually demonstrated", () => {
    const used = new Set(POINT_IDS.map((id) => ACUPOINTS[id].pressure));
    expect(used.size).toBeGreaterThanOrEqual(3);
  });

  it("presses lightly over thin tissue and deeply into muscle", () => {
    // SP6 lies on bone at the ankle; ST36 sits in the belly of tibialis anterior.
    expect(ACUPOINTS.SP6.pressure).toBe("light");
    expect(ACUPOINTS.ST36.pressure).toBe("deep");
  });
});

describe("the male and female builds", () => {
  const sexes = Object.keys(BUILD) as Sex[];

  it("offers exactly two labelled builds", () => {
    expect(sexes.sort()).toEqual(["female", "male"]);
    for (const s of sexes) expect(BUILD[s].label).toBeTruthy();
  });

  it("differs where adult skeletons differ: shoulders and hips", () => {
    expect(BUILD.male.shoulderX).toBeGreaterThan(BUILD.female.shoulderX);
    expect(BUILD.female.hipX).toBeGreaterThan(BUILD.male.hipX);
  });

  it("gives the female build a narrower waist relative to the hip", () => {
    // Measured at the actual heights, not by min/max of the whole profile:
    // the narrowest radius is the crotch and the widest is the male chest, so
    // the extremes answer a different question than the one being asked.
    const radiusAt = (s: Sex, y: number) =>
      BUILD[s].profile.reduce((best, p) =>
        Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best,
      )[0];
    const ratio = (s: Sex) => radiusAt(s, 1.05) / radiusAt(s, 0.9);
    expect(ratio("female")).toBeLessThan(ratio("male"));
  });

  it("keeps both trunks within the same height band, so nothing floats", () => {
    for (const s of sexes) {
      const ys = BUILD[s].profile.map(([, y]) => y);
      expect(Math.min(...ys)).toBeLessThan(0.9);
      expect(Math.max(...ys)).toBeGreaterThan(1.4);
      // Profile must ascend, or the lathe self-intersects.
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
      for (const [r] of BUILD[s].profile) expect(r).toBeGreaterThan(0);
    }
  });

  it("never moves a point when the body is switched", () => {
    // The whole reason the switch is safe: all five points sit on limbs or the
    // skull, whose landmarks are shared constants, not per-build values.
    const perBuildKeys = new Set(["shoulderX", "hipX", "depth", "profile", "bust", "label"]);
    expect(new Set(Object.keys(BUILD.male))).toEqual(perBuildKeys);
    expect(new Set(Object.keys(BUILD.female))).toEqual(perBuildKeys);
  });
});
