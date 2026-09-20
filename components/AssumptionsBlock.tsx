import type { Regimen } from "@/lib/types";

const monthDay = (md: string) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(Date.UTC(2001, m - 1, d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  });
};

const LIMITATIONS: { what: string; effect: string }[] = [
  {
    what: "Medicare payment limits stand in for commercial reimbursement",
    effect:
      "Commercial plans generally pay more than Medicare, so a commercial patient's real bill is likely higher than shown.",
  },
  { what: "Network status is not modelled", effect: "Out-of-network care would cost substantially more." },
  { what: "Prior authorisation is not modelled", effect: "Denials and delays are not represented." },
  {
    what: "Drug tiering and the pharmacy benefit are not modelled",
    effect: "Oral agents are billed differently and would behave differently.",
  },
  {
    what: "Hospital-specific pricing is not used",
    effect:
      "Facility markup and your hospital's own posted prices are excluded; only drug payment limits and a flat administration figure are counted.",
  },
  {
    what: "Aid programs change availability frequently",
    effect: "A fund listed as open may have closed since it was last checked. Each entry shows its own date.",
  },
  {
    what: "Alaska and Hawaii poverty guidelines are excluded",
    effect: "The federal poverty percentage is wrong for those two states.",
  },
  {
    what: "Only the single largest award cap is applied, never the sum",
    effect:
      "Programs frequently cannot be stacked. Summing them would overstate relief — the one direction this tool must never err in.",
  },
  {
    what: "That cap is applied once across the whole course, even across a plan year",
    effect:
      "Award caps are annual, so a patient who re-applies successfully in a second year could receive more aid than shown. Renewal is not assumed, because it depends on the fund still being open and on qualifying again.",
  },
  {
    what: "Doses are computed at a standard body surface area of 1.7 m²",
    effect: "Your actual dose is weight- and height-dependent.",
  },
  {
    what: "The start-date comparison weighs money only",
    effect:
      "Delaying treatment carries clinical risk this tool does not model. Only your oncologist can say which dates are acceptable.",
  },
];

export default function AssumptionsBlock({
  regimen,
  planYearStart,
}: {
  regimen: Regimen;
  planYearStart: string;
}) {
  return (
    <section className="rule pt-7">
      <p className="eyebrow">Limits of this estimate</p>
      <h2 className="display mt-1.5 text-[24px] font-semibold">
        What this does not include
      </h2>
      <p className="mt-2 max-w-[62ch] text-[14px] text-[var(--ink-2)]">
        Every one of these is a deliberate exclusion, not an oversight.
      </p>

      <dl className="mt-6 max-w-[74ch]">
        {LIMITATIONS.map((l) => (
          <div key={l.what} className="rule py-3 first:border-t-0 first:pt-0">
            <dt className="text-[14px] font-medium">{l.what}</dt>
            <dd className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
              {l.effect}
            </dd>
          </div>
        ))}
      </dl>

      <div className="rule mt-6 space-y-1.5 pt-5 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
        <p>
          <span className="font-medium text-[var(--ink-2)]">Plan year:</span> this estimate
          restarts your deductible and out-of-pocket maximum on{" "}
          {monthDay(planYearStart)}, as you entered. Confirm it against your plan documents —
          it is the single largest controllable swing in what you owe.
        </p>
        <p>
          <span className="font-medium text-[var(--ink-2)]">Drug prices:</span>{" "}
          {regimen.sourceNote}
        </p>
        <p>
          <span className="font-medium text-[var(--ink-2)]">Administration:</span>{" "}
          {regimen.adminSourceNote}
        </p>
      </div>
    </section>
  );
}
