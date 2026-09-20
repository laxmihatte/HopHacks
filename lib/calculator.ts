// Cost engine. Pure functions over a cycle list.
// Imports nothing from React. Dates are handled in UTC so a browser timezone
// can never shift a cycle across the plan-year boundary.

import type { CycleResult, Estimate, EstimateInput, Regimen } from "./types";
import { InvalidInputError, assertValidEstimateInput, isValidIsoDate } from "./validation";

const MS_PER_DAY = 86_400_000;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Parse yyyy-mm-dd as a UTC midnight timestamp.
 *
 * `Date.UTC` is not used directly: it maps years 0-99 onto 1900-1999 (so
 * "0050-01-01" would become 1950) and rolls overflow forward (so "2026-13-45"
 * would become 2027-02-14). Both are rejected instead.
 */
export function parseIsoUtc(iso: string): number {
  if (!isValidIsoDate(iso)) {
    throw new InvalidInputError(`Expected a real yyyy-mm-dd date, got "${iso}"`);
  }
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.getTime();
}

export function toIsoUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Cycle dates are derived, never stored: cycle i falls on
 * startDate + (i - 1) x cycleLengthDays.
 */
export function cycleDates(
  startDate: string,
  cycleCount: number,
  cycleLengthDays: number,
): string[] {
  const start = parseIsoUtc(startDate);
  return Array.from({ length: cycleCount }, (_, i) =>
    toIsoUtc(start + i * cycleLengthDays * MS_PER_DAY),
  );
}

/**
 * Gross billed cost for one cycle: for each drug given that cycle, the dose
 * converted into whole billing units times the CMS payment limit, plus the
 * flat administration figure.
 *
 * The ceiling is load-bearing — drugs bill in whole units, so a partial unit
 * rounds up. `cycleIndex` is 1-based.
 */
export function grossCostForCycle(regimen: Regimen, cycleIndex: number): number {
  let total = regimen.adminCostPerCycle;
  for (const drug of regimen.drugs) {
    if (drug.cycles && !drug.cycles.includes(cycleIndex)) continue;
    const units = Math.ceil(drug.dosePerCycle / drug.billingUnit);
    total += units * drug.paymentLimit;
  }
  return round2(total);
}

/** The plan year a date falls in. The plan year is assumed to start January 1. */
export function planYearOf(iso: string): number {
  return new Date(parseIsoUtc(iso)).getUTCFullYear();
}

/**
 * Walk the cycles in order, applying deductible, then coinsurance, then the
 * out-of-pocket cap — and zeroing both accumulators at each plan-year boundary.
 */
export function estimate(input: EstimateInput, regimen: Regimen): Estimate {
  assertValidEstimateInput(input);
  if (!Number.isInteger(regimen.cycleCount) || regimen.cycleCount < 1) {
    throw new InvalidInputError(`Regimen "${regimen.id}" has no cycles`);
  }
  if (!Number.isInteger(regimen.cycleLengthDays) || regimen.cycleLengthDays < 1) {
    throw new InvalidInputError(`Regimen "${regimen.id}" has an invalid cycle length`);
  }

  const dates = cycleDates(input.startDate, regimen.cycleCount, regimen.cycleLengthDays);

  let deductibleRemaining = input.deductible;
  let accrued = 0;
  let previousPlanYear = planYearOf(dates[0]);

  let totalGross = 0;
  const cycles: CycleResult[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const planYear = planYearOf(date);

    // Plan-year reset. Four lines, inside the same loop as everything else.
    const planYearReset = planYear > previousPlanYear;
    if (planYearReset) {
      deductibleRemaining = input.deductible;
      accrued = 0;
    }
    previousPlanYear = planYear;

    const grossCost = grossCostForCycle(regimen, i + 1);

    // Strict order: deductible, then coinsurance on what remains, then the cap.
    const deductiblePortion = Math.min(deductibleRemaining, grossCost);
    const coinsurancePortion = input.coinsuranceRate * (grossCost - deductiblePortion);
    const uncapped = deductiblePortion + coinsurancePortion;

    const roomLeft = Math.max(0, input.oopMax - accrued);
    const patientPays = round2(Math.min(uncapped, roomLeft));

    // Attribute what was actually paid, deductible first, so the cycle table's
    // columns always sum to `patientPays` even when the cap binds.
    const deductibleApplied = round2(Math.min(deductiblePortion, patientPays));
    const coinsuranceApplied = round2(patientPays - deductibleApplied);

    deductibleRemaining = round2(Math.max(0, deductibleRemaining - deductibleApplied));
    accrued = round2(accrued + patientPays);
    totalGross = round2(totalGross + grossCost);

    cycles.push({
      index: i + 1,
      date,
      planYear,
      planYearReset,
      grossCost,
      deductibleApplied,
      coinsuranceApplied,
      patientPays,
      cumulativePatientPays: round2(
        (cycles[i - 1]?.cumulativePatientPays ?? 0) + patientPays,
      ),
    });
  }

  return {
    cycles,
    totalGross,
    totalPatientPays: cycles.at(-1)?.cumulativePatientPays ?? 0,
  };
}
