import { describe, expect, it } from "vitest";
import { ACUPOINTS } from "@/lib/acupoints";
import { MAX_POINTS, describe as say, normalize, routeByKeyword } from "@/lib/router";

const ids = (text: string) => routeByKeyword(text).map((m) => m.id);

describe("the Golden Path sentence", () => {
  // This is the exact line the presenter types on stage. If this test ever
  // fails, the demo is broken.
  const PITCH = "I have a tension headache and stiff neck from coding all day.";

  it("routes to LI4 and GB20", () => {
    expect(ids(PITCH)).toEqual(expect.arrayContaining(["LI4", "GB20"]));
  });

  it("puts them first, ahead of any incidental match", () => {
    expect(ids(PITCH).slice(0, 2).sort()).toEqual(["GB20", "LI4"]);
  });

  it("is deterministic across repeated calls", () => {
    const runs = new Set(Array.from({ length: 200 }, () => ids(PITCH).join(",")));
    expect(runs.size).toBe(1);
  });

  it("explains itself using the user's own words", () => {
    const li4 = routeByKeyword(PITCH).find((m) => m.id === "LI4");
    expect(li4?.matched).toContain("tension headache");
  });
});

describe("routeByKeyword", () => {
  it("returns nothing for empty or whitespace input", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   \n\t ")).toEqual([]);
  });

  it("returns nothing when no symptom is mentioned", () => {
    expect(ids("what is the capital of France")).toEqual([]);
  });

  it("caps the routine at a manageable number of points", () => {
    // Deliberately name symptoms spanning all five points.
    const kitchenSink =
      "headache stiff neck nausea fatigue insomnia cramps anxiety bloating toothache dizziness";
    expect(ids(kitchenSink).length).toBeLessThanOrEqual(MAX_POINTS);
  });

  it("never returns a duplicate point", () => {
    const out = ids("headache headache headache migraine tension");
    expect(new Set(out).size).toBe(out.length);
  });

  it("weights a two-word phrase above a shared single word", () => {
    // "tension headache" is LI4-specific; "headache" alone is shared.
    expect(ids("tension headache")[0]).toBe("LI4");
  });

  it("breaks a tie toward the better-known point", () => {
    // Both GB20 and SI3 list "stiff neck". GB20 is the classic answer, and
    // POINT_IDS order encodes that, so the tie must not resolve to SI3.
    expect(ids("stiff neck")[0]).toBe("GB20");
  });

  it("matches on whole words only", () => {
    // "stress" must not fire on "distressed".
    expect(ids("I am distressed")).toEqual([]);
    expect(ids("I am under stress")).toContain("LI4");
  });

  it("is case and punctuation insensitive", () => {
    expect(ids("NAUSEA!!!")).toEqual(ids("nausea"));
    expect(ids("Stiff  neck?")).toEqual(ids("stiff neck"));
  });

  it("only ever returns ids from the approved database", () => {
    for (const id of ids("headache nausea fatigue insomnia cramps")) {
      expect(ACUPOINTS).toHaveProperty(id);
    }
  });
});

describe("normalize", () => {
  it("collapses punctuation and whitespace to single spaces", () => {
    expect(normalize("  Tension---headache!!  ")).toBe("tension headache");
  });
});

describe("describe", () => {
  it("names each point and the symptom that earned it", () => {
    const line = say(routeByKeyword("stiff neck"));
    expect(line).toContain("GB20");
    expect(line).toContain("Feng Chi");
    expect(line).toContain("stiff neck");
  });

  it("joins two points with 'and', not a trailing comma", () => {
    const line = say([
      { id: "LI4", matched: ["headache"] },
      { id: "GB20", matched: ["stiff neck"] },
    ]);
    expect(line).toContain("and GB20");
    expect(line).not.toContain(", and");
  });

  it("asks for more detail instead of guessing when nothing matched", () => {
    expect(say([])).toMatch(/could not map/i);
  });
});
