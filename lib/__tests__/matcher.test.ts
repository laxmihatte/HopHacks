import { describe, expect, it } from "vitest";
import { applyAid, fplPercent, guideline, matchPrograms, navigateAid } from "../matcher";
import { estimate } from "../calculator";
import type { Estimate, EstimateInput, FplTable, Program, Regimen } from "../types";
import fpl from "../../data/fpl.json";
import programs from "../../data/programs.json";
import regimens from "../../data/regimens.json";

const table = fpl as FplTable;
const all = programs as Program[];

describe("federal poverty guideline", () => {
  it("reproduces the published 2026 table", () => {
    expect(guideline(1, table)).toBe(15960);
    expect(guideline(4, table)).toBe(33000); // the value the PRD says to verify
    expect(guideline(8, table)).toBe(55720);
  });

  it("puts the demo household at roughly 258% of the guideline", () => {
    expect(fplPercent(85000, 4, table)).toBeCloseTo(257.58, 2);
  });
});

describe("eligibility predicate", () => {
  const opts = {
    fplPercent: 257.58,
    diagnosis: "breast-cancer",
    insuranceType: "commercial" as const,
  };

  it("returns matches for the demo patient", () => {
    expect(matchPrograms(all, opts).length).toBeGreaterThan(0);
  });

  it("ranks by award cap descending", () => {
    const caps = matchPrograms(all, opts).map((p) => p.awardCap);
    expect(caps).toEqual([...caps].sort((a, b) => b - a));
  });

  it("excludes closed funds", () => {
    expect(matchPrograms(all, opts).every((p) => p.status === "open")).toBe(true);
  });

  it("excludes funds for other diagnoses", () => {
    const ids = matchPrograms(all, opts).map((p) => p.id);
    expect(ids).not.toContain("lls-patient-aid");
    expect(ids).not.toContain("pafcpr-colorectal");
  });

  it("includes diagnosis-agnostic funds", () => {
    expect(matchPrograms(all, opts).map((p) => p.id)).toContain("family-reach");
  });

  it("excludes funds whose FPL gate is below the household", () => {
    // Komen gates at 300%; a household at 450% should not match.
    const ids = matchPrograms(all, { ...opts, fplPercent: 450 }).map((p) => p.id);
    expect(ids).not.toContain("komen-financial-assistance");
  });

  it("respects insurance type", () => {
    const ids = matchPrograms(all, { ...opts, insuranceType: "uninsured" }).map((p) => p.id);
    expect(ids).not.toContain("cancercare-copay");
    expect(ids).toContain("komen-financial-assistance");
  });

  it("returns nothing for an income far above every gate", () => {
    expect(matchPrograms(all, { ...opts, fplPercent: 5000 })).toEqual([]);
  });
});

describe("aid application never overstates relief", () => {
  const fake: Estimate = {
    cycles: [
      { index: 1, date: "2026-10-15", planYear: 2026, planYearReset: false, grossCost: 0, deductibleApplied: 0, coinsuranceApplied: 0, patientPays: 4000, cumulativePatientPays: 4000 },
      { index: 2, date: "2026-11-05", planYear: 2026, planYearReset: false, grossCost: 0, deductibleApplied: 0, coinsuranceApplied: 0, patientPays: 5000, cumulativePatientPays: 9000 },
    ],
    totalGross: 0,
    totalPatientPays: 9000,
  };

  it("applies only the single largest cap, never the sum", () => {
    // Largest matched cap is $12,000; the sum of all caps is far more.
    const matched = matchPrograms(all, {
      fplPercent: 257.58,
      diagnosis: "breast-cancer",
      insuranceType: "commercial",
    });
    const summed = matched.reduce((s, p) => s + p.awardCap, 0);
    expect(summed).toBeGreaterThan(matched[0].awardCap);

    expect(applyAid(fake, matched[0].awardCap)).toEqual([0, 0]);
    expect(applyAid(fake, 5000)).toEqual([0, 4000]);
  });

  it("never returns a negative after-aid figure", () => {
    expect(applyAid(fake, 1_000_000).every((v) => v >= 0)).toBe(true);
  });

  it("leaves the curve untouched when nothing matches", () => {
    expect(applyAid(fake, 0)).toEqual([4000, 9000]);
  });
});

describe("end to end on the demo input", () => {
  const tchp = (regimens as Regimen[]).find((r) => r.id === "tchp")!;
  const input: EstimateInput = {
    regimenId: "tchp",
    startDate: "2026-10-15",
    deductible: 3000,
    coinsuranceRate: 0.2,
    oopMax: 9000,
    householdSize: 4,
    income: 85000,
    insuranceType: "commercial",
  };

  it("produces a gap between the before-aid and after-aid totals", () => {
    const est = estimate(input, tchp);
    const aid = navigateAid(est, all, table, {
      income: input.income,
      householdSize: input.householdSize,
      diagnosis: tchp.diagnosis,
      insuranceType: input.insuranceType,
    });

    expect(est.totalPatientPays).toBe(15665.22);
    expect(aid.bestAwardCap).toBe(12000);
    expect(aid.totalAfterAid).toBe(3665.22);
    expect(aid.totalAfterAid).toBeLessThan(est.totalPatientPays);
    expect(aid.matched.length).toBeGreaterThanOrEqual(3);
  });
});
