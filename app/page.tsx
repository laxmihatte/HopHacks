"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AssumptionsBlock from "@/components/AssumptionsBlock";
import CostChart from "@/components/CostChart";
import CycleTable from "@/components/CycleTable";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import InputForm from "@/components/InputForm";
import ProgramList from "@/components/ProgramList";
import { estimate as runEstimate } from "@/lib/calculator";
import { navigateAid } from "@/lib/matcher";
import type { FormState, FplTable, Program, Regimen } from "@/lib/types";
import { parseField, validateForm } from "@/lib/validation";
import { decodeForm, encodeForm } from "@/lib/url";
import fplData from "@/data/fpl.json";
import programData from "@/data/programs.json";
import regimenData from "@/data/regimens.json";

const REGIMENS = regimenData as Regimen[];
const PROGRAMS = programData as Program[];
const FPL = fplData as FplTable;

const isKnownRegimen = (id: string, diagnosis: string) =>
  REGIMENS.some((r) => r.id === id && r.diagnosis === diagnosis);

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Pre-filled with the demo input, so the page is never an empty form. */
const DEFAULTS: FormState = {
  diagnosis: "breast-cancer",
  regimenId: "tchp",
  startDate: "2026-10-15",
  insuranceType: "commercial",
  deductible: "3000",
  coinsurancePercent: "20",
  oopMax: "9000",
  householdSize: "4",
  income: "85000",
};



export default function Page() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitted, setSubmitted] = useState<FormState | null>(null);

  /**
   * Each view is a real history entry, so the browser's Back and Forward
   * buttons move between the form and the results instead of leaving the app.
   * The results URL also carries the inputs, so a reload or a pasted link
   * reopens the same estimate.
   */
  const show = useCallback((next: FormState | null, mode: "push" | "replace" = "push") => {
    setSubmitted(next);
    if (next) setForm(next);
    if (typeof window !== "undefined") {
      const url = next ? `${window.location.pathname}?${encodeForm(next)}` : window.location.pathname;
      window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
      window.scrollTo({ top: 0 });
    }
  }, []);

  // Restore from the URL on first paint, and follow Back/Forward after that.
  // Reading location in an effect rather than during render keeps the server
  // and client markup identical.
  useEffect(() => {
    const fromUrl = () => {
      const decoded = decodeForm(window.location.search, isKnownRegimen);
      setSubmitted(decoded);
      if (decoded) setForm(decoded);
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, []);

  const errors = validateForm(form);

  const canReset = (Object.keys(DEFAULTS) as (keyof FormState)[]).some(
    (k) => form[k] !== DEFAULTS[k],
  );

  const result = useMemo(() => {
    if (!submitted) return null;
    const regimen = REGIMENS.find((r) => r.id === submitted.regimenId);
    if (!regimen) return { error: "That regimen is no longer available." } as const;

    const deductible = parseField(submitted.deductible);
    const coinsurancePercent = parseField(submitted.coinsurancePercent);
    const oopMax = parseField(submitted.oopMax);
    const householdSize = parseField(submitted.householdSize);
    const income = parseField(submitted.income);
    if (
      deductible === null ||
      coinsurancePercent === null ||
      oopMax === null ||
      householdSize === null ||
      income === null
    ) {
      return { error: "Some inputs could not be read as numbers." } as const;
    }

    try {
      const est = runEstimate(
      {
        regimenId: submitted.regimenId,
        startDate: submitted.startDate,
        deductible,
        coinsuranceRate: coinsurancePercent / 100,
        oopMax,
        householdSize,
        income,
        insuranceType: submitted.insuranceType,
      },
      regimen,
    );

      const aid = navigateAid(est, PROGRAMS, FPL, {
        income,
        householdSize,
        diagnosis: regimen.diagnosis,
        insuranceType: submitted.insuranceType,
      });

      return {
        regimen,
        est,
        aid,
        inputs: { deductible, coinsurancePercent, oopMax, householdSize, income },
      };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "This estimate could not be calculated.",
      } as const;
    }
  }, [submitted]);

  const ok = result && !("error" in result) ? result : null;
  const hasAid = !!ok && ok.aid.bestAwardCap > 0;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 bg-[var(--surface-0)]">
        <DisclaimerBanner />
        {ok && (
          <div className="border-b border-[var(--border-1)] bg-[var(--surface-2)]">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-[13px] sm:px-6">
              <span className="font-medium text-[var(--text-primary)]">
                {ok.regimen.name.split(" (")[0]}
              </span>
              <span className="hidden text-[var(--text-secondary)] sm:inline">
                {ok.regimen.cycleCount} cycles from {submitted!.startDate}
              </span>
              <span className="hidden text-[var(--text-secondary)] capitalize md:inline">
                {submitted!.insuranceType}
              </span>
              <span className="hidden tnum text-[var(--text-secondary)] lg:inline">
                {money(ok.inputs.deductible)} deductible ·{" "}
                {ok.inputs.coinsurancePercent}% coinsurance ·{" "}
                {money(ok.inputs.oopMax)} max
              </span>
              <span className="hidden tnum text-[var(--text-secondary)] lg:inline">
                Household of {ok.inputs.householdSize}, {money(ok.inputs.income)}
              </span>
              <button
                type="button"
                onClick={() => show(null)}
                className="ml-auto rounded-md border border-[var(--border-2)] bg-[var(--surface-1)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-0)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)]"
              >
                Change inputs
              </button>
            </div>
          </div>
        )}
      </div>

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

        {ok ? (
          <div
            className="space-y-5"
            role="region"
            aria-live="polite"
            aria-label="Your cost estimate"
          >
            {/* Headline. Largest type on the page. */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Your cost before aid
                </h2>
                <div className="tnum mt-1.5 text-4xl font-semibold text-[var(--text-primary)]">
                  {money(ok.est.totalPatientPays)}
                </div>
                <div className="mt-1.5 tnum text-[13px] text-[var(--text-secondary)]">
                  out of {money(ok.est.totalGross)} billed
                </div>
              </div>
              <div
                className="rounded-xl border bg-[var(--surface-1)] p-5"
                style={{ borderColor: hasAid ? "var(--series-2)" : "var(--border-1)" }}
              >
                <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Your cost after aid
                </h2>
                <div className="tnum mt-1.5 text-4xl font-semibold text-[var(--text-primary)]">
                  {money(ok.aid.totalAfterAid)}
                </div>
                <div className="mt-1.5 tnum text-[13px] text-[var(--text-secondary)]">
                  {hasAid
                    ? `${money(
                        ok.est.totalPatientPays - ok.aid.totalAfterAid,
                      )} covered by the largest fund you match`
                    : "no matching programs — see below"}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <CostChart
                estimate={ok.est}
                afterAidCumulative={ok.aid.afterAidCumulative}
                hasAid={hasAid}
              />
              {ok.est.cycles.some((c) => c.planYearReset) && (
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
              estimate={ok.est}
              afterAidCumulative={ok.aid.afterAidCumulative}
              hasAid={hasAid}
            />
            <ProgramList aid={ok.aid} />
            <AssumptionsBlock regimen={ok.regimen} />
          </div>
        ) : (
          <>
            {result && "error" in result && (
              <div
                role="alert"
                className="mb-5 rounded-xl border p-4 text-[13px] leading-relaxed"
                style={{
                  borderColor: "var(--series-2)",
                  color: "var(--text-primary)",
                  background: "var(--surface-1)",
                }}
              >
                <strong className="font-semibold">This estimate could not be calculated.</strong>{" "}
                {result.error} Adjust the inputs below and try again.
              </div>
            )}
            <InputForm
            value={form}
            onChange={setForm}
            onSubmit={() => show(form)}
            onReset={() => setForm(DEFAULTS)}
            canReset={canReset}
            regimens={REGIMENS}
            errors={errors}
          />
          </>
        )}
      </main>
    </div>
  );
}
