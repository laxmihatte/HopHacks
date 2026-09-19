import type { Estimate } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * FR-15. Also serves as the chart's table view, so the data is never
 * available only as colour.
 */
export default function CycleTable({
  estimate,
  afterAidCumulative,
  hasAid,
}: {
  estimate: Estimate;
  afterAidCumulative: number[];
  hasAid: boolean;
}) {
  return (
    <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <h2 className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">
        Cycle-by-cycle breakdown
      </h2>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-2)] text-left text-xs text-[var(--text-muted)]">
              <th className="py-2 pr-3 font-medium">Cycle</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 text-right font-medium">Billed</th>
              <th className="py-2 pr-3 text-right font-medium">Deductible</th>
              <th className="py-2 pr-3 text-right font-medium">Coinsurance</th>
              <th className="py-2 pr-3 text-right font-medium">Patient pays</th>
              <th className="py-2 pr-3 text-right font-medium">Running total</th>
              {hasAid && <th className="py-2 text-right font-medium">After aid</th>}
            </tr>
          </thead>
          <tbody>
            {estimate.cycles.map((c, i) => (
              <tr
                key={c.index}
                className="border-b border-[var(--border-1)] last:border-0"
                style={
                  c.planYearReset
                    ? { borderTop: "2px dashed var(--text-secondary)" }
                    : undefined
                }
              >
                <td className="py-2 pr-3 tnum text-[var(--text-secondary)]">{c.index}</td>
                <td className="py-2 pr-3 text-[var(--text-secondary)]">
                  {shortDate(c.date)}
                  {c.planYearReset && (
                    <span className="ml-1.5 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      plan year resets
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--text-secondary)]">
                  {money(c.grossCost)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--text-secondary)]">
                  {money(c.deductibleApplied)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--text-secondary)]">
                  {money(c.coinsuranceApplied)}
                </td>
                <td className="py-2 pr-3 text-right tnum font-medium text-[var(--text-primary)]">
                  {money(c.patientPays)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--text-primary)]">
                  {money(c.cumulativePatientPays)}
                </td>
                {hasAid && (
                  <td className="py-2 text-right tnum text-[var(--text-primary)]">
                    {money(afterAidCumulative[i])}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border-2)] font-semibold">
              <td className="py-2.5 pr-3" colSpan={2}>
                Total
              </td>
              <td className="py-2.5 pr-3 text-right tnum">{money(estimate.totalGross)}</td>
              <td className="py-2.5 pr-3" colSpan={2} />
              <td className="py-2.5 pr-3 text-right tnum">
                {money(estimate.totalPatientPays)}
              </td>
              <td className="py-2.5 pr-3 text-right tnum">
                {money(estimate.totalPatientPays)}
              </td>
              {hasAid && (
                <td className="py-2.5 text-right tnum">
                  {money(afterAidCumulative.at(-1) ?? 0)}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
