import type { Regimen } from "@/lib/types";

const LIMITATIONS: { what: string; effect: string }[] = [
  {
    what: "Medicare payment limits stand in for commercial reimbursement",
    effect:
      "Commercial plans generally pay more than Medicare, so a commercial patient's real bill is likely higher than shown.",
  },
  {
    what: "Network status is not modeled",
    effect: "Out-of-network care would cost substantially more.",
  },
  {
    what: "Prior authorization is not modeled",
    effect: "Denials and delays are not represented.",
  },
  {
    what: "Drug tiering and the pharmacy benefit are not modeled",
    effect: "Oral agents are billed differently and would behave differently.",
  },
  {
    what: "Hospital-specific pricing is not used",
    effect:
      "Facility markup and the hospital's own posted prices are excluded; only drug payment limits and a flat administration figure are counted.",
  },
  {
    what: "Aid programs change availability frequently",
    effect:
      "A fund listed as open may have closed since it was last checked. Each card shows its own verification date.",
  },
  {
    what: "Alaska and Hawaii poverty guidelines are excluded",
    effect: "The federal poverty percentage is wrong for those two states.",
  },
  {
    what: "The plan year is assumed to start January 1",
    effect: "Wrong for plans on a non-calendar plan year.",
  },
  {
    what: "Only the single largest award cap is applied, never the sum",
    effect:
      "Programs frequently cannot be stacked. Summing them would overstate relief — the one direction this tool must never err in.",
  },
  {
    what: "Doses are computed at a standard body surface area of 1.7 m²",
    effect: "A patient's actual dose is weight- and height-dependent.",
  },
];

export default function AssumptionsBlock({ regimen }: { regimen: Regimen }) {
  return (
    <section className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
        What this estimate does not include
      </h2>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Every one of these is a deliberate exclusion, not an oversight.
      </p>

      <ul className="mt-4 space-y-2.5">
        {LIMITATIONS.map((l) => (
          <li key={l.what} className="text-[13px] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">{l.what}.</span>{" "}
            <span className="text-[var(--text-secondary)]">{l.effect}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1.5 border-t border-[var(--border-1)] pt-4 text-xs text-[var(--text-muted)]">
        <p>
          <span className="font-medium text-[var(--text-secondary)]">Drug prices:</span>{" "}
          {regimen.sourceNote}
        </p>
        <p>
          <span className="font-medium text-[var(--text-secondary)]">Administration cost:</span>{" "}
          {regimen.adminSourceNote}
        </p>
      </div>
    </section>
  );
}
