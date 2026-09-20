"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { step } from "@/lib/pressure";
import type { Acupoint } from "@/lib/types";
import Metronome, { type Phase } from "./Metronome";

export default function DetailsPanel({
  point,
  onClose,
  onPhase,
}: {
  point: Acupoint | null;
  onClose: () => void;
  onPhase: (phase: Phase) => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const depth = point ? step(point.pressure) : null;

  // Escape closes, and focus moves into the panel when it opens, so the panel
  // is operable without a mouse.
  useEffect(() => {
    if (!point) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [point, onClose]);

  return (
    <AnimatePresence>
      {point && (
        <motion.aside
          key={point.id}
          className="details"
          aria-label={`${point.id} details`}
          initial={{ x: "100%", opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.2 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
        >
          <header className="details-head">
            <div>
              <p className="eyebrow">
                {point.id} · {point.meridian} meridian
              </p>
              <h2 className="details-name">{point.name}</h2>
              <p className="details-translation">“{point.translation}”</p>
            </div>
            <button
              ref={close}
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close details"
            >
              ✕
            </button>
          </header>

          <div className="details-body">
            {depth && (
              <div
                className="depth"
                style={{ "--dot": depth.color, "--dot-glow": depth.glow } as React.CSSProperties}
              >
                <div className="depth-head">
                  <span className="depth-dot" aria-hidden="true" />
                  <p className="eyebrow">Pressure depth</p>
                  <strong>{depth.label}</strong>
                </div>
                <p>{depth.force}</p>
              </div>
            )}

            <div className="field">
              <p className="eyebrow">Exact location</p>
              <p>{point.location}</p>
            </div>
            <div className="field">
              <p className="eyebrow">Technique</p>
              <p>{point.technique}</p>
            </div>
            <div className="field">
              <p className="eyebrow">Commonly used for</p>
              <ul className="tags">
                {point.symptoms.slice(0, 6).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            {point.caution && (
              <p className="caution" role="note">
                <strong>Caution.</strong> {point.caution}
              </p>
            )}

            <Metronome pointLabel={`${point.id}, ${point.name}`} onPhase={onPhase} />

            <p className="details-foot">
              Acupressure is a self-care practice, not a treatment. Stop if pressing hurts,
              and see a clinician for pain that is new, severe, or persistent.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
