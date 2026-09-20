export default function DisclaimerBanner() {
  return (
    <div
      className="border-b px-6 py-2 text-center text-[12.5px] leading-snug"
      style={{
        background: "var(--flag-bg)",
        borderColor: "var(--flag-rule)",
        color: "var(--flag-ink)",
      }}
      role="note"
    >
      <strong className="font-semibold">Educational estimate.</strong> Not a quote, not a
      benefits determination, not medical advice. Nothing you enter is collected, stored,
      or transmitted.
    </div>
  );
}
