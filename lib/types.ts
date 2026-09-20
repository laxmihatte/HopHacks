// Shared interfaces. Imports nothing — not React, not Next, not the data files.

export type InsuranceType = "commercial" | "medicare" | "medicaid" | "uninsured";

export interface Drug {
  /** HCPCS J-code. Joins to the CMS Medicare Part B Payment Limit File. */
  hcpcs: string;
  name: string;
  /** Dose administered per cycle, in the same measure as `billingUnit`. */
  dosePerCycle: number;
  /** The quantity the CMS payment limit is quoted per. */
  billingUnit: number;
  /** Payment limit per billing unit, copied from the CMS file at build time. */
  paymentLimit: number;
  /**
   * 1-indexed cycle numbers in which this drug is given. Omit for every cycle.
   *
   * Extension to the schema in the PRD, which assumes one flat drug list per
   * regimen. AC-T is sequential — doxorubicin and cyclophosphamide in cycles
   * 1-4, paclitaxel in cycles 5-8 — so a flat list would bill all three drugs
   * in all eight cycles and overstate gross cost by roughly 2x.
   */
  cycles?: number[];
}

export interface Regimen {
  id: string;
  name: string;
  diagnosis: string;
  cycleCount: number;
  cycleLengthDays: number;
  drugs: Drug[];
  /** Flat infusion-visit figure, added once per cycle. */
  adminCostPerCycle: number;
  sourceNote: string;
  adminSourceNote: string;
}

export interface Program {
  id: string;
  name: string;
  url: string;
  maxFplPercent: number;
  /** Empty array means diagnosis-agnostic. */
  diagnoses: string[];
  insuranceTypes: InsuranceType[];
  /** Annual maximum award, in dollars. */
  awardCap: number;
  status: "open" | "closed";
  /** ISO date. Surfaced in the UI. */
  lastVerified: string;
}

export interface FplTable {
  base: number;
  increment: number;
  year: number;
  region: string;
  effective: string;
  source: string;
}

/** The single object the engine consumes. */
export interface EstimateInput {
  regimenId: string;
  /** ISO yyyy-mm-dd. */
  startDate: string;
  deductible: number;
  /** Fraction, not percent: 0.2 for 20%. */
  coinsuranceRate: number;
  /**
   * The month and day the plan year restarts, as "MM-DD".
   *
   * Almost every tool assumes January 1. That is right for Medicare and for
   * individual marketplace plans, but an employer-sponsored plan follows the
   * employer's benefit year, which is frequently July 1, October 1, or the
   * employer's fiscal year start.
   */
  planYearStart: string;
  oopMax: number;
  householdSize: number;
  income: number;
  insuranceType: InsuranceType;
}

export interface CycleResult {
  /** 1-indexed. */
  index: number;
  /** ISO yyyy-mm-dd. */
  date: string;
  planYear: number;
  /** True when the accumulators were zeroed before this cycle was applied. */
  planYearReset: boolean;
  /** ISO date of the plan-year boundary that caused the reset, else null. */
  resetOn: string | null;
  grossCost: number;
  deductibleApplied: number;
  coinsuranceApplied: number;
  patientPays: number;
  cumulativePatientPays: number;
}

export interface Estimate {
  cycles: CycleResult[];
  totalGross: number;
  totalPatientPays: number;
}

export interface AidResult {
  matched: Program[];
  /** The single largest award cap among matched programs, or 0 if none. */
  bestAwardCap: number;
  fplPercent: number;
  guideline: number;
  /** Cumulative out-of-pocket after aid, index-aligned to `Estimate.cycles`. */
  afterAidCumulative: number[];
  totalAfterAid: number;
}

/**
 * The form's raw, editable state. Numeric fields are strings so a cleared
 * field stays cleared instead of silently becoming zero.
 */
export interface FormState {
  diagnosis: string;
  regimenId: string;
  startDate: string;
  insuranceType: InsuranceType;
  /** Which plan-year profile the user picked; drives guidance, not the maths. */
  coverage: string;
  /** "MM-DD" — the boundary the engine actually uses. */
  planYearStart: string;
  deductible: string;
  coinsurancePercent: string;
  oopMax: string;
  householdSize: string;
  income: string;
}

/** One candidate start date, priced end to end. */
export interface StartDateOption {
  startDate: string;
  totalGross: number;
  totalPatientPays: number;
  totalAfterAid: number;
  /** How many times the deductible is charged over the course. */
  deductiblesCharged: number;
  /** Plan-year boundaries the course of treatment crosses. */
  boundariesCrossed: number;
}

export interface StartDateSweep {
  options: StartDateOption[];
  cheapest: StartDateOption;
  costliest: StartDateOption;
  /** What choosing the cheapest date saves against the costliest. */
  spread: number;
  /** The date the user originally entered, priced the same way. */
  chosen: StartDateOption | null;
  /** What moving from the chosen date to the cheapest one saves. */
  savingsVsChosen: number;
}

/** What a coverage type typically implies about the plan-year boundary. */
export interface PlanYearProfile {
  id: string;
  label: string;
  /** "MM-DD" when the boundary is reliably known, else null. */
  typicalStart: string | null;
  confidence: "regulated" | "common" | "varies";
  note: string;
  whereToCheck: string;
}
