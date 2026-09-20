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
  "mt-2 w-full rounded-[var(--radius-field)] border border-[var(--rule-strong)] bg-[var(--card)] px-3.5 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-3)]";

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
  eyebrow,
  title,
  last,
  children,
}: {
  n: number;
  eyebrow: string;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative pl-0 sm:pl-16">
      {/* Step rail — circled number with a connector running to the next step. */}
      <div className="absolute left-0 top-0 hidden h-full w-12 sm:block" aria-hidden="true">
        <span className="tnum flex h-10 w-10 items-center justify-center rounded-full border border-[var(--rule-strong)] bg-[var(--card)] text-[14px] font-medium text-[var(--ink-2)]">
          {n}
        </span>
        {!last && (
          <span className="absolute left-5 top-11 block w-px bg-[var(--rule)]" style={{ height: "calc(100% - 2.75rem)" }} />
        )}
      </div>

      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-1.5 mb-6 text-[26px] sm:text-[30px]">{title}</h2>
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
      className="space-y-12"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) onSubmit();
      }}
    >
      <Section n={1} eyebrow="Your treatment" title="What you are being treated for">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="eyebrow">Diagnosis</span>
            <select
              aria-label="Diagnosis"
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
              aria-label="Regimen"
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
              aria-label="Treatment starts"
              value={value.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <Err message={errors.startDate} />
          </label>
        </div>
      </Section>

      <Section n={2} eyebrow="Your plan" title="What your insurance charges you">
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
              aria-label="Deductible"
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
              aria-label="Coinsurance percent"
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
              aria-label="Out-of-pocket max"
              value={value.oopMax}
              onChange={(e) => set("oopMax", e.target.value)}
            />
            <Err message={errors.oopMax} />
          </label>
        </div>

        <div className="mt-7 rounded-[18px] border border-[var(--rule)] bg-[var(--sunk)] p-5">
          <PlanYearField
            coverage={value.coverage}
            planYearStart={value.planYearStart}
            error={errors.planYearStart}
            onChange={(next) => onChange({ ...value, ...next })}
          />
        </div>
      </Section>

      <Section n={3} eyebrow="Your household" title="Who the cost has to support" last>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="eyebrow">People in household</span>
            <input
              type="number" min={1} max={MAX_HOUSEHOLD} step={1} inputMode="numeric"
              aria-invalid={errors.householdSize ? true : undefined}
              className={`${field} tnum`}
              aria-label="People in household"
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
              aria-label="Annual household income"
              value={value.income}
              onChange={(e) => set("income", e.target.value)}
            />
            <Err message={errors.income} />
          </label>
        </div>
      </Section>

      <div className="rule flex flex-wrap items-center gap-x-4 gap-y-3 pt-7 sm:pl-16">
        <button
          type="submit"
          disabled={blocked}
          className="rounded-full bg-[var(--accent)] px-6 py-3 text-[14px] font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Estimate my cost
        </button>
        <button
          type="reset"
          disabled={!canReset}
          onClick={onReset}
          className="rounded-full border border-[var(--rule-strong)] px-5 py-3 text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--sunk)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
        <span className="ml-1 text-[13px] text-[var(--ink-3)]">
          {blocked
            ? "Fix the highlighted fields to continue."
            : "Nothing you type leaves your browser."}
        </span>
      </div>
    </form>
  );
}
