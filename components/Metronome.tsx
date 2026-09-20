"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const PRESS_SECONDS = 3;
export const RELEASE_SECONDS = 1;
export const CYCLE_SECONDS = PRESS_SECONDS + RELEASE_SECONDS;
export const ROUTINE_SECONDS = 120;

export type Phase = "press" | "release" | "idle";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The 2-minute routine: press 3s, release 1s, thirty times.
 *
 * Driven from a single wall-clock origin rather than an accumulating
 * `setInterval`, so the rhythm cannot drift out of sync with the audio cue
 * when the main thread stalls — which it will, with a 3D scene rendering
 * beside it.
 */
export default function Metronome({
  pointLabel,
  onPhase,
}: {
  pointLabel: string;
  onPhase: (phase: Phase) => void;
}) {
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(ROUTINE_SECONDS);
  const [phase, setPhase] = useState<Phase>("idle");

  const origin = useRef(0);
  const lastPhase = useRef<Phase>("idle");
  const audio = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const beep = useCallback((kind: Phase) => {
    if (mutedRef.current || !audio.current) return;
    const ctx = audio.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // A fifth apart: low tone to begin pressing, higher to let go.
    osc.frequency.value = kind === "press" ? 320 : 480;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    setPhase("idle");
    lastPhase.current = "idle";
    setRemaining(ROUTINE_SECONDS);
    onPhase("idle");
  }, [onPhase]);

  const start = useCallback(() => {
    // Must happen inside the click handler: a context created any later starts
    // suspended and the cue is silent for the whole demo.
    if (!audio.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) audio.current = new Ctor();
    }
    void audio.current?.resume();
    origin.current = performance.now();
    lastPhase.current = "idle";
    setRemaining(ROUTINE_SECONDS);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;

    const tick = () => {
      const elapsed = (performance.now() - origin.current) / 1000;
      if (elapsed >= ROUTINE_SECONDS) {
        stop();
        return;
      }
      setRemaining(ROUTINE_SECONDS - elapsed);

      const within = elapsed % CYCLE_SECONDS;
      const next: Phase = within < PRESS_SECONDS ? "press" : "release";
      if (next !== lastPhase.current) {
        lastPhase.current = next;
        setPhase(next);
        onPhase(next);
        beep(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, beep, onPhase, stop]);

  useEffect(() => () => void audio.current?.close(), []);

  const cycle = running ? Math.floor((ROUTINE_SECONDS - remaining) / CYCLE_SECONDS) + 1 : 0;
  const total = ROUTINE_SECONDS / CYCLE_SECONDS;
  const progress = ((ROUTINE_SECONDS - remaining) / ROUTINE_SECONDS) * 100;

  return (
    <section className="metronome" aria-label="Pressing routine">
      <header className="metronome-head">
        <div>
          <p className="eyebrow">2-minute routine</p>
          <p className="metronome-clock tnum">{clock(remaining)}</p>
        </div>
        <div className="metronome-buttons">
          <button type="button" className="btn-primary" onClick={running ? stop : start}>
            {running ? "Stop" : "Start 2-min routine"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={muted}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </header>

      <div
        className="metronome-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Routine progress"
      >
        <span className="metronome-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* The rhythm is announced politely so a screen-reader user gets the cue
          too, rather than only the sighted pulse and the audio tone. */}
      <p className={`metronome-cue ${phase}`} role="status" aria-live="polite">
        {running
          ? phase === "press"
            ? `Press — ${pointLabel}`
            : "Release"
          : `Press ${PRESS_SECONDS}s, release ${RELEASE_SECONDS}s · ${total} rounds`}
      </p>
      {running && (
        <p className="metronome-count tnum">
          Round {Math.min(cycle, total)} of {total}
        </p>
      )}
    </section>
  );
}
