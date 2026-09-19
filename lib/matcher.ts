// Aid matching. A predicate filter over a curated array, plus the FPL math.
// Imports nothing from React.

import type { AidResult, Estimate, FplTable, InsuranceType, Program } from "./types";

/**
 * The poverty guideline for a household of n in the 48 contiguous states.
 * Linear form; reproduces the published table exactly for n = 1..8 and is the
 * documented rule beyond 8.
 */
export function guideline(householdSize: number, fpl: FplTable): number {
  return fpl.base + fpl.increment * (householdSize - 1);
}

export function fplPercent(
  income: number,
  householdSize: number,
  fpl: FplTable,
): number {
  return (income / guideline(householdSize, fpl)) * 100;
}

/** A program matches when all four conditions hold. */
export function isEligible(
  program: Program,
  opts: { fplPercent: number; diagnosis: string; insuranceType: InsuranceType },
): boolean {
  if (opts.fplPercent > program.maxFplPercent) return false;
  if (program.diagnoses.length > 0 && !program.diagnoses.includes(opts.diagnosis)) {
    return false;
  }
  if (!program.insuranceTypes.includes(opts.insuranceType)) return false;
  return program.status === "open";
}

/** Matched programs, ranked by award cap descending. */
export function matchPrograms(
  programs: Program[],
  opts: { fplPercent: number; diagnosis: string; insuranceType: InsuranceType },
): Program[] {
  return programs
    .filter((p) => isEligible(p, opts))
    .sort((a, b) => b.awardCap - a.awardCap);
}

/**
 * Apply the single highest award cap as a ceiling against cumulative
 * out-of-pocket. Caps are deliberately NOT summed: programs frequently cannot
 * be stacked, and a summed figure would overstate relief — the one direction
 * this tool must never err in.
 */
export function applyAid(estimateResult: Estimate, bestAwardCap: number): number[] {
  return estimateResult.cycles.map((c) =>
    Math.max(0, Math.round((c.cumulativePatientPays - bestAwardCap) * 100) / 100),
  );
}

export function navigateAid(
  estimateResult: Estimate,
  programs: Program[],
  fpl: FplTable,
  opts: {
    income: number;
    householdSize: number;
    diagnosis: string;
    insuranceType: InsuranceType;
  },
): AidResult {
  const pct = fplPercent(opts.income, opts.householdSize, fpl);
  const matched = matchPrograms(programs, {
    fplPercent: pct,
    diagnosis: opts.diagnosis,
    insuranceType: opts.insuranceType,
  });
  const bestAwardCap = matched.length > 0 ? matched[0].awardCap : 0;
  const afterAidCumulative = applyAid(estimateResult, bestAwardCap);

  return {
    matched,
    bestAwardCap,
    fplPercent: pct,
    guideline: guideline(opts.householdSize, fpl),
    afterAidCumulative,
    totalAfterAid: afterAidCumulative.at(-1) ?? 0,
  };
}
