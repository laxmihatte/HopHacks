import type { AidResult } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function ProgramList({ aid }: { aid: AidResult }) {
  if (aid.matched.length === 0) {
    return (
      <section className="card p-7 sm:p-9">
        <p className="eyebrow">Assistance</p>
        <h2 className="display mt-1.5 text-[26px] sm:text-[30px]">
          Assistance programs
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
          No programs in this list matched these inputs. At{" "}
          <span className="tnum font-medium text-[var(--ink)]">
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
    <section className="card p-7 sm:p-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="eyebrow">Assistance</p>
          <h2 className="display mt-1.5 text-[26px] sm:text-[30px]">
            {aid.matched.length} {aid.matched.length === 1 ? "program" : "programs"} this
            household may qualify for
          </h2>
        </div>
        <span className="text-[12px] text-[var(--ink-3)]">Ranked by award cap</span>
      </div>

      <p className="mt-1.5 text-[13px] text-[var(--ink-2)]">
        Household income is{" "}
        <span className="tnum font-medium text-[var(--ink)]">
          {aid.fplPercent.toFixed(0)}%
        </span>{" "}
        of the {money(aid.guideline)} federal poverty guideline for this household size.
      </p>

      <ul className="mt-5">
        {aid.matched.map((p, i) => (
          <li
            key={p.id}
            className="rule py-3.5 first:border-t-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
              <div className="min-w-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="display text-[17px] font-semibold text-[var(--ink)] underline decoration-[var(--rule-strong)] underline-offset-[3px] hover:decoration-[var(--accent)]"
                >
                  {p.name}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-2)]">
                  <span>
                    Income gate:{" "}
                    <span className="tnum">up to {p.maxFplPercent}% of poverty guideline</span>
                  </span>
                  <span className="text-[var(--ink-3)]">
                    Verified {p.lastVerified}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="display tnum text-[19px] font-semibold text-[var(--ink)]">
                  {money(p.awardCap)}
                </div>
                <div className="text-[11px] text-[var(--ink-3)]">annual cap</div>
              </div>
            </div>
            {i === 0 && (
              <p className="mt-2.5 max-w-[70ch] text-[11.5px] leading-relaxed text-[var(--ink-2)]">
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

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-3)]">
        Ranking by award cap is a deliberate simplification. A larger cap is not
        necessarily the easiest fund to win, the fastest to pay, or the best fit for a
        given patient.
      </p>
    </section>
  );
}
