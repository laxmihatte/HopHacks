"use client";

import PlanYearField from "./PlanYearField";
import type { FormState, InsuranceType, Regimen } from "@/lib/types";
import { MAX_HOUSEHOLD, MAX_YEAR, MIN_YEAR, type FieldErrors } from "@/lib/validation";

export type { FormState };

const DIAGNOSIS_LABELS: Record<string, string> = {
  "breast-cancer": "Breast cancer",
  "colorectal-cancer": "Colorectal cancer",
};

const INSURANCE_TYPES: { value: InsuranceType; label: string }[] = [
  { value: "commercial", label: "Commercial" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "uninsured", label: "Uninsured" },
];

const field =
  "mt-2 w-full border-0 border-b border-[var(--rule-strong)] bg-transparent py-1.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-3)]";

function Err({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1.5 block text-[12px] text-[var(--series-2)]">
      {message}
    </span>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rule pt-6">
      <h2 className="display mb-5 flex items-baseline gap-3 text-[19px] font-semibold">
        <span className="tnum text-[13px] font-normal text-[var(--ink-3)]">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function InputForm({
  value,
  onChange,
  onSubmit,
  onReset,
  canReset,
  regimens,
  errors,
}: {
  value: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  onReset: () => void;
  canReset: boolean;
  regimens: Regimen[];
  errors: FieldErrors;
}) {
  const blocked = Object.keys(errors).length > 0;
  const set = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    onChange({ ...value, [key]: v });

  const diagnoses = [...new Set(regimens.map((r) => r.diagnosis))];
  const available = regimens.filter((r) => r.diagnosis === value.diagnosis);

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) onSubmit();
      }}
    >
      <Section n="01" title="Treatment">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="eyebrow">Diagnosis</span>
            <select
              className={field}
              value={value.diagnosis}
              onChange={(e) => {
                const diagnosis = e.target.value;
                const current = regimens.find((r) => r.id === value.regimenId);
                const regimenId =
                  current?.diagnosis === diagnosis
                    ? value.regimenId
                    : (regimens.find((r) => r.diagnosis === diagnosis)?.id ?? "");
                onChange({ ...value, diagnosis, regimenId });
              }}
            >
              {diagnoses.map((d) => (
                <option key={d} value={d}>
                  {DIAGNOSIS_LABELS[d] ?? d}
                </option>
              ))}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="eyebrow">Regimen</span>
            <select
              className={field}
              value={value.regimenId}
              onChange={(e) => set("regimenId", e.target.value)}
            >
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.cycleCount} cycles, every {r.cycleLengthDays} days
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow">Treatment starts</span>
            <input
              type="date"
              min={`${MIN_YEAR}-01-01`}
              max={`${MAX_YEAR}-12-31`}
              aria-invalid={errors.startDate ? true : undefined}
              className={`${field} tnum`}
              value={value.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <Err message={errors.startDate} />
          </label>
        </div>
      </Section>

      <Section n="02" title="Insurance">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="eyebrow">Coverage type</span>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
              {INSURANCE_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5 text-[14px]">
                  <input
                    type="radio"
                    name="insuranceType"
                    value={t.value}
                    checked={value.insuranceType === t.value}
                    onChange={() => set("insuranceType", t.value)}
                    className="accent-[var(--accent)]"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="eyebrow">Deductible</span>
            <input
              type="number" min={0} step="any" inputMode="decimal"
              aria-invalid={errors.deductible ? true : undefined}
              className={`${field} tnum`}
              value={value.deductible}
              onChange={(e) => set("deductible", e.target.value)}
            />
            <Err message={errors.deductible} />
          </label>

          <label className="block">
            <span className="eyebrow">Coinsurance %</span>
            <input
              type="number" min={0} max={100} step="any" inputMode="decimal"
              aria-invalid={errors.coinsurancePercent ? true : undefined}
              className={`${field} tnum`}
              value={value.coinsurancePercent}
              onChange={(e) => set("coinsurancePercent", e.target.value)}
            />
            <Err message={errors.coinsurancePercent} />
          </label>

          <label className="block">
            <span className="eyebrow">Out-of-pocket max</span>
            <input
              type="number" min={0} step="any" inputMode="decimal"
              aria-invalid={errors.oopMax ? true : undefined}
              className={`${field} tnum`}
              value={value.oopMax}
              onChange={(e) => set("oopMax", e.target.value)}
            />
            <Err message={errors.oopMax} />
          </label>
        </div>

        <div className="mt-7 border-l-2 border-[var(--rule-strong)] pl-5">
          <PlanYearField
            coverage={value.coverage}
            planYearStart={value.planYearStart}
            error={errors.planYearStart}
            onChange={(next) => onChange({ ...value, ...next })}
          />
        </div>
      </Section>

      <Section n="03" title="Household">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="eyebrow">People in household</span>
            <input
              type="number" min={1} max={MAX_HOUSEHOLD} step={1} inputMode="numeric"
              aria-invalid={errors.householdSize ? true : undefined}
              className={`${field} tnum`}
              value={value.householdSize}
              onChange={(e) => set("householdSize", e.target.value)}
            />
            <Err message={errors.householdSize} />
          </label>

          <label className="block">
            <span className="eyebrow">Annual household income</span>
            <input
              type="number" min={0} step="any" inputMode="decimal"
              aria-invalid={errors.income ? true : undefined}
              className={`${field} tnum`}
              value={value.income}
              onChange={(e) => set("income", e.target.value)}
            />
            <Err message={errors.income} />
          </label>
        </div>
      </Section>

      <div className="rule flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
        <button
          type="submit"
          disabled={blocked}
          className="bg-[var(--accent)] px-6 py-2.5 text-[14px] font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Estimate my cost
        </button>
        <button
          type="reset"
          disabled={!canReset}
          onClick={onReset}
          className="text-[14px] font-medium text-[var(--ink-2)] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
        >
          Reset
        </button>
        <span className="text-[13px] text-[var(--ink-3)]">
          {blocked
            ? "Fix the highlighted fields to continue."
            : "Nothing you type leaves your browser."}
        </span>
      </div>
    </form>
  );
}
