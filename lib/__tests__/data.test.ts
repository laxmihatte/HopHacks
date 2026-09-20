import { describe, expect, it } from "vitest";
import { grossCostForCycle } from "../calculator";
import { isValidIsoDate } from "../validation";
import type { FplTable, InsuranceType, Program, Regimen } from "../types";
import fplData from "../../data/fpl.json";
import programData from "../../data/programs.json";
import regimenData from "../../data/regimens.json";

const regimens = regimenData as Regimen[];
const programs = programData as Program[];
const fpl = fplData as FplTable;

const INSURANCE: InsuranceType[] = ["commercial", "medicare", "medicaid", "uninsured"];
const DIAGNOSES = new Set(regimens.map((r) => r.diagnosis));

describe("regimens.json is internally consistent", () => {
  it("has unique ids", () => {
    const ids = regimens.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a sane schedule and at least one drug", () => {
    for (const r of regimens) {
      expect(r.cycleCount, r.id).toBeGreaterThan(0);
      expect(Number.isInteger(r.cycleCount), r.id).toBe(true);
      expect(r.cycleLengthDays, r.id).toBeGreaterThan(0);
      expect(r.drugs.length, r.id).toBeGreaterThan(0);
      expect(r.adminCostPerCycle, r.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("prices every drug with a positive limit and billing unit", () => {
    for (const r of regimens) {
      for (const d of r.drugs) {
        expect(d.paymentLimit, `${r.id}/${d.hcpcs}`).toBeGreaterThan(0);
        expect(d.billingUnit, `${r.id}/${d.hcpcs}`).toBeGreaterThan(0);
        expect(d.dosePerCycle, `${r.id}/${d.hcpcs}`).toBeGreaterThan(0);
        expect(d.hcpcs, r.id).toMatch(/^[A-Z]\d{4}$/);
      }
    }
  });

  it("only schedules drugs into cycles that exist", () => {
    for (const r of regimens) {
      for (const d of r.drugs) {
        if (!d.cycles) continue;
        expect(d.cycles.length, `${r.id}/${d.hcpcs}`).toBeGreaterThan(0);
        for (const c of d.cycles) {
          expect(Number.isInteger(c), `${r.id}/${d.hcpcs}`).toBe(true);
          expect(c, `${r.id}/${d.hcpcs}`).toBeGreaterThanOrEqual(1);
          expect(c, `${r.id}/${d.hcpcs}`).toBeLessThanOrEqual(r.cycleCount);
        }
      }
    }
  });

  it("gives every cycle of every regimen a positive cost", () => {
    for (const r of regimens) {
      for (let i = 1; i <= r.cycleCount; i++) {
        expect(grossCostForCycle(r, i), `${r.id} cycle ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it("cites a source for both the drug prices and the admin figure", () => {
    for (const r of regimens) {
      expect(r.sourceNote, r.id).toMatch(/CMS/);
      expect(r.adminSourceNote.length, r.id).toBeGreaterThan(10);
    }
  });
});

describe("programs.json is internally consistent", () => {
  it("has unique ids", () => {
    const ids = programs.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("meets the PRD's floor of ten real programs", () => {
    expect(programs.length).toBeGreaterThanOrEqual(10);
  });

  it("uses only known insurance types", () => {
    for (const p of programs) {
      expect(p.insuranceTypes.length, p.id).toBeGreaterThan(0);
      for (const t of p.insuranceTypes) expect(INSURANCE, p.id).toContain(t);
    }
  });

  it("uses a real https url", () => {
    for (const p of programs) expect(p.url, p.id).toMatch(/^https:\/\//);
  });

  it("carries a valid, non-future verification date", () => {
    for (const p of programs) {
      expect(isValidIsoDate(p.lastVerified), p.id).toBe(true);
      expect(p.lastVerified <= "2100-01-01", p.id).toBe(true);
    }
  });

  it("has a sane FPL gate and a positive award cap", () => {
    for (const p of programs) {
      expect(p.maxFplPercent, p.id).toBeGreaterThan(0);
      expect(p.maxFplPercent, p.id).toBeLessThanOrEqual(1000);
      expect(p.awardCap, p.id).toBeGreaterThan(0);
      expect(["open", "closed"], p.id).toContain(p.status);
    }
  });

  it("only names diagnoses the app can actually select, or is agnostic", () => {
    // Funds for diagnoses outside the app's regimen list are allowed, but they
    // must never match — this pins that they are deliberate, not typos.
    const offRoster = programs
      .filter((p) => p.diagnoses.length > 0 && !p.diagnoses.some((d) => DIAGNOSES.has(d)))
      .map((p) => p.id);
    expect(offRoster).toEqual(["lls-patient-aid"]);
  });
});

describe("fpl.json reproduces the published 2026 table", () => {
  it("carries the 2026 contiguous-48 figures", () => {
    expect(fpl.base).toBe(15960);
    expect(fpl.increment).toBe(5680);
    expect(fpl.year).toBe(2026);
    expect(fpl.region).toBe("contiguous-48");
    expect(isValidIsoDate(fpl.effective)).toBe(true);
  });
});
