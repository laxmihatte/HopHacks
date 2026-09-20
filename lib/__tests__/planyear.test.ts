import { describe, expect, it } from "vitest";
import { estimate, planYearBoundary, planYearOf } from "../calculator";
import { isValidMonthDay } from "../validation";
import type { EstimateInput, Regimen } from "../types";

const synthetic: Regimen = {
  id: "synthetic",
  name: "Synthetic $20k/cycle",
  diagnosis: "breast-cancer",
  cycleCount: 6,
  cycleLengthDays: 21,
  adminCostPerCycle: 20000,
  drugs: [],
  sourceNote: "test fixture",
  adminSourceNote: "test fixture",
};

const base: EstimateInput = {
  regimenId: "synthetic",
  startDate: "2026-11-01",
  deductible: 3000,
  coinsuranceRate: 0.2,
  oopMax: 9000,
  householdSize: 4,
  income: 85000,
  insuranceType: "commercial",
  planYearStart: "01-01",
};

describe("plan year is labelled by the year its boundary falls in", () => {
  it("matches the calendar year for a January boundary", () => {
    expect(planYearOf("2026-01-01", "01-01")).toBe(2026);
    expect(planYearOf("2026-12-31", "01-01")).toBe(2026);
  });

  it("splits the calendar year for a July boundary", () => {
    // Before July 1 you are still in the plan year that began the July before.
    expect(planYearOf("2026-06-30", "07-01")).toBe(2025);
    expect(planYearOf("2026-07-01", "07-01")).toBe(2026);
    expect(planYearOf("2027-01-15", "07-01")).toBe(2026);
  });

  it("reports the boundary date for a plan year", () => {
    expect(planYearBoundary(2027, "01-01")).toBe("2027-01-01");
    expect(planYearBoundary(2026, "07-01")).toBe("2026-07-01");
    expect(planYearBoundary(2026, "10-01")).toBe("2026-10-01");
  });

  it("accepts only real month/day pairs", () => {
    expect(isValidMonthDay("01-01")).toBe(true);
    expect(isValidMonthDay("07-01")).toBe(true);
    expect(isValidMonthDay("02-29")).toBe(true); // valid boundary in a leap year
    expect(isValidMonthDay("02-30")).toBe(false);
    expect(isValidMonthDay("13-01")).toBe(false);
    expect(isValidMonthDay("1-1")).toBe(false);
    expect(isValidMonthDay("")).toBe(false);
  });
});

describe("the boundary the patient actually has changes what they owe", () => {
  it("resets on January 1 for a calendar-year plan", () => {
    const r = estimate(base, synthetic);
    const resets = r.cycles.filter((c) => c.planYearReset);
    expect(resets).toHaveLength(1);
    expect(resets[0].resetOn).toBe("2027-01-01");
    expect(r.totalPatientPays).toBe(18000); // two deductibles, two caps
  });

  it("does not reset at all for a July plan year over the same treatment", () => {
    // Nov 1 2026 through mid-Feb 2027 never crosses a July 1 boundary.
    const r = estimate({ ...base, planYearStart: "07-01" }, synthetic);
    expect(r.cycles.every((c) => !c.planYearReset)).toBe(true);
    expect(r.totalPatientPays).toBe(9000); // one deductible, one cap
  });

  it("is a $9,000 difference driven only by the boundary date", () => {
    const calendar = estimate(base, synthetic);
    const july = estimate({ ...base, planYearStart: "07-01" }, synthetic);
    expect(calendar.totalGross).toBe(july.totalGross);
    expect(calendar.totalPatientPays - july.totalPatientPays).toBe(9000);
  });

  it("resets on an October boundary when treatment crosses it", () => {
    const r = estimate(
      { ...base, startDate: "2026-09-01", planYearStart: "10-01" },
      synthetic,
    );
    const resets = r.cycles.filter((c) => c.planYearReset);
    expect(resets).toHaveLength(1);
    expect(resets[0].resetOn).toBe("2026-10-01");
  });

  it("defaults to January when no boundary is supplied", () => {
    expect(planYearOf("2026-06-01")).toBe(2026);
    expect(planYearBoundary(2026)).toBe("2026-01-01");
  });
});
