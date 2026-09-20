"use client";

import { useMemo, useState } from "react";
import { defaultWindow, sweepStartDates, todayIso } from "@/lib/optimizer";
import { planYearBoundary, planYearOf } from "@/lib/calculator";
import { InvalidInputError, isValidIsoDate } from "@/lib/validation";
import type { EstimateInput, Regimen, StartDateOption } from "@/lib/types";

const W = 760;
const H = 240;
const PAD = { top: 18, right: 20, bottom: 40, left: 68 };

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });

export default function StartDateOptimizer({
  input,
  regimen,
  awardCap,
}: {
  input: EstimateInput;
  regimen: Regimen;
  awardCap: number;
}) {
  const today = useMemo(() => todayIso(), []);
  const initial = useMemo(
    () => defaultWindow(input.startDate, today),
    [input.startDate, today],
  );
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [hover, setHover] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      return { error: "Enter two real dates for the window." };
    }
    try {
      return { sweep: sweepStartDates(input, regimen, from, to, { stepDays: 1, awardCap }) };
    } catch (e) {
      return {
        error:
          e instanceof InvalidInputError ? e.message : "That window could not be priced.",
      };
    }
  }, [input, regimen, from, to, awardCap]);

  const sweep = "sweep" in result ? result.sweep : null;

  // Plan-year boundaries that fall inside the window — the cliffs that make
  // this curve a staircase rather than a line.
  const boundaries = useMemo(() => {
    if (!sweep) return [] as string[];
    const first = planYearOf(sweep.options[0].startDate, input.planYearStart);
    const last = planYearOf(sweep.options.at(-1)!.startDate, input.planYearStart);
    const out: string[] = [];
    for (let y = first + 1; y <= last; y++) out.push(planYearBoundary(y, input.planYearStart));
    return out;
  }, [sweep, input.planYearStart]);

  return (
    <section className="card p-7 sm:p-9">
      <p className="eyebrow">Smart start date</p>
      <h2 className="display mt-1.5 text-[26px] sm:text-[30px]">
        If you have any choice about when to begin
      </h2>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
        Every date below is a complete cycle-by-cycle simulation, not an approximation.
        Where the curve steps, a course of treatment starting that day crosses your
        plan-year boundary and pays the deductible and out-of-pocket maximum twice.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
        <label className="block">
          <span className="eyebrow">Earliest you could start</span>
          <input
            type="date"
            min={today}
            className="tnum mt-2 block border-0 border-b border-[var(--rule-strong)] bg-transparent py-1.5 text-[15px]"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="eyebrow">Latest you could start</span>
          <input
            type="date"
            min={today}
            className="tnum mt-2 block border-0 border-b border-[var(--rule-strong)] bg-transparent py-1.5 text-[15px]"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <p className="max-w-[34ch] text-[12px] leading-snug text-[var(--ink-3)]">
          Set this to the window your oncologist says is clinically acceptable.
        </p>
      </div>

      {!sweep ? (
        <p role="alert" className="mt-6 text-[14px] text-[var(--series-2)]">
          {"error" in result ? result.error : null}
        </p>
      ) : (
        <Sweep
          sweep={sweep}
          boundaries={boundaries}
          hover={hover}
          setHover={setHover}
          awardCap={awardCap}
        />
      )}
    </section>
  );
}

function Sweep({
  sweep,
  boundaries,
  hover,
  setHover,
  awardCap,
}: {
  sweep: NonNullable<ReturnType<typeof sweepStartDates>>;
  boundaries: string[];
  hover: number | null;
  setHover: (i: number | null) => void;
  awardCap: number;
}) {
  const { options, cheapest, chosen, savingsVsChosen, spread } = sweep;

  const values = options.map((o) => o.totalPatientPays);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Round the axis outward to a clean step so the labels are readable money.
  const rough = (hi - lo || hi || 1) / 2;
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((c) => c >= rough) ?? 10 * mag,
  );
  const top = Math.ceil((hi + step * 0.25) / step) * step;
  const bottom = Math.max(0, Math.floor((lo - step * 0.25) / step) * step);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (options.length === 1 ? plotW / 2 : (i / (options.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - bottom) / (top - bottom)) * plotH;

  const path = options
    .map((o, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(o.totalPatientPays).toFixed(1)}`)
    .join(" ");

  const idxOf = (iso: string) => options.findIndex((o) => o.startDate === iso);
  const cheapestIdx = idxOf(cheapest.startDate);
  const chosenIdx = chosen ? idxOf(chosen.startDate) : -1;
  const active = hover !== null ? options[hover] : null;

  const gridValues: number[] = [];
  for (let v = bottom; v <= top + 1e-6; v += step) gridValues.push(Math.round(v));
  const worthIt = savingsVsChosen > 0;

  return (
    <>
      <div className="mt-7 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Cheapest date in your window</p>
          <p className="display mt-1 text-[30px] font-semibold leading-tight">
            {longDate(cheapest.startDate)}
          </p>
          <p className="tnum mt-1 text-[14px] text-[var(--ink-2)]">
            {money(cheapest.totalPatientPays)} out of pocket
            {awardCap > 0 && <> · {money(cheapest.totalAfterAid)} after aid</>}
          </p>
        </div>
        <div>
          <p className="eyebrow">
            {worthIt ? "Moving your start date saves" : "Against your chosen date"}
          </p>
          <p
            className="display tnum mt-1 text-[30px] font-semibold leading-tight"
            style={{ color: worthIt ? "var(--series-2)" : "var(--ink)" }}
          >
            {money(savingsVsChosen)}
          </p>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">
            {worthIt ? (
              <>
                versus starting {chosen ? longDate(chosen.startDate) : "your chosen date"}
              </>
            ) : (
              <>Your chosen date is already the cheapest in this window.</>
            )}
          </p>
        </div>
      </div>

      <figure className="relative mt-7 m-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 280 }}
          role="img"
          aria-label={`Out-of-pocket cost by start date. Cheapest is ${longDate(
            cheapest.startDate,
          )} at ${money(cheapest.totalPatientPays)}; the spread across the window is ${money(
            spread,
          )}.`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            let nearest = 0;
            let best = Infinity;
            for (let i = 0; i < options.length; i++) {
              const d = Math.abs(x(i) - px);
              if (d < best) { best = d; nearest = i; }
            }
            setHover(nearest);
          }}
        >
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)}
                stroke="var(--grid)" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" fontSize={11}
                fill="var(--ink-3)" className="tnum">
                {money(v)}
              </text>
            </g>
          ))}

          {boundaries.map((b) => {
            const i = idxOf(b);
            if (i < 0) return null;
            return (
              <g key={b}>
                <line x1={x(i)} x2={x(i)} y1={PAD.top - 4} y2={PAD.top + plotH}
                  stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" />
                <text
                  x={x(i) + (i > options.length * 0.6 ? -6 : 6)}
                  y={PAD.top + 6}
                  textAnchor={i > options.length * 0.6 ? "end" : "start"}
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--ink-2)"
                >
                  plan year restarts
                </text>
              </g>
            );
          })}

          <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH}
            stroke="var(--rule-strong)" strokeWidth={1} />

          {options.map((o, i) =>
            i % Math.max(1, Math.ceil(options.length / 6)) === 0 ||
            i === options.length - 1 ? (
              <text key={o.startDate} x={x(i)} y={PAD.top + plotH + 17} textAnchor="middle"
                fontSize={11} fill="var(--ink-3)">
                {shortDate(o.startDate)}
              </text>
            ) : null,
          )}
          <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fontSize={11}
            fill="var(--ink-3)">
            Date treatment begins
          </text>

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
              stroke="var(--rule-strong)" strokeWidth={1} />
          )}

          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} />

          {chosenIdx >= 0 && chosenIdx !== cheapestIdx && (
            <circle cx={x(chosenIdx)} cy={y(options[chosenIdx].totalPatientPays)} r={4}
              fill="var(--card)" stroke="var(--ink-2)" strokeWidth={2} />
          )}
          <circle cx={x(cheapestIdx)} cy={y(cheapest.totalPatientPays)} r={5.5}
            fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} />

          {hover !== null && (
            <circle cx={x(hover)} cy={y(options[hover].totalPatientPays)} r={4.5}
              fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
          )}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 min-w-48 border border-[var(--rule-strong)] bg-[var(--card)] p-2.5 text-[12px] shadow-sm"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              top: 4,
              transform: hover! > options.length / 2 ? "translateX(-108%)" : "translateX(8px)",
            }}
          >
            <p className="font-semibold">{longDate(active.startDate)}</p>
            <dl className="mt-1.5 space-y-1 text-[var(--ink-2)]">
              <div className="flex justify-between gap-5">
                <dt>You pay</dt>
                <dd className="tnum text-[var(--ink)]">{money(active.totalPatientPays)}</dd>
              </div>
              {awardCap > 0 && (
                <div className="flex justify-between gap-5">
                  <dt>After aid</dt>
                  <dd className="tnum text-[var(--ink)]">{money(active.totalAfterAid)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-5">
                <dt>Deductibles charged</dt>
                <dd className="tnum text-[var(--ink)]">{active.deductiblesCharged}</dd>
              </div>
            </dl>
          </div>
        )}
        <figcaption className="mt-3 text-[12px] leading-relaxed text-[var(--ink-3)]">
          Orange marks the cheapest date; the hollow ring is the date you entered. Ties
          resolve to the earliest date — delaying treatment carries clinical risk this tool
          does not model, so it never recommends a later date for the same money.
        </figcaption>
      </figure>
    </>
  );
}
