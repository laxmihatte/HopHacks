"use client";

import { useState } from "react";
import type { PlanYearProfile } from "@/lib/types";
import profileData from "@/data/plan-years.json";

const PROFILES = profileData as PlanYearProfile[];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CONFIDENCE_LABEL: Record<PlanYearProfile["confidence"], string> = {
  regulated: "Set by regulation",
  common: "Usual, but confirm",
  varies: "Varies — you must check",
};

/**
 * The plan-year boundary control.
 *
 * The teaching point is in the copy: your insurance company's name does not
 * determine this. An employer plan follows the employer's benefit year, so the
 * same insurer resets in January for one member and July for another.
 */
export default function PlanYearField({
  coverage,
  planYearStart,
  onChange,
  error,
}: {
  coverage: string;
  planYearStart: string;
  onChange: (next: { coverage: string; planYearStart: string }) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const profile = PROFILES.find((p) => p.id === coverage) ?? PROFILES[0];
  const [month, day] = planYearStart.split("-").map(Number);

  const setMonthDay = (m: number, d: number) => {
    const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    const clamped = Math.min(Math.max(1, d), maxDay);
    onChange({
      coverage,
      planYearStart: `${String(m).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`,
    });
  };

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <label className="block">
        <span className="eyebrow">Where your coverage comes from</span>
        <select
          aria-label="Where your coverage comes from"
          className="mt-2 w-full rounded-[var(--radius-field)] border border-[var(--rule-strong)] bg-[var(--card)] px-3.5 py-2.5 text-[15px] text-[var(--ink)]"
          value={coverage}
          onChange={(e) => {
            const next = PROFILES.find((p) => p.id === e.target.value)!;
            onChange({
              coverage: next.id,
              planYearStart: next.typicalStart ?? planYearStart,
            });
          }}
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="border-0 p-0">
        <legend className="eyebrow">Your plan year restarts on</legend>
        <div className="mt-2 flex items-end gap-3">
          <select
            aria-label="Plan year start month"
            className="flex-1 rounded-[var(--radius-field)] border border-[var(--rule-strong)] bg-[var(--card)] px-3.5 py-2.5 text-[15px] text-[var(--ink)]"
            value={month}
            onChange={(e) => setMonthDay(Number(e.target.value), day)}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            aria-label="Plan year start day"
            min={1}
            max={31}
            step={1}
            inputMode="numeric"
            aria-invalid={error ? true : undefined}
            className="tnum w-20 rounded-[var(--radius-field)] border border-[var(--rule-strong)] bg-[var(--card)] px-3.5 py-2.5 text-[15px] text-[var(--ink)]"
            value={day}
            onChange={(e) => setMonthDay(month, Number(e.target.value))}
          />
        </div>
        {error && (
          <span role="alert" className="mt-1.5 block text-[12px] text-[var(--series-2)]">
            {error}
          </span>
        )}
      </fieldset>

      <div className="sm:col-span-2">
        <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
          <span
            className="mr-2 inline-block align-[1px] text-[11px] font-semibold uppercase tracking-wider"
            style={{
              color: profile.confidence === "varies" ? "var(--series-2)" : "var(--ink-3)",
            }}
          >
            {CONFIDENCE_LABEL[profile.confidence]}
          </span>
          {profile.note}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2.5 text-[13px] font-medium text-[var(--accent)] underline underline-offset-2"
          aria-expanded={open}
        >
          {open ? "Hide" : "Where do I find this?"}
        </button>
        {open && (
          <p className="mt-2 max-w-prose border-l-2 border-[var(--rule-strong)] pl-3 text-[13px] leading-relaxed text-[var(--ink-2)]">
            {profile.whereToCheck} Your insurance company&rsquo;s name does not decide this
            on its own — an employer plan follows the employer&rsquo;s benefit year, so the
            same insurer can reset in January for one member and in July for another.
          </p>
        )}
      </div>
    </div>
  );
}
