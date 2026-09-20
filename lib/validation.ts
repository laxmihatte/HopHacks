// Input validation shared by the UI and the engine.
// Imports nothing from React. The UI uses this to keep the submit button
// honest; the engine uses it to refuse nonsense rather than compute it.

import type { EstimateInput } from "./types";

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const MAX_HOUSEHOLD = 12;

export type FieldKey =
  | "startDate"
  | "deductible"
  | "coinsurancePercent"
  | "oopMax"
  | "householdSize"
  | "income";

export type FieldErrors = Partial<Record<FieldKey, string>>;

/** A blank or non-numeric field is missing, not zero. */
export function parseField(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * True only for a real calendar date in yyyy-mm-dd form.
 *
 * Both halves matter. `Date.UTC` maps years 0-99 onto 1900-1999, so "0050-01-01"
 * would otherwise become 1950; and it rolls overflow forward, so "2026-13-45"
 * would otherwise become 2027-02-14. Neither should be accepted quietly.
 */
export function isValidIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;

  // Round-trip: the date must survive construction unchanged.
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(0, 0, 0, 0);
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  );
}

export interface RawForm {
  startDate: string;
  deductible: string;
  coinsurancePercent: string;
  oopMax: string;
  householdSize: string;
  income: string;
}

/** Field-level errors for the form. An empty object means the form is valid. */
export function validateForm(form: RawForm): FieldErrors {
  const errors: FieldErrors = {};

  if (!isValidIsoDate(form.startDate)) {
    errors.startDate = `Enter a real date between ${MIN_YEAR} and ${MAX_YEAR}.`;
  }

  const deductible = parseField(form.deductible);
  const coinsurancePercent = parseField(form.coinsurancePercent);
  const oopMax = parseField(form.oopMax);
  const householdSize = parseField(form.householdSize);
  const income = parseField(form.income);

  if (deductible === null) errors.deductible = "Enter a deductible.";
  else if (deductible < 0) errors.deductible = "Deductible cannot be negative.";

  if (coinsurancePercent === null) errors.coinsurancePercent = "Enter a coinsurance rate.";
  else if (coinsurancePercent < 0 || coinsurancePercent > 100) {
    errors.coinsurancePercent = "Coinsurance must be between 0% and 100%.";
  }

  if (oopMax === null) errors.oopMax = "Enter an out-of-pocket maximum.";
  else if (oopMax < 0) errors.oopMax = "Out-of-pocket maximum cannot be negative.";
  else if (deductible !== null && oopMax < deductible) {
    errors.oopMax = "Out-of-pocket maximum cannot be below the deductible.";
  }

  if (householdSize === null) errors.householdSize = "Enter a household size.";
  else if (!Number.isInteger(householdSize)) {
    errors.householdSize = "Household size must be a whole number.";
  } else if (householdSize < 1 || householdSize > MAX_HOUSEHOLD) {
    errors.householdSize = `Household size must be between 1 and ${MAX_HOUSEHOLD}.`;
  }

  if (income === null) errors.income = "Enter an annual household income.";
  else if (income < 0) errors.income = "Income cannot be negative.";

  return errors;
}

/** Thrown by the engine when it is handed input the UI should have rejected. */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

/** Engine-side guard. Defence in depth: the UI should never let these through. */
export function assertValidEstimateInput(input: EstimateInput): void {
  const fail = (m: string) => {
    throw new InvalidInputError(m);
  };
  if (!isValidIsoDate(input.startDate)) fail(`Invalid start date: "${input.startDate}"`);
  if (!Number.isFinite(input.deductible) || input.deductible < 0) {
    fail(`Invalid deductible: ${input.deductible}`);
  }
  if (!Number.isFinite(input.coinsuranceRate) || input.coinsuranceRate < 0 || input.coinsuranceRate > 1) {
    fail(`Invalid coinsurance rate: ${input.coinsuranceRate} (expected 0..1)`);
  }
  if (!Number.isFinite(input.oopMax) || input.oopMax < 0) {
    fail(`Invalid out-of-pocket maximum: ${input.oopMax}`);
  }
  if (!Number.isInteger(input.householdSize) || input.householdSize < 1) {
    fail(`Invalid household size: ${input.householdSize}`);
  }
  if (!Number.isFinite(input.income) || input.income < 0) {
    fail(`Invalid income: ${input.income}`);
  }
}
