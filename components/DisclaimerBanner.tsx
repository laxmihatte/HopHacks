/**
 * FR-14. Persistent, on every screen, not a footer and not dismissable.
 */
export default function DisclaimerBanner() {
  return (
    <div
      className="border-b px-4 py-2.5 text-center text-[13px] leading-snug"
      style={{
        background: "var(--warn-bg)",
        borderColor: "var(--warn-border)",
        color: "var(--warn-text)",
      }}
      role="note"
    >
      <strong className="font-semibold">Educational estimate only.</strong> This is not a
      quote, not a benefits determination, and not medical advice. No patient data is
      collected, stored, or transmitted — every calculation runs in your browser.
    </div>
  );
}
