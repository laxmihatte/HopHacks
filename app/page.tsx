"use client";

import { useMemo, useState } from "react";
import AssumptionsBlock from "@/components/AssumptionsBlock";
import CostChart from "@/components/CostChart";
import CycleTable from "@/components/CycleTable";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import InputForm, { type FormState } from "@/components/InputForm";
import ProgramList from "@/components/ProgramList";
import { estimate as runEstimate } from "@/lib/calculator";
import { navigateAid } from "@/lib/matcher";
import type { FplTable, Program, Regimen } from "@/lib/types";
import fplData from "@/data/fpl.json";
import programData from "@/data/programs.json";
import regimenData from "@/data/regimens.json";

const REGIMENS = regimenData as Regimen[];
const PROGRAMS = programData as Program[];
const FPL = fplData as FplTable;

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Pre-filled with the demo input, so the page is never an empty form. */
const DEFAULTS: FormState = {
  diagnosis: "breast-cancer",
  regimenId: "tchp",
  startDate: "2026-10-15",
  insuranceType: "commercial",
  deductible: 3000,
  coinsurancePercent: 20,
  oopMax: 9000,
  householdSize: 4,
  income: 85000,
};

export default function Page() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitted, setSubmitted] = useState<FormState | null>(null);

  // The one validation rule that carries real meaning: an out-of-pocket
  // maximum below the deductible is incoherent.
  const oopError =
    form.oopMax < form.deductible
      ? "Out-of-pocket maximum cannot be below the deductible."
      : null;

  const result = useMemo(() => {
    if (!submitted) return null;
    const regimen = REGIMENS.find((r) => r.id === submitted.regimenId);
    if (!regimen) return null;

    const est = runEstimate(
      {
        regimenId: submitted.regimenId,
        startDate: submitted.startDate,
        deductible: submitted.deductible,
        coinsuranceRate: submitted.coinsurancePercent / 100,
        oopMax: submitted.oopMax,
        householdSize: submitted.householdSize,
        income: submitted.income,
        insuranceType: submitted.insuranceType,
      },
      regimen,
    );

    const aid = navigateAid(est, PROGRAMS, FPL, {
      income: submitted.income,
      householdSize: submitted.householdSize,
      diagnosis: regimen.diagnosis,
      insuranceType: submitted.insuranceType,
    });

    return { regimen, est, aid };
  }, [submitted]);

  const hasAid = !!result && result.aid.bestAwardCap > 0;

  return (
    <div className="min-h-screen">
      <DisclaimerBanner />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-7">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[28px]">
            Out-of-Pocket Cost Estimator &amp; Aid Navigator
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
            What a course of cancer treatment will actually cost you, cycle by cycle — and
            which assistance programs you already qualify for. Both answers come from the
            same handful of inputs.
          </p>
        </header>

        {result ? (
          <div className="space-y-5">
            {/* The form collapses to a summary strip once results render. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3 text-[13px]">
              <span className="font-medium text-[var(--text-primary)]">
                {result.regimen.name.split(" (")[0]}
              </span>
              <span className="text-[var(--text-secondary)]">
                {result.regimen.cycleCount} cycles from {submitted!.startDate}
              </span>
              <span className="text-[var(--text-secondary)] capitalize">
                {submitted!.insuranceType}
              </span>
              <span className="tnum text-[var(--text-secondary)]">
                {money(submitted!.deductible)} deductible · {submitted!.coinsurancePercent}%
                coinsurance · {money(submitted!.oopMax)} max
              </span>
              <span className="tnum text-[var(--text-secondary)]">
                Household of {submitted!.householdSize}, {money(submitted!.income)}
              </span>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="ml-auto rounded-md border border-[var(--border-2)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-1)]"
              >
                Change inputs
              </button>
            </div>

            {/* Headline. Largest type on the page. */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Your cost before aid
                </div>
                <div className="tnum mt-1.5 text-4xl font-semibold text-[var(--text-primary)]">
                  {money(result.est.totalPatientPays)}
                </div>
                <div className="mt-1.5 tnum text-[13px] text-[var(--text-secondary)]">
                  out of {money(result.est.totalGross)} billed
                </div>
              </div>
              <div
                className="rounded-xl border bg-[var(--surface-1)] p-5"
                style={{ borderColor: hasAid ? "var(--series-2)" : "var(--border-1)" }}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Your cost after aid
                </div>
                <div className="tnum mt-1.5 text-4xl font-semibold text-[var(--text-primary)]">
                  {money(result.aid.totalAfterAid)}
                </div>
                <div className="mt-1.5 tnum text-[13px] text-[var(--text-secondary)]">
                  {hasAid
                    ? `${money(
                        result.est.totalPatientPays - result.aid.totalAfterAid,
                      )} covered by the largest fund you match`
                    : "no matching programs — see below"}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <CostChart
                estimate={result.est}
                afterAidCumulative={result.aid.afterAidCumulative}
                hasAid={hasAid}
              />
              {result.est.cycles.some((c) => c.planYearReset) && (
                <p className="mt-4 border-t border-[var(--border-1)] pt-3.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">
                    This course of treatment crosses a plan year.
                  </span>{" "}
                  The deductible and out-of-pocket maximum both reset on January 1, so this
                  patient pays them twice. Starting the same treatment earlier in a plan
                  year would cost less — identical diagnosis, identical regimen, different
                  calendar.
                </p>
              )}
            </section>

            <CycleTable
              estimate={result.est}
              afterAidCumulative={result.aid.afterAidCumulative}
              hasAid={hasAid}
            />
            <ProgramList aid={result.aid} />
            <AssumptionsBlock regimen={result.regimen} />
          </div>
        ) : (
          <InputForm
            value={form}
            onChange={setForm}
            onSubmit={() => setSubmitted(form)}
            regimens={REGIMENS}
            oopError={oopError}
          />
        )}
      </main>
    </div>
  );
}
