// Start-date optimizer.
//
// A deterministic sweep, not a model: it prices every candidate start date in
// the window with the same engine the main estimate uses, and reports the
// cheapest. There is nothing to hallucinate — each point on the curve is a
// full cycle-by-cycle simulation.
//
// Imports nothing from React.

import { cycleDates, estimate, parseIsoUtc, toIsoUtc } from "./calculator";
import type {
  EstimateInput,
  Regimen,
  StartDateOption,
  StartDateSweep,
} from "./types";
import { InvalidInputError, isValidIsoDate } from "./validation";

const MS_PER_DAY = 86_400_000;

/** Cap on candidates, so a mistyped window cannot lock up the browser. */
export const MAX_CANDIDATES = 400;

function priceStartDate(
  input: EstimateInput,
  regimen: Regimen,
  startDate: string,
  awardCap: number,
): StartDateOption {
  const est = estimate({ ...input, startDate }, regimen);

  // Distinct plan years touched; one deductible is charged per plan year in
  // which the patient actually pays something toward it.
  const years = new Set(est.cycles.map((c) => c.planYear));
  const deductiblesCharged = new Set(
    est.cycles.filter((c) => c.deductibleApplied > 0).map((c) => c.planYear),
  ).size;

  return {
    startDate,
    totalGross: est.totalGross,
    totalPatientPays: est.totalPatientPays,
    totalAfterAid: Math.max(0, Math.round((est.totalPatientPays - awardCap) * 100) / 100),
    deductiblesCharged,
    boundariesCrossed: years.size - 1,
  };
}

/**
 * Price every candidate start date between `windowStart` and `windowEnd`.
 *
 * `stepDays` of 1 walks day by day; 7 walks week by week. The window is
 * clamped to MAX_CANDIDATES points.
 */
export function sweepStartDates(
  input: EstimateInput,
  regimen: Regimen,
  windowStart: string,
  windowEnd: string,
  options: { stepDays?: number; awardCap?: number } = {},
): StartDateSweep {
  const stepDays = Math.max(1, Math.floor(options.stepDays ?? 1));
  const awardCap = options.awardCap ?? 0;

  if (!isValidIsoDate(windowStart) || !isValidIsoDate(windowEnd)) {
    throw new InvalidInputError("The start-date window needs two real dates.");
  }
  const from = parseIsoUtc(windowStart);
  const to = parseIsoUtc(windowEnd);
  if (to < from) {
    throw new InvalidInputError("The window's end date is before its start date.");
  }

  const span = Math.floor((to - from) / MS_PER_DAY);
  const count = Math.floor(span / stepDays) + 1;
  if (count > MAX_CANDIDATES) {
    throw new InvalidInputError(
      `That window is ${count} candidate dates; narrow it or widen the step (limit ${MAX_CANDIDATES}).`,
    );
  }

  const results: StartDateOption[] = [];
  for (let i = 0; i < count; i++) {
    results.push(
      priceStartDate(input, regimen, toIsoUtc(from + i * stepDays * MS_PER_DAY), awardCap),
    );
  }

  // Ties go to the earliest date: delaying treatment has a clinical cost this
  // tool does not model, so it must never recommend a later date for free.
  let cheapest = results[0];
  let costliest = results[0];
  for (const r of results) {
    if (r.totalPatientPays < cheapest.totalPatientPays) cheapest = r;
    if (r.totalPatientPays > costliest.totalPatientPays) costliest = r;
  }

  const chosen =
    results.find((r) => r.startDate === input.startDate) ??
    (isValidIsoDate(input.startDate)
      ? priceStartDate(input, regimen, input.startDate, awardCap)
      : null);

  return {
    options: results,
    cheapest,
    costliest,
    spread: Math.round((costliest.totalPatientPays - cheapest.totalPatientPays) * 100) / 100,
    chosen,
    savingsVsChosen: chosen
      ? Math.round((chosen.totalPatientPays - cheapest.totalPatientPays) * 100) / 100
      : 0,
  };
}

/**
 * A sensible default window around a chosen start date: four weeks earlier
 * through twelve weeks later, which is wide enough to straddle a plan-year
 * boundary from either side.
 */
export function defaultWindow(startDate: string): { from: string; to: string } {
  const t = parseIsoUtc(startDate);
  return {
    from: toIsoUtc(t - 28 * MS_PER_DAY),
    to: toIsoUtc(t + 84 * MS_PER_DAY),
  };
}

/** The last cycle date for a regimen started on `startDate`. */
export function lastCycleDate(regimen: Regimen, startDate: string): string {
  const dates = cycleDates(startDate, regimen.cycleCount, regimen.cycleLengthDays);
  return dates[dates.length - 1];
}
