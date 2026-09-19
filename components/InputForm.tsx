"use client";

import type { InsuranceType, Regimen } from "@/lib/types";

export interface FormState {
  diagnosis: string;
  regimenId: string;
  startDate: string;
  insuranceType: InsuranceType;
  deductible: number;
  coinsurancePercent: number;
  oopMax: number;
  householdSize: number;
  income: number;
}

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

const labelCls = "block text-xs font-medium text-[var(--text-secondary)]";
const fieldCls =
  "mt-1.5 w-full rounded-lg border border-[var(--border-2)] bg-[var(--surface-1)] px-3 py-2 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--series-1)] focus:ring-2 focus:ring-[var(--series-1)]/25";

export default function InputForm({
  value,
  onChange,
  onSubmit,
  regimens,
  oopError,
}: {
  value: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  regimens: Regimen[];
  oopError: string | null;
}) {
  const set = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    onChange({ ...value, [key]: v });

  const diagnoses = [...new Set(regimens.map((r) => r.diagnosis))];
  const available = regimens.filter((r) => r.diagnosis === value.diagnosis);

  return (
    <form
      className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!oopError) onSubmit();
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
                const first = regimens.find((r) => r.diagnosis === diagnosis);
                onChange({ ...value, diagnosis, regimenId: first?.id ?? "" });
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
              className={fieldCls}
              value={value.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              required
            />
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
                    className="accent-[var(--series-1)]"
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
              step={100}
              className={`${fieldCls} tnum`}
              value={value.deductible}
              onChange={(e) => set("deductible", Number(e.target.value))}
            />
          </label>

          <label>
            <span className={labelCls}>Coinsurance (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className={`${fieldCls} tnum`}
              value={value.coinsurancePercent}
              onChange={(e) => set("coinsurancePercent", Number(e.target.value))}
            />
          </label>

          <label>
            <span className={labelCls}>Out-of-pocket maximum</span>
            <input
              type="number"
              min={0}
              step={100}
              aria-invalid={oopError ? true : undefined}
              className={`${fieldCls} tnum ${oopError ? "border-[var(--series-2)]" : ""}`}
              value={value.oopMax}
              onChange={(e) => set("oopMax", Number(e.target.value))}
            />
            {oopError && (
              <span className="mt-1.5 block text-[11px] text-[var(--series-2)]">{oopError}</span>
            )}
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
              max={12}
              step={1}
              className={`${fieldCls} tnum`}
              value={value.householdSize}
              onChange={(e) => set("householdSize", Number(e.target.value))}
            />
          </label>

          <label>
            <span className={labelCls}>Annual household income</span>
            <input
              type="number"
              min={0}
              step={1000}
              className={`${fieldCls} tnum`}
              value={value.income}
              onChange={(e) => set("income", Number(e.target.value))}
            />
          </label>
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={!!oopError}
          className="rounded-lg bg-[var(--series-1)] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Estimate my cost
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          Nothing you type leaves your browser.
        </span>
      </div>
    </form>
  );
}
