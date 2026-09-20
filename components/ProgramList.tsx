import type { AidResult } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function ProgramList({ aid }: { aid: AidResult }) {
  if (aid.matched.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Assistance programs
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          No programs in this list matched these inputs. At{" "}
          <span className="tnum font-medium text-[var(--text-primary)]">
            {aid.fplPercent.toFixed(0)}%
          </span>{" "}
          of the federal poverty guideline, this household is above the income gate for
          every fund listed here, or no listed fund covers this diagnosis and insurance
          type. That is an answer, not an error — the cost estimate above still stands.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          {aid.matched.length} assistance {aid.matched.length === 1 ? "program" : "programs"}{" "}
          this household may qualify for
        </h2>
        <span className="text-xs text-[var(--text-muted)]">Ranked by award cap</span>
      </div>

      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
        Household income is{" "}
        <span className="tnum font-medium text-[var(--text-primary)]">
          {aid.fplPercent.toFixed(0)}%
        </span>{" "}
        of the {money(aid.guideline)} federal poverty guideline for this household size.
      </p>

      <ul className="mt-4 space-y-2.5">
        {aid.matched.map((p, i) => (
          <li
            key={p.id}
            className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
              <div className="min-w-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium text-[var(--series-1)] underline decoration-[var(--border-2)] underline-offset-2 hover:decoration-current"
                >
                  {p.name}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                  <span>
                    Income gate:{" "}
                    <span className="tnum">up to {p.maxFplPercent}% of poverty guideline</span>
                  </span>
                  <span className="text-[var(--text-muted)]">
                    Verified {p.lastVerified}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="tnum text-[15px] font-semibold text-[var(--text-primary)]">
                  {money(p.awardCap)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">annual cap</div>
              </div>
            </div>
            {i === 0 && (
              <p className="mt-2.5 border-t border-[var(--border-1)] pt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                Only this cap — the largest single one — is applied to the after-aid curve,
                once across the whole course of treatment. Caps are not summed, because
                programs frequently cannot be stacked. Nor is this annual cap assumed to
                renew if treatment crosses a plan year, because renewal depends on the fund
                still being open and on qualifying again. Both choices err the same way: they
                never overstate the relief available.
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Ranking by award cap is a deliberate simplification. A larger cap is not
        necessarily the easiest fund to win, the fastest to pay, or the best fit for a
        given patient.
      </p>
    </section>
  );
}
