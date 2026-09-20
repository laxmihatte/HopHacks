// The form's state encoded into the query string, so that Back, Forward,
// Reload and a pasted link all behave the way a browser user expects.
// Imports nothing from React.

import type { FormState, InsuranceType } from "./types";
import { validateForm } from "./validation";

const INSURANCE_TYPES: InsuranceType[] = [
  "commercial",
  "medicare",
  "medicaid",
  "uninsured",
];

/** Short keys — the URL is meant to be pasted into a message. */
const KEYS = {
  diagnosis: "dx",
  regimenId: "reg",
  startDate: "start",
  insuranceType: "ins",
  coverage: "cov",
  planYearStart: "py",
  deductible: "ded",
  coinsurancePercent: "coins",
  oopMax: "oop",
  householdSize: "hh",
  income: "inc",
} as const satisfies Record<keyof FormState, string>;

export function encodeForm(form: FormState): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS)) {
    params.set(key, form[field as keyof FormState]);
  }
  return params.toString();
}

/**
 * Rebuild a form from a query string. Returns null unless every field is
 * present and the result passes the same validation the form applies, so a
 * hand-edited or truncated link can never render a bogus estimate.
 */
export function decodeForm(
  search: string,
  isKnownRegimen: (id: string, diagnosis: string) => boolean,
): FormState | null {
  const params = new URLSearchParams(search);
  const get = (key: string) => params.get(key);

  const values = Object.fromEntries(
    Object.entries(KEYS).map(([field, key]) => [field, get(key)]),
  ) as Record<keyof FormState, string | null>;

  if (Object.values(values).some((v) => v === null)) return null;

  const form = values as unknown as FormState;

  if (!INSURANCE_TYPES.includes(form.insuranceType)) return null;
  if (!isKnownRegimen(form.regimenId, form.diagnosis)) return null;
  if (Object.keys(validateForm(form)).length > 0) return null;

  return form;
}
