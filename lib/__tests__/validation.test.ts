import { describe, expect, it } from "vitest";
import { estimate, parseIsoUtc } from "../calculator";
import { fplPercent, isEligible, matchPrograms } from "../matcher";
import { niceScale } from "../../components/CostChart";
import {
  InvalidInputError,
  isValidIsoDate,
  parseField,
  validateForm,
} from "../validation";
import type { EstimateInput, FplTable, Program, Regimen } from "../types";
import fplData from "../../data/fpl.json";
import programData from "../../data/programs.json";
import regimenData from "../../data/regimens.json";

const fpl = fplData as FplTable;
const programs = programData as Program[];
const tchp = (regimenData as Regimen[]).find((r) => r.id === "tchp")!;

const valid = {
  startDate: "2026-10-15",
  planYearStart: "01-01",
  deductible: "3000",
  coinsurancePercent: "20",
  oopMax: "9000",
  householdSize: "4",
  income: "85000",
};

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

describe("date parsing rejects dates that used to be silently rewritten", () => {
  it("rejects a two-digit year instead of mapping it into the 1900s", () => {
    // Date.UTC(50, 0, 1) is 1950-01-01. That must not be accepted as year 50.
    expect(isValidIsoDate("0050-01-01")).toBe(false);
    expect(() => parseIsoUtc("0050-01-01")).toThrow(InvalidInputError);
  });

  it("rejects an impossible month or day instead of rolling it forward", () => {
    // Date.UTC(2026, 12, 45) rolls to 2027-02-14.
    expect(isValidIsoDate("2026-13-45")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(() => parseIsoUtc("2026-13-45")).toThrow(InvalidInputError);
  });

  it("rejects blank and malformed dates", () => {
    for (const bad of ["", "2026-1-1", "10/15/2026", "not a date"]) {
      expect(isValidIsoDate(bad)).toBe(false);
    }
  });

  it("accepts real dates, including a leap day", () => {
    expect(isValidIsoDate("2026-10-15")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false); // 2026 is not a leap year
  });

  it("round-trips a parsed date to the same calendar day", () => {
    expect(new Date(parseIsoUtc("2026-10-15")).toISOString().slice(0, 10)).toBe("2026-10-15");
  });
});

describe("form validation accepts the values real plans actually use", () => {
  it("accepts non-round money, which step=100/step=1000 used to block", () => {
    expect(
      validateForm({
        ...valid,
        income: "85500",
        deductible: "1750",
        oopMax: "8150",
        coinsurancePercent: "17.5",
      }),
    ).toEqual({});
  });

  it("accepts the demo input", () => {
    expect(validateForm(valid)).toEqual({});
  });

  it("rejects out-of-range and missing values with a message per field", () => {
    expect(validateForm({ ...valid, deductible: "-5000" }).deductible).toMatch(/negative/i);
    expect(validateForm({ ...valid, coinsurancePercent: "150" }).coinsurancePercent).toMatch(/between/i);
    expect(validateForm({ ...valid, income: "" }).income).toMatch(/enter/i);
    expect(validateForm({ ...valid, householdSize: "2.5" }).householdSize).toMatch(/whole number/i);
    expect(validateForm({ ...valid, householdSize: "0" }).householdSize).toMatch(/between/i);
    expect(validateForm({ ...valid, startDate: "0050-01-01" }).startDate).toMatch(/real date/i);
  });

  it("still catches an out-of-pocket maximum below the deductible", () => {
    expect(validateForm({ ...valid, oopMax: "1000" }).oopMax).toMatch(/below the deductible/i);
  });

  it("treats a blank field as missing, not as zero", () => {
    expect(parseField("")).toBeNull();
    expect(parseField("   ")).toBeNull();
    expect(parseField("abc")).toBeNull();
    expect(parseField("0")).toBe(0);
  });
});

describe("the engine refuses nonsense instead of computing it", () => {
  it("rejects coinsurance above 100%, which made the patient owe more than the bill", () => {
    expect(() => estimate({ ...input, coinsuranceRate: 1.5 }, tchp)).toThrow(InvalidInputError);
  });

  it("rejects negative money", () => {
    expect(() => estimate({ ...input, deductible: -5000 }, tchp)).toThrow(InvalidInputError);
    expect(() => estimate({ ...input, oopMax: -100 }, tchp)).toThrow(InvalidInputError);
    expect(() => estimate({ ...input, income: -1 }, tchp)).toThrow(InvalidInputError);
  });

  it("rejects a household size below 1 or fractional", () => {
    expect(() => estimate({ ...input, householdSize: 0 }, tchp)).toThrow(InvalidInputError);
    expect(() => estimate({ ...input, householdSize: 2.5 }, tchp)).toThrow(InvalidInputError);
  });

  it("rejects a regimen with no cycles instead of crashing on dates[0]", () => {
    expect(() => estimate(input, { ...tchp, cycleCount: 0 })).toThrow(InvalidInputError);
    expect(() => estimate(input, { ...tchp, cycleLengthDays: 0 })).toThrow(InvalidInputError);
  });

  it("never lets the patient pay more than billed at a legal coinsurance rate", () => {
    const r = estimate({ ...input, coinsuranceRate: 1, oopMax: 1e9 }, tchp);
    for (const c of r.cycles) expect(c.patientPays).toBeLessThanOrEqual(c.grossCost);
  });
});

describe("a NaN poverty percentage can never match a fund", () => {
  it("throws rather than returning NaN", () => {
    expect(() => fplPercent(NaN, 4, fpl)).toThrow(InvalidInputError);
    expect(() => fplPercent(85000, 0, fpl)).toThrow(InvalidInputError);
    expect(() => fplPercent(85000, -3, fpl)).toThrow(InvalidInputError);
  });

  it("gates out a non-finite percentage if one ever reaches the predicate", () => {
    const open = programs.find((p) => p.status === "open")!;
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(
        isEligible(open, { fplPercent: bad, diagnosis: "breast-cancer", insuranceType: "commercial" }),
      ).toBe(false);
    }
    expect(
      matchPrograms(programs, {
        fplPercent: NaN,
        diagnosis: "breast-cancer",
        insuranceType: "commercial",
      }),
    ).toEqual([]);
  });
});

describe("the chart axis stays legible at every scale", () => {
  it("never produces repeated dollar labels for a patient who pays nothing", () => {
    const { top, step } = niceScale(0);
    const labels = Array.from({ length: Math.round(top / step) + 1 }, (_, i) =>
      Math.round(i * step),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("keeps the step at a whole dollar or more", () => {
    for (const peak of [0, 0.4, 1, 7, 42, 9000, 15665.22, 1_250_000]) {
      const { top, step } = niceScale(peak);
      expect(step).toBeGreaterThanOrEqual(1);
      expect(top).toBeGreaterThanOrEqual(peak);
      const labels = Array.from({ length: Math.round(top / step) + 1 }, (_, i) =>
        Math.round(i * step),
      );
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
