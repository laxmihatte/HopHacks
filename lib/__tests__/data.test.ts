import { describe, expect, it } from "vitest";
import { ACUPOINTS, POINT_IDS, coercePointIds, getPoint, isPointId } from "@/lib/acupoints";
import { ROUTER_TOOL, systemPrompt } from "@/lib/prompt";

describe("the acupoint database", () => {
  it("contains the five MVP points", () => {
    expect(POINT_IDS.sort()).toEqual(["GB20", "LI4", "PC6", "SP6", "ST36"]);
  });

  for (const id of POINT_IDS) {
    const p = ACUPOINTS[id];

    it(`${id} has every field the details panel renders`, () => {
      expect(p.id).toBe(id);
      for (const key of ["name", "translation", "meridian", "region", "location", "technique"] as const) {
        expect(p[key], `${id}.${key}`).toBeTruthy();
      }
      expect(p.symptoms.length).toBeGreaterThanOrEqual(3);
      expect(p.coords3D).toHaveLength(3);
      expect(p.cameraTarget).toHaveLength(3);
      expect(typeof p.bilateral).toBe("boolean");
    });

    it(`${id} states the 3s press / 1s release rhythm the metronome keeps`, () => {
      // The panel text and the timer must not contradict each other on stage.
      expect(p.technique).toMatch(/3 seconds/);
      expect(p.technique).toMatch(/1 second/);
    });

    it(`${id} has lowercase symptom keys, so matching is predictable`, () => {
      for (const s of p.symptoms) expect(s).toBe(s.toLowerCase());
    });
  }

  it("flags the two points contraindicated in pregnancy", () => {
    expect(ACUPOINTS.LI4.caution).toMatch(/pregnan/i);
    expect(ACUPOINTS.SP6.caution).toMatch(/pregnan/i);
  });
});

describe("id coercion", () => {
  it("accepts approved ids", () => {
    expect(isPointId("LI4")).toBe(true);
    expect(getPoint("LI4").name).toBe("He Gu");
  });

  it("rejects anything outside the database", () => {
    for (const bad of ["li4", "LI40", "LU7", "", "__proto__", "toString", null, 7, {}]) {
      expect(isPointId(bad), String(bad)).toBe(false);
    }
  });

  it("drops hallucinated ids and de-duplicates the rest", () => {
    expect(coercePointIds(["LI4", "LU7", "LI4", "GB20", 42, null])).toEqual(["LI4", "GB20"]);
  });

  it("returns an empty list for non-arrays", () => {
    for (const bad of [null, undefined, "LI4", {}, 0]) {
      expect(coercePointIds(bad)).toEqual([]);
    }
  });
});

describe("the router prompt", () => {
  it("lists every approved id, so the model cannot be blamed for missing one", () => {
    const prompt = systemPrompt();
    for (const id of POINT_IDS) expect(prompt).toContain(id);
  });

  it("forbids the model from writing location or technique text", () => {
    expect(systemPrompt()).toMatch(/never write location or technique/i);
  });

  it("constrains the tool schema to the approved ids", () => {
    const enumerated = ROUTER_TOOL.input_schema.properties.recommendedPoints.items.properties.id.enum;
    expect([...enumerated].sort()).toEqual(POINT_IDS.sort());
  });

  it("caps the model at three points, matching the router", () => {
    expect(ROUTER_TOOL.input_schema.properties.recommendedPoints.maxItems).toBe(3);
  });
});
