import { describe, expect, it } from "vitest";
import { decodeForm, encodeForm } from "../url";
import type { FormState, Regimen } from "../types";
import regimenData from "../../data/regimens.json";

const regimens = regimenData as Regimen[];
const known = (id: string, dx: string) =>
  regimens.some((r) => r.id === id && r.diagnosis === dx);

const form: FormState = {
  diagnosis: "breast-cancer",
  regimenId: "tchp",
  startDate: "2026-10-15",
  insuranceType: "commercial",
  coverage: "employer-calendar",
  planYearStart: "01-01",
  deductible: "3000",
  coinsurancePercent: "20",
  oopMax: "9000",
  householdSize: "4",
  income: "85000",
};

describe("form state round-trips through the URL", () => {
  it("decodes exactly what it encoded", () => {
    expect(decodeForm(encodeForm(form), known)).toEqual(form);
  });

  it("survives non-round values", () => {
    const odd = { ...form, deductible: "1750", coinsurancePercent: "17.5", income: "85500" };
    expect(decodeForm(encodeForm(odd), known)).toEqual(odd);
  });

  it("returns null for an empty query string", () => {
    expect(decodeForm("", known)).toBeNull();
  });

  it("returns null when a field is missing", () => {
    const partial = new URLSearchParams(encodeForm(form));
    partial.delete("inc");
    expect(decodeForm(partial.toString(), known)).toBeNull();
  });

  it("refuses a hand-edited link that would fail form validation", () => {
    for (const [key, bad] of [
      ["coins", "150"],
      ["ded", "-5000"],
      ["hh", "0"],
      ["start", "0050-01-01"],
      ["oop", "10"], // below the deductible
    ] as const) {
      const p = new URLSearchParams(encodeForm(form));
      p.set(key, bad);
      expect(decodeForm(p.toString(), known), `${key}=${bad}`).toBeNull();
    }
  });

  it("refuses an unknown regimen or a regimen/diagnosis mismatch", () => {
    const p = new URLSearchParams(encodeForm(form));
    p.set("reg", "not-a-regimen");
    expect(decodeForm(p.toString(), known)).toBeNull();

    const q = new URLSearchParams(encodeForm(form));
    q.set("dx", "colorectal-cancer"); // tchp is a breast-cancer regimen
    expect(decodeForm(q.toString(), known)).toBeNull();
  });

  it("refuses an unknown insurance type", () => {
    const p = new URLSearchParams(encodeForm(form));
    p.set("ins", "platinum");
    expect(decodeForm(p.toString(), known)).toBeNull();
  });
});
