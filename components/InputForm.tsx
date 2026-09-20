"use client";

import type { FormState, InsuranceType, Regimen } from "@/lib/types";
import { MAX_HOUSEHOLD, MAX_YEAR, MIN_YEAR, type FieldErrors } from "@/lib/validation";


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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1.5 block text-[11px] text-[var(--series-2)]">
      {message}
    </span>
  );
}

const labelCls = "block text-xs font-medium text-[var(--text-secondary)]";
const fieldCls =
  "mt-1.5 w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface-1)] px-3 py-2 text-[14px] text-[var(--text-primary)] focus-visible:border-[var(--series-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)]";

export type { FormState };

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
      className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) onSubmit();
      }}
    >
      <fieldset className="border-0 p-0">
        <legend className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">
          Treatment
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={labelCls}>Diagnosis</span>
            <select
              className={fieldCls}
              value={value.diagnosis}
              onChange={(e) => {
                const diagnosis = e.target.value;
                // Only re-point the regimen when the current one no longer
                // belongs to the chosen diagnosis. Re-picking the same
                // diagnosis must leave the regimen untouched.
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

          <label className="lg:col-span-2">
            <span className={labelCls}>Regimen</span>
            <select
              className={fieldCls}
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

          <label>
            <span className={labelCls}>Treatment start date</span>
            <input
              type="date"
              min={`${MIN_YEAR}-01-01`}
              max={`${MAX_YEAR}-12-31`}
              aria-invalid={errors.startDate ? true : undefined}
              className={`${fieldCls} ${errors.startDate ? "border-[var(--series-2)]" : ""}`}
              value={value.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <FieldError message={errors.startDate} />
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">
          Insurance
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className={labelCls}>Insurance type</span>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {INSURANCE_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="radio"
                    name="insuranceType"
                    value={t.value}
                    checked={value.insuranceType === t.value}
                    onChange={() => set("insuranceType", t.value)}
                    className="accent-[var(--series-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)]"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <label>
            <span className={labelCls}>Deductible</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              aria-invalid={errors.deductible ? true : undefined}
              className={`${fieldCls} tnum ${errors.deductible ? "border-[var(--series-2)]" : ""}`}
              value={value.deductible}
              onChange={(e) => set("deductible", e.target.value)}
            />
            <FieldError message={errors.deductible} />
          </label>

          <label>
            <span className={labelCls}>Coinsurance (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              inputMode="decimal"
              aria-invalid={errors.coinsurancePercent ? true : undefined}
              className={`${fieldCls} tnum ${errors.coinsurancePercent ? "border-[var(--series-2)]" : ""}`}
              value={value.coinsurancePercent}
              onChange={(e) => set("coinsurancePercent", e.target.value)}
            />
            <FieldError message={errors.coinsurancePercent} />
          </label>

          <label>
            <span className={labelCls}>Out-of-pocket maximum</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              aria-invalid={errors.oopMax ? true : undefined}
              className={`${fieldCls} tnum ${errors.oopMax ? "border-[var(--series-2)]" : ""}`}
              value={value.oopMax}
              onChange={(e) => set("oopMax", e.target.value)}
            />
            <FieldError message={errors.oopMax} />
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">
          Household
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={labelCls}>Household size</span>
            <input
              type="number"
              min={1}
              max={MAX_HOUSEHOLD}
              step={1}
              inputMode="numeric"
              aria-invalid={errors.householdSize ? true : undefined}
              className={`${fieldCls} tnum ${errors.householdSize ? "border-[var(--series-2)]" : ""}`}
              value={value.householdSize}
              onChange={(e) => set("householdSize", e.target.value)}
            />
            <FieldError message={errors.householdSize} />
          </label>

          <label>
            <span className={labelCls}>Annual household income</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              aria-invalid={errors.income ? true : undefined}
              className={`${fieldCls} tnum ${errors.income ? "border-[var(--series-2)]" : ""}`}
              value={value.income}
              onChange={(e) => set("income", e.target.value)}
            />
            <FieldError message={errors.income} />
          </label>
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="submit"
          disabled={blocked}
          className="rounded-lg bg-[var(--series-1)] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)]"
        >
          Estimate my cost
        </button>
        <button
          type="reset"
          disabled={!canReset}
          onClick={onReset}
          title="Put every field back to its starting value"
          className="rounded-lg border border-[var(--border-2)] px-4 py-2.5 text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)]"
        >
          Reset
        </button>
        <span className="ml-1 text-xs text-[var(--text-muted)]">
          {blocked
            ? "Fix the highlighted fields to continue."
            : canReset
              ? "Reset puts every field back to its starting value."
              : "Nothing you type leaves your browser."}
        </span>
      </div>
    </form>
  );
}
