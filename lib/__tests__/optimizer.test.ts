import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, defaultWindow, sweepStartDates, todayIso } from "../optimizer";
import { estimate } from "../calculator";
import { InvalidInputError } from "../validation";
import type { EstimateInput, Regimen } from "../types";
import regimenData from "../../data/regimens.json";

const tchp = (regimenData as Regimen[]).find((r) => r.id === "tchp")!;

const input: EstimateInput = {
  regimenId: "tchp",
  startDate: "2026-10-15",
  deductible: 3000,
  coinsuranceRate: 0.2,
  oopMax: 9000,
  householdSize: 4,
  income: 85000,
  insuranceType: "commercial",
  planYearStart: "01-01",
};

describe("the sweep prices every candidate with the real engine", () => {
  const sweep = sweepStartDates(input, tchp, "2026-11-01", "2027-02-01", { stepDays: 1 });

  it("covers every day in the window", () => {
    expect(sweep.options).toHaveLength(93); // Nov 1 through Feb 1 inclusive
    expect(sweep.options[0].startDate).toBe("2026-11-01");
    expect(sweep.options.at(-1)!.startDate).toBe("2027-02-01");
  });

  it("agrees exactly with a direct estimate for each date", () => {
    for (const o of [sweep.options[0], sweep.options[45], sweep.options.at(-1)!]) {
      const direct = estimate({ ...input, startDate: o.startDate }, tchp);
      expect(o.totalPatientPays).toBe(direct.totalPatientPays);
      expect(o.totalGross).toBe(direct.totalGross);
    }
  });

  it("finds a cheaper date than the worst one, and quantifies the spread", () => {
    expect(sweep.cheapest.totalPatientPays).toBeLessThan(sweep.costliest.totalPatientPays);
    expect(sweep.spread).toBe(
      Math.round((sweep.costliest.totalPatientPays - sweep.cheapest.totalPatientPays) * 100) / 100,
    );
    expect(sweep.spread).toBeGreaterThan(0);
  });

  it("prefers starting after the boundary, which charges one deductible not two", () => {
    expect(sweep.cheapest.deductiblesCharged).toBeLessThanOrEqual(
      sweep.costliest.deductiblesCharged,
    );
    expect(sweep.costliest.boundariesCrossed).toBeGreaterThanOrEqual(
      sweep.cheapest.boundariesCrossed,
    );
  });

  it("breaks ties toward the earliest date, never recommending a needless delay", () => {
    const best = sweep.cheapest.totalPatientPays;
    const firstAtBest = sweep.options.find((o) => o.totalPatientPays === best)!;
    expect(sweep.cheapest.startDate).toBe(firstAtBest.startDate);
  });

  it("prices the user's own date for comparison", () => {
    const s = sweepStartDates(input, tchp, "2026-10-01", "2026-12-01", { stepDays: 1 });
    expect(s.chosen!.startDate).toBe("2026-10-15");
    expect(s.savingsVsChosen).toBe(
      Math.round((s.chosen!.totalPatientPays - s.cheapest.totalPatientPays) * 100) / 100,
    );
    expect(s.savingsVsChosen).toBeGreaterThanOrEqual(0);
  });
});

describe("the boundary date drives the answer", () => {
  it("recommends a different date for a July plan year than a January one", () => {
    const jan = sweepStartDates(input, tchp, "2026-11-01", "2027-02-01", { stepDays: 1 });
    const jul = sweepStartDates(
      { ...input, planYearStart: "07-01" },
      tchp,
      "2026-11-01",
      "2027-02-01",
      { stepDays: 1 },
    );
    // A July plan year has no boundary inside this window, so every date costs
    // the same and the sweep should not claim a saving.
    expect(jul.spread).toBe(0);
    expect(jan.spread).toBeGreaterThan(0);
  });
});

describe("aid is carried through the sweep", () => {
  it("applies the award cap to every candidate", () => {
    const s = sweepStartDates(input, tchp, "2026-11-01", "2026-12-01", {
      stepDays: 7,
      awardCap: 12000,
    });
    for (const o of s.options) {
      expect(o.totalAfterAid).toBe(Math.max(0, Math.round((o.totalPatientPays - 12000) * 100) / 100));
      expect(o.totalAfterAid).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the sweep refuses input it cannot price", () => {
  it("rejects a backwards window", () => {
    expect(() => sweepStartDates(input, tchp, "2027-01-01", "2026-01-01")).toThrow(InvalidInputError);
  });

  it("rejects invalid dates", () => {
    expect(() => sweepStartDates(input, tchp, "0050-01-01", "2027-01-01")).toThrow(InvalidInputError);
  });

  it("refuses a window too large to compute, rather than hanging", () => {
    expect(() => sweepStartDates(input, tchp, "2026-01-01", "2030-01-01", { stepDays: 1 })).toThrow(
      /narrow it|limit/i,
    );
  });

  it("honours the step size", () => {
    const s = sweepStartDates(input, tchp, "2026-11-01", "2026-12-01", { stepDays: 7 });
    expect(s.options).toHaveLength(5);
    expect(s.options.map((o) => o.startDate)).toEqual([
      "2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29",
    ]);
  });

  it("caps candidates so a wide window cannot lock the browser", () => {
    expect(MAX_CANDIDATES).toBeLessThanOrEqual(400);
  });
});

describe("the default window straddles the chosen date", () => {
  it("reaches back four weeks and forward twelve when all of it is in the future", () => {
    expect(defaultWindow("2026-10-15", "2026-08-01")).toEqual({
      from: "2026-09-17",
      to: "2027-01-07",
    });
  });

  it("never opens before today — a past date is not a choice the patient has", () => {
    // Four weeks before Oct 15 is Sep 17, which is already gone on Sep 19.
    expect(defaultWindow("2026-10-15", "2026-09-19").from).toBe("2026-09-19");
  });

  it("does not push the window past the chosen date when today is later", () => {
    const w = defaultWindow("2026-10-15", "2026-12-25");
    expect(w.from).toBe("2026-10-15");
    expect(w.to).toBe("2027-01-07");
  });

  it("reports today as a real ISO date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
