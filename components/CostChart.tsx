"use client";

import { useMemo, useState } from "react";
import type { Estimate } from "@/lib/types";

const W = 760;
const H = 330;
const PAD = { top: 24, right: 92, bottom: 44, left: 66 };

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const moneyExact = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * A y-axis top and step that produce round, distinct gridline labels.
 *
 * The step is never below $1: axis labels are whole dollars, so a sub-dollar
 * step renders repeated values ("$0, $0, $1, $1, $1") on a patient who pays
 * nothing.
 */
export function niceScale(max: number): { top: number; step: number } {
  if (!Number.isFinite(max) || max <= 0) return { top: 100, step: 25 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const candidate = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const step = Math.max(1, Math.round(candidate));
  return { top: Math.ceil(max / step) * step, step };
}

export default function CostChart({
  estimate,
  afterAidCumulative,
  hasAid,
}: {
  estimate: Estimate;
  afterAidCumulative: number[];
  hasAid: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const { cycles } = estimate;
  const peak = Math.max(...cycles.map((c) => c.cumulativePatientPays), 0);
  const { top, step } = useMemo(() => niceScale(peak), [peak]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Cycle index -> x. Cycles are evenly spaced in the schedule, so index
  // spacing and date spacing agree.
  const x = (i: number) =>
    PAD.left + (cycles.length === 1 ? plotW / 2 : (i / (cycles.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const beforeValues = cycles.map((c) => c.cumulativePatientPays);
  const beforePath = path(beforeValues);
  const afterPath = path(afterAidCumulative);

  // The band between the two curves, closed: down the before-aid line, back
  // along the after-aid line. That band is the value the product delivers.
  const gapPath = [
    ...beforeValues.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`),
    ...afterAidCumulative
      .map((v, i) => ({ v, i }))
      .reverse()
      .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`),
    "Z",
  ].join(" ");

  const endBefore = estimate.totalPatientPays;
  const endAfter = afterAidCumulative.at(-1) ?? 0;

  /**
   * End labels, de-collided. When aid covers everything, both curves finish at
   * the same value and the two labels would render exactly on top of each
   * other; a single label is drawn instead. When they merely sit close, they
   * are nudged apart.
   */
  const endLabels: { key: string; y: number; text: string }[] = (() => {
    if (!hasAid || endBefore === endAfter) {
      return [{ key: "before", y: y(endBefore), text: money(endBefore) }];
    }
    const yb = y(endBefore);
    const ya = y(endAfter);
    const MIN_GAP = 13;
    if (Math.abs(yb - ya) >= MIN_GAP) {
      return [
        { key: "before", y: yb, text: money(endBefore) },
        { key: "after", y: ya, text: money(endAfter) },
      ];
    }
    const mid = (yb + ya) / 2;
    return [
      { key: "before", y: mid - MIN_GAP / 2, text: money(endBefore) },
      { key: "after", y: mid + MIN_GAP / 2, text: money(endAfter) },
    ];
  })();

  const gridCount = Math.min(12, Math.max(1, Math.round(top / step)));
  const gridValues = Array.from({ length: gridCount + 1 }, (_, i) => i * step);

  // A plan-year boundary sits between the last cycle of one year and the first
  // of the next. Draw the rule midway, which is where the reset actually lands.
  const boundaries = cycles
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c.planYearReset && i > 0)
    .map(({ c, i }) => ({ at: (x(i - 1) + x(i)) / 2, year: c.planYear }));

  const active = hover === null ? null : cycles[hover];

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <figcaption className="text-[15px] font-semibold text-[var(--text-primary)]">
          Cumulative out-of-pocket cost across treatment
        </figcaption>
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-4 rounded-full"
              style={{ background: "var(--series-1)" }}
            />
            Before aid
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-4 rounded-full"
              style={{ background: "var(--series-2)" }}
            />
            After aid
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 360 }}
          role="img"
          aria-label={`Cumulative out-of-pocket cost. Before aid reaches ${money(
            estimate.totalPatientPays,
          )} by the final cycle; after aid, ${money(afterAidCumulative.at(-1) ?? 0)}.`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            let nearest = 0;
            let best = Infinity;
            for (let i = 0; i < cycles.length; i++) {
              const d = Math.abs(x(i) - px);
              if (d < best) {
                best = d;
                nearest = i;
              }
            }
            setHover(nearest);
          }}
        >
          {/* Gridlines and y labels — recessive. */}
          {gridValues.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
                className="tnum"
              >
                {money(v)}
              </text>
            </g>
          ))}

          {/* Plan-year boundary rules. The single largest controllable swing. */}
          {boundaries.map((b) => (
            <g key={b.year}>
              <line
                x1={b.at}
                x2={b.at}
                y1={PAD.top - 6}
                y2={PAD.top + plotH}
                stroke="var(--text-secondary)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text
                x={b.at + (b.at < PAD.left + plotW / 3 ? 6 : -6)}
                y={PAD.top + 4}
                textAnchor={b.at < PAD.left + plotW / 3 ? "start" : "end"}
                fontSize={11}
                fontWeight={600}
                fill="var(--text-secondary)"
              >
                Jan 1, {b.year} — plan year resets
              </text>
            </g>
          ))}

          {/* x axis */}
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="var(--border-2)"
            strokeWidth={1}
          />
          {cycles.map((c, i) =>
            i % Math.max(1, Math.ceil(cycles.length / 7)) === 0 ||
            i === cycles.length - 1 ? (
              <text
                key={c.index}
                x={x(i)}
                y={PAD.top + plotH + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {shortDate(c.date)}
              </text>
            ) : null,
          )}
          <text
            x={PAD.left + plotW / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
          >
            Treatment cycle date
          </text>

          {/* Crosshair under the marks. */}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--border-2)"
              strokeWidth={1}
            />
          )}

          {/* The gap between the curves is the product — shade it. */}
          {hasAid && (
            <path d={gapPath} fill="var(--series-2)" opacity={0.1} />
          )}

          {/* Series. 2px lines, after-aid drawn on top with a surface ring. */}
          <path d={beforePath} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          {hasAid && (
            <>
              <path d={afterPath} fill="none" stroke="var(--surface-1)" strokeWidth={4} />
              <path d={afterPath} fill="none" stroke="var(--series-2)" strokeWidth={2} />
            </>
          )}

          {/* Hover markers. */}
          {hover !== null && (
            <>
              <circle
                cx={x(hover)}
                cy={y(cycles[hover].cumulativePatientPays)}
                r={5}
                fill="var(--series-1)"
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
              {hasAid && (
                <circle
                  cx={x(hover)}
                  cy={y(afterAidCumulative[hover])}
                  r={5}
                  fill="var(--series-2)"
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                />
              )}
            </>
          )}

          {/* Direct end labels — identity is never colour alone. */}
          {endLabels.map((l) => (
            <text
              key={l.key}
              x={x(cycles.length - 1) + 8}
              y={l.y + 4}
              fontSize={11}
              fontWeight={600}
              fill="var(--text-primary)"
              className="tnum"
            >
              {l.text}
            </text>
          ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-2.5 text-xs shadow-lg"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              top: "17%",
              transform: hover! > cycles.length / 2 ? "translateX(-108%)" : "translateX(8px)",
            }}
          >
            <div className="mb-1.5 font-semibold text-[var(--text-primary)]">
              Cycle {active.index} · {shortDate(active.date)}
              {active.planYearReset && (
                <span className="ml-1 font-normal text-[var(--text-secondary)]">
                  (new plan year)
                </span>
              )}
            </div>
            <dl className="space-y-1 text-[var(--text-secondary)]">
              <div className="flex justify-between gap-4">
                <dt>Billed this cycle</dt>
                <dd className="tnum text-[var(--text-primary)]">{moneyExact(active.grossCost)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Patient pays</dt>
                <dd className="tnum text-[var(--text-primary)]">{moneyExact(active.patientPays)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Cumulative, before aid</dt>
                <dd className="tnum text-[var(--text-primary)]">
                  {moneyExact(active.cumulativePatientPays)}
                </dd>
              </div>
              {hasAid && (
                <div className="flex justify-between gap-4">
                  <dt>Cumulative, after aid</dt>
                  <dd className="tnum text-[var(--text-primary)]">
                    {moneyExact(afterAidCumulative[hover!])}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </figure>
  );
}
