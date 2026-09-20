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
    <section className="rule pt-7">
      <p className="eyebrow">The arithmetic</p>
      <h2 className="display mt-1.5 mb-5 text-[24px] font-semibold">
        Cycle by cycle
      </h2>
      <div className="-mx-6 overflow-x-auto px-6">
        <table className="w-full min-w-[620px] border-collapse text-[13px]">
          <caption className="sr-only">
            Cost per treatment cycle: date, amount billed, deductible applied, coinsurance,
            what the patient pays, and the running total.
          </caption>
          <thead>
            <tr className="border-b border-[var(--rule-strong)] text-left text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
              <th scope="col" className="py-2 pr-3 font-medium">Cycle</th>
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Billed</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Deductible</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Coinsurance</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Patient pays</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Running total</th>
              {hasAid && <th scope="col" className="py-2 text-right font-medium">After aid</th>}
            </tr>
          </thead>
          <tbody>
            {estimate.cycles.map((c, i) => (
              <tr
                key={c.index}
                className="border-b border-[var(--rule)] last:border-0"
                style={
                  c.planYearReset
                    ? { borderTop: "2px dashed var(--ink-2)" }
                    : undefined
                }
              >
                <th scope="row" className="py-2 pr-3 text-left font-normal tnum text-[var(--ink-2)]">
                  {c.index}
                </th>
                <td className="py-2 pr-3 text-[var(--ink-2)]">
                  {shortDate(c.date)}
                  {c.planYearReset && (
                    <span className="ml-1.5 border border-[var(--rule-strong)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-2)]">
                      plan year restarts
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--ink-2)]">
                  {money(c.grossCost)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--ink-2)]">
                  {money(c.deductibleApplied)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--ink-2)]">
                  {money(c.coinsuranceApplied)}
                </td>
                <td className="py-2 pr-3 text-right tnum font-medium text-[var(--ink)]">
                  {money(c.patientPays)}
                </td>
                <td className="py-2 pr-3 text-right tnum text-[var(--ink)]">
                  {money(c.cumulativePatientPays)}
                </td>
                {hasAid && (
                  <td className="py-2 text-right tnum text-[var(--ink)]">
                    {money(afterAidCumulative[i])}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--rule-strong)] font-semibold">
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
