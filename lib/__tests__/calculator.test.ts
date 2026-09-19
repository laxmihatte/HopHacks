import { describe, expect, it } from "vitest";
import { cycleDates, estimate, grossCostForCycle, planYearOf } from "../calculator";
import type { EstimateInput, Regimen } from "../types";
import regimens from "../../data/regimens.json";

/**
 * Synthetic regimen matching the PRD's test fixture: $20,000 gross per cycle,
 * six cycles, so total billed is $120,000.
 */
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
  startDate: "2026-02-02",
  deductible: 3000,
  coinsuranceRate: 0.2,
  oopMax: 9000,
  householdSize: 4,
  income: 85000,
  insuranceType: "commercial",
};

describe("T1 — deductible, coinsurance, and the out-of-pocket cap", () => {
  const result = estimate(base, synthetic);

  it("bills $120,000 gross across six cycles", () => {
    expect(result.totalGross).toBe(120000);
  });

  it("stops the patient at the $9,000 out-of-pocket maximum", () => {
    expect(result.totalPatientPays).toBe(9000);
  });

  it("never lets a cycle push cumulative spend past the cap", () => {
    for (const c of result.cycles) {
      expect(c.cumulativePatientPays).toBeLessThanOrEqual(9000);
    }
  });

  it("charges the full deductible once, in cycle 1", () => {
    expect(result.cycles[0].deductibleApplied).toBe(3000);
    expect(result.cycles[0].coinsuranceApplied).toBe(3400); // 20% of $17,000
    expect(result.cycles[0].patientPays).toBe(6400);
    const later = result.cycles.slice(1).reduce((s, c) => s + c.deductibleApplied, 0);
    expect(later).toBe(0);
  });

  it("charges nothing once the cap binds", () => {
    expect(result.cycles[1].patientPays).toBe(2600); // capped from $4,000
    for (const c of result.cycles.slice(2)) expect(c.patientPays).toBe(0);
  });

  it("keeps each cycle's columns summing to what the patient pays", () => {
    for (const c of result.cycles) {
      expect(c.deductibleApplied + c.coinsuranceApplied).toBeCloseTo(c.patientPays, 2);
    }
  });

  it("stays inside one plan year", () => {
    expect(result.cycles.every((c) => !c.planYearReset)).toBe(true);
  });
});

describe("T2 — the plan-year reset", () => {
  /**
   * The PRD says "same, start September". With six 21-day cycles a September 1
   * start finishes December 15 and never crosses January 1, so that input
   * cannot produce the asserted two-deductible result. Both cases are pinned
   * below: the September start that does NOT reset, and a November start that
   * does.
   */
  it("does not reset when a September start finishes inside the plan year", () => {
    const result = estimate({ ...base, startDate: "2026-09-01" }, synthetic);
    expect(result.cycles.at(-1)!.date).toBe("2026-12-15");
    expect(result.cycles.every((c) => !c.planYearReset)).toBe(true);
    expect(result.totalPatientPays).toBe(9000);
  });

  it("charges two deductibles and two caps when treatment crosses January 1", () => {
    const result = estimate({ ...base, startDate: "2026-11-01" }, synthetic);

    const resets = result.cycles.filter((c) => c.planYearReset);
    expect(resets).toHaveLength(1);
    expect(resets[0].date).toBe("2027-01-03");

    const byYear = (y: number) =>
      result.cycles.filter((c) => c.planYear === y).reduce((s, c) => s + c.deductibleApplied, 0);
    expect(byYear(2026)).toBe(3000);
    expect(byYear(2027)).toBe(3000);

    // Two separate out-of-pocket ceilings: exactly double T1.
    expect(result.totalPatientPays).toBe(18000);
  });

  it("costs the patient more purely because of the calendar", () => {
    const february = estimate({ ...base, startDate: "2026-02-02" }, synthetic);
    const november = estimate({ ...base, startDate: "2026-11-01" }, synthetic);
    expect(november.totalPatientPays).toBeGreaterThan(february.totalPatientPays);
    expect(november.totalGross).toBe(february.totalGross);
  });
});

describe("T3 — gross cost below the remaining deductible", () => {
  const cheap: Regimen = { ...synthetic, adminCostPerCycle: 1000 };
  const result = estimate(base, cheap);

  it("charges no coinsurance while the deductible is unmet", () => {
    expect(result.cycles[0].grossCost).toBe(1000);
    expect(result.cycles[0].deductibleApplied).toBe(1000);
    expect(result.cycles[0].coinsuranceApplied).toBe(0);
  });

  it("consumes the deductible partially, then starts coinsurance", () => {
    expect(result.cycles[1].coinsuranceApplied).toBe(0);
    expect(result.cycles[2].coinsuranceApplied).toBe(0);
    // Deductible is exhausted after three $1,000 cycles.
    expect(result.cycles[3].deductibleApplied).toBe(0);
    expect(result.cycles[3].coinsuranceApplied).toBe(200); // 20% of $1,000
  });
});

describe("billing units round up", () => {
  it("bills a partial unit as a whole unit", () => {
    const r: Regimen = {
      ...synthetic,
      adminCostPerCycle: 0,
      drugs: [
        { hcpcs: "TEST", name: "Partial", dosePerCycle: 102, billingUnit: 10, paymentLimit: 1 },
      ],
    };
    // 102/10 = 10.2 units, billed as 11 — not 10, and not 10.2.
    expect(grossCostForCycle(r, 1)).toBe(11);
  });
});

describe("cycle dates are derived from the start date", () => {
  it("spaces cycles by the regimen's cycle length", () => {
    expect(cycleDates("2026-10-15", 3, 21)).toEqual([
      "2026-10-15",
      "2026-11-05",
      "2026-11-26",
    ]);
  });

  it("does not drift across a year boundary", () => {
    const dates = cycleDates("2026-12-20", 3, 21);
    expect(dates).toEqual(["2026-12-20", "2027-01-10", "2027-01-31"]);
    expect(planYearOf(dates[2])).toBe(2027);
  });
});

describe("real regimens priced from the October 2026 CMS file", () => {
  const byId = (id: string) => (regimens as Regimen[]).find((r) => r.id === id)!;

  it("prices AC-T's sequential phases separately", () => {
    const actt = byId("ac-t");
    // Cycles 1-4 carry doxorubicin + cyclophosphamide; cycles 5-8 paclitaxel.
    expect(grossCostForCycle(actt, 1)).toBeGreaterThan(grossCostForCycle(actt, 5));
    expect(grossCostForCycle(actt, 1)).toBe(390.49);
    expect(grossCostForCycle(actt, 5)).toBe(247.18);
  });

  it("prices TCHP in five figures per cycle", () => {
    expect(grossCostForCycle(byId("tchp"), 1)).toBe(10663.06);
  });

  it("crosses a plan year for the demo input", () => {
    const result = estimate(
      { ...base, regimenId: "tchp", startDate: "2026-10-15" },
      byId("tchp"),
    );
    expect(result.cycles.some((c) => c.planYearReset)).toBe(true);
    // Four cycles land in 2026 and exhaust the $9,000 cap; the two 2027 cycles
    // restart at a fresh deductible but end before the cap binds again.
    expect(result.totalPatientPays).toBe(15665.22);
  });
});
