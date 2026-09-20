import { ACUPOINTS, POINT_IDS } from "./acupoints";

/**
 * The router prompt. Two properties matter more than the wording:
 *
 *  1. The model's entire output is a list of ids from a closed set. It never
 *     writes the location or the technique — that text is looked up from
 *     data/acupoints.json after the call — so a hallucination can only ever
 *     produce a wrong-but-safe point, never invented medical instructions.
 *  2. Anything that is not one of the approved ids is dropped by
 *     `coercePointIds`, so a malformed response degrades to the keyword router
 *     instead of reaching the user.
 */
export function systemPrompt(): string {
  const catalogue = POINT_IDS.map((id) => {
    const p = ACUPOINTS[id];
    return `${id} — ${p.name}, on the ${p.region}. Used for: ${p.symptoms.join(", ")}.`;
  }).join("\n");

  return `You are an acupressure routing engine. The user will describe physical symptoms in their own words.

Map their symptoms to the EXACT keys in this approved database:
${catalogue}

Rules:
- Choose at most 3 keys, most relevant first.
- Choose only keys that address something the user actually described. If nothing fits, return an empty array.
- For each key, quote the user's own words that justify it, verbatim, in "matched".
- Return ONLY a valid JSON object of the form {"recommendedPoints":[{"id":"LI4","matched":["tension headache"]}]}.
- Do not include markdown, code fences, explanations, or any text outside the JSON.
- Never write location or technique text. You select keys only.`;
}

/** Shape the model is asked to return, enforced as a tool schema. */
export const ROUTER_TOOL = {
  name: "recommend_points",
  description:
    "Return the approved acupoint keys that match the user's described symptoms.",
  input_schema: {
    type: "object" as const,
    properties: {
      recommendedPoints: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: POINT_IDS },
            matched: {
              type: "array",
              items: { type: "string" },
              description: "The user's own words justifying this point.",
            },
          },
          required: ["id", "matched"],
        },
      },
    },
    required: ["recommendedPoints"],
  },
};
