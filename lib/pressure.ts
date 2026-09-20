import type { Pressure } from "./types";

/**
 * How hard to press, as an ordered four-step scale.
 *
 * Because depth is ordinal, it is encoded as a *sequential* ramp — one hue,
 * pale to deep — not four unrelated colours. Lightness carries the magnitude,
 * so the order survives greyscale, projector washout and colour-vision
 * deficiency alike.
 *
 * Colour is never the only channel: each step also has a ring width, a name
 * and a plain-language force description, all of which are shown in the UI.
 */
export const PRESSURE_ORDER: Pressure[] = ["light", "moderate", "firm", "deep"];

export interface PressureStep {
  /** The mark colour. Rose 200 → 700: one hue, four lightness steps. */
  color: string;
  /** Halo colour, widened with depth so the ramp is legible without hue. */
  glow: string;
  /** Ring thickness in px — the redundant, non-colour encoding of depth. */
  ring: number;
  label: string;
  /** What the force actually feels like, so "deep" is not left to guess. */
  force: string;
}

export const PRESSURE: Record<Pressure, PressureStep> = {
  light: {
    color: "#fecdd3",
    glow: "rgba(254, 205, 211, 0.55)",
    ring: 1,
    label: "Light",
    force: "Skin-deep. Enough to dimple the surface, no more — the tissue here is thin over bone.",
  },
  moderate: {
    color: "#fb7185",
    glow: "rgba(251, 113, 133, 0.6)",
    ring: 1.5,
    label: "Moderate",
    force: "Steady and noticeable. You should feel a dull ache, never a sharp pain.",
  },
  firm: {
    color: "#e11d48",
    glow: "rgba(225, 29, 72, 0.7)",
    ring: 2,
    label: "Firm",
    force: "Lean into it with the pad of the thumb. Strong enough that the muscle pushes back.",
  },
  deep: {
    color: "#be123c",
    glow: "rgba(190, 18, 60, 0.85)",
    ring: 2.75,
    label: "Deep",
    force: "Full thumb or knuckle weight, into the belly of the muscle. Back off if it sharpens.",
  },
};

export function step(pressure: Pressure): PressureStep {
  return PRESSURE[pressure];
}
