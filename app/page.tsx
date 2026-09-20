"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AssumptionsBlock from "@/components/AssumptionsBlock";
import CostChart from "@/components/CostChart";
import CycleTable from "@/components/CycleTable";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import InputForm from "@/components/InputForm";
import ProgramList from "@/components/ProgramList";
import StartDateOptimizer from "@/components/StartDateOptimizer";
import { estimate as runEstimate } from "@/lib/calculator";
import { navigateAid } from "@/lib/matcher";
import { decodeForm, encodeForm } from "@/lib/url";
import { parseField, validateForm } from "@/lib/validation";
import type { EstimateInput, FormState, FplTable, Program, Regimen } from "@/lib/types";
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

const monthDay = (md: string) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(Date.UTC(2001, m - 1, d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  });
};

/** Pre-filled with the demo input, so the page is never an empty form. */
const DEFAULTS: FormState = {
  diagnosis: "breast-cancer",
  regimenId: "tchp",
  startDate: "2026-10-15",
  insuranceType: "commercial",
  coverage: "employer-calendar",
  planYearStart: "01-01",
  deductible: "3000",
  coinsurancePercent: "20",
  oopMax: "9000",
  householdSize: "4",
  income: "85000",
};

export default function Page() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitted, setSubmitted] = useState<FormState | null>(null);

  const show = useCallback((next: FormState | null, mode: "push" | "replace" = "push") => {
    setSubmitted(next);
    if (next) setForm(next);
    if (typeof window !== "undefined") {
      const url = next
        ? `${window.location.pathname}?${encodeForm(next)}`
        : window.location.pathname;
      window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
      window.scrollTo({ top: 0 });
    }
  }, []);

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
      deductible === null || coinsurancePercent === null || oopMax === null ||
      householdSize === null || income === null
    ) {
      return { error: "Some inputs could not be read as numbers." } as const;
    }

    const input: EstimateInput = {
      regimenId: submitted.regimenId,
      startDate: submitted.startDate,
      deductible,
      coinsuranceRate: coinsurancePercent / 100,
      oopMax,
      householdSize,
      income,
      insuranceType: submitted.insuranceType,
      planYearStart: submitted.planYearStart,
    };

    try {
      const est = runEstimate(input, regimen);
      const aid = navigateAid(est, PROGRAMS, FPL, {
        income,
        householdSize,
        diagnosis: regimen.diagnosis,
        insuranceType: submitted.insuranceType,
      });
      return {
        regimen, est, aid, input,
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
  const crosses = !!ok && ok.est.cycles.some((c) => c.planYearReset);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 bg-[var(--paper)]">
        <DisclaimerBanner />
        {ok && (
          <div className="border-b border-[var(--rule)] bg-[var(--paper-sunk)]">
            <div className="mx-auto flex max-w-[64rem] flex-wrap items-center gap-x-6 gap-y-1.5 px-6 py-2.5 text-[13px]">
              <span className="font-medium">{ok.regimen.name.split(" (")[0]}</span>
              <span className="tnum hidden text-[var(--ink-2)] sm:inline">
                {ok.regimen.cycleCount} cycles from {submitted!.startDate}
              </span>
              <span className="tnum hidden text-[var(--ink-2)] lg:inline">
                {money(ok.inputs.deductible)} deductible · {ok.inputs.coinsurancePercent}%
                · {money(ok.inputs.oopMax)} max
              </span>
              <span className="hidden text-[var(--ink-2)] lg:inline">
                Plan year restarts {monthDay(submitted!.planYearStart)}
              </span>
              <button
                type="button"
                onClick={() => show(null)}
                className="ml-auto border border-[var(--rule-strong)] px-3 py-1 text-[13px] font-medium hover:bg-[var(--paper)]"
              >
                Change inputs
              </button>
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-[64rem] px-6 pb-20">
        <header className="pt-10 pb-7">
          <p className="eyebrow">Cost of care</p>
          <h1 className="display mt-2 max-w-[20ch] text-[34px] font-semibold leading-[1.12] sm:text-[42px]">
            What cancer treatment will actually cost you
          </h1>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
            Cycle by cycle, from published Medicare payment limits — plus the assistance
            programs your household already qualifies for, and the cheapest day to begin.
          </p>
        </header>

        {ok ? (
          <div role="region" aria-live="polite" aria-label="Your cost estimate">
            <section className="rule grid gap-x-10 gap-y-7 pt-7 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Your cost before aid</p>
                <p className="display tnum mt-1.5 text-[46px] font-semibold leading-none">
                  {money(ok.est.totalPatientPays)}
                </p>
                <p className="tnum mt-2 text-[14px] text-[var(--ink-2)]">
                  of {money(ok.est.totalGross)} billed to your insurer
                </p>
              </div>
              <div className="sm:border-l sm:border-[var(--rule)] sm:pl-10">
                <p className="eyebrow">Your cost after aid</p>
                <p
                  className="display tnum mt-1.5 text-[46px] font-semibold leading-none"
                  style={{ color: hasAid ? "var(--series-2)" : undefined }}
                >
                  {money(ok.aid.totalAfterAid)}
                </p>
                <p className="tnum mt-2 text-[14px] text-[var(--ink-2)]">
                  {hasAid
                    ? `${money(ok.est.totalPatientPays - ok.aid.totalAfterAid)} covered by the largest fund you match`
                    : "no matching programs — see below"}
                </p>
              </div>
            </section>

            <section className="rule pt-7">
              <CostChart
                estimate={ok.est}
                afterAidCumulative={ok.aid.afterAidCumulative}
                hasAid={hasAid}
              />
              {crosses && (
                <p className="mt-5 max-w-[68ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
                  <span className="font-medium text-[var(--ink)]">
                    This course of treatment crosses your plan-year boundary.
                  </span>{" "}
                  Your deductible and out-of-pocket maximum both restart on{" "}
                  {monthDay(submitted!.planYearStart)}, so you pay them twice. The section
                  below prices every other day you could begin.
                </p>
              )}
            </section>

            <StartDateOptimizer
              input={ok.input}
              regimen={ok.regimen}
              awardCap={ok.aid.bestAwardCap}
            />

            <CycleTable
              estimate={ok.est}
              afterAidCumulative={ok.aid.afterAidCumulative}
              hasAid={hasAid}
            />
            <ProgramList aid={ok.aid} />
            <AssumptionsBlock regimen={ok.regimen} planYearStart={submitted!.planYearStart} />
          </div>
        ) : (
          <>
            {result && "error" in result && (
              <div
                role="alert"
                className="mb-7 border-l-2 border-[var(--series-2)] py-1 pl-4 text-[14px] leading-relaxed"
              >
                <strong className="font-semibold">
                  This estimate could not be calculated.
                </strong>{" "}
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
