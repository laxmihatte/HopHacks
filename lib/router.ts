import { ACUPOINTS, POINT_IDS } from "./acupoints";
import type { Match, PointId } from "./types";

/** Never recommend a wall of points; the routine has to stay doable. */
export const MAX_POINTS = 3;

/**
 * Lowercase, strip punctuation, collapse whitespace. Keeps letters, digits and
 * single spaces so that phrase matching can rely on word boundaries.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whole-word phrase test, so "stress" does not fire on "distressed". */
function containsPhrase(haystack: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  return ` ${haystack} `.includes(` ${p} `);
}

/**
 * The offline router: a deterministic phrase matcher over the same `symptoms`
 * lists the model is shown.
 *
 * This exists so the demo cannot fail. It runs when no API key is configured
 * and whenever the model call errors out, and it is what the unit tests pin.
 * Longer phrases score higher, so "tension headache" outranks a bare "tension".
 */
export function routeByKeyword(text: string): Match[] {
  const hay = normalize(text);
  if (!hay) return [];

  const scored: { id: PointId; score: number; matched: string[] }[] = [];

  for (const id of POINT_IDS) {
    const matched: string[] = [];
    let score = 0;
    for (const symptom of ACUPOINTS[id].symptoms) {
      if (!containsPhrase(hay, symptom)) continue;
      matched.push(symptom);
      // Weight by word count: a two-word hit is much stronger evidence than a
      // one-word hit that happens to be shared by several points.
      score += normalize(symptom).split(" ").length ** 2;
    }
    if (score > 0) scored.push({ id, score, matched });
  }

  return scored
    .sort((a, b) => b.score - a.score || POINT_IDS.indexOf(a.id) - POINT_IDS.indexOf(b.id))
    .slice(0, MAX_POINTS)
    .map(({ id, matched }) => ({ id, matched }));
}

/**
 * The sentence shown in the chat. Assembled from the database, never from the
 * model, so the wording cannot drift into medical advice.
 */
export function describe(matches: Match[]): string {
  if (matches.length === 0) {
    return "I could not map that to a point in my library yet. Try naming the sensation and where it is — for example \"tension headache and a stiff neck\".";
  }
  const parts = matches.map((m) => {
    const p = ACUPOINTS[m.id];
    // Quote the most specific phrase the user actually used: "tension
    // headache" is a better justification than the bare "headache" that also
    // matched.
    const why =
      [...m.matched].sort((a, b) => b.length - a.length)[0] ?? p.symptoms[0];
    return `${p.id} (${p.name}) for ${why}`;
  });
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `I recommend ${list}. Tap a red point on the model for how to press it.`;
}
