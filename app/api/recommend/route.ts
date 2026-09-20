import Anthropic from "@anthropic-ai/sdk";
import { POINT_IDS, getPoint, isPointId } from "@/lib/acupoints";
import { ROUTER_TOOL, systemPrompt } from "@/lib/prompt";
import { MAX_POINTS, describe, routeByKeyword } from "@/lib/router";
import type { Match, PointId, Recommendation } from "@/lib/types";

/** Fast and cheap: the task is closed-set classification, not generation. */
const MODEL = "claude-haiku-4-5-20251001";
const MAX_SYMPTOM_CHARS = 600;

export const runtime = "nodejs";

function build(matches: Match[], source: Recommendation["source"], note?: string) {
  const rec: Recommendation = {
    points: matches.map((m) => getPoint(m.id)),
    matches,
    source,
    ...(note ? { note } : {}),
  };
  return Response.json({ ...rec, reply: describe(matches) });
}

/** Reads the tool call out of the response, tolerating a text-only answer. */
function parseMatches(message: Anthropic.Message): Match[] {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === ROUTER_TOOL.name) {
      return normalizeMatches((block.input as { recommendedPoints?: unknown }).recommendedPoints);
    }
  }
  // The model answered in prose despite the tool. Try to salvage JSON from it
  // rather than throwing away a usable answer.
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return [];
  try {
    const parsed = JSON.parse(json[0]) as { recommendedPoints?: unknown };
    return normalizeMatches(parsed.recommendedPoints);
  } catch {
    return [];
  }
}

/**
 * Accepts either the rich `{id, matched}` form or a bare array of id strings,
 * since a model that ignores the schema usually falls back to the latter.
 */
function normalizeMatches(value: unknown): Match[] {
  if (!Array.isArray(value)) return [];
  const out: Match[] = [];
  const seen = new Set<PointId>();
  for (const entry of value) {
    let id: unknown;
    let matched: string[] = [];
    if (typeof entry === "string") {
      id = entry;
    } else if (entry && typeof entry === "object") {
      id = (entry as { id?: unknown }).id;
      const m = (entry as { matched?: unknown }).matched;
      if (Array.isArray(m)) matched = m.filter((s): s is string => typeof s === "string");
    }
    if (!isPointId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, matched });
  }
  return out.slice(0, MAX_POINTS);
}

export async function POST(request: Request) {
  let symptoms = "";
  try {
    const body = (await request.json()) as { symptoms?: unknown };
    if (typeof body.symptoms === "string") symptoms = body.symptoms.trim();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!symptoms) {
    return Response.json({ error: "Describe a symptom first." }, { status: 400 });
  }
  symptoms = symptoms.slice(0, MAX_SYMPTOM_CHARS);

  const keyword = routeByKeyword(symptoms);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No key configured: this is the documented offline path, not an error. The
  // hackathon demo has to survive a dead conference network.
  if (!apiKey) {
    return build(keyword, "keyword");
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt(),
        tools: [ROUTER_TOOL],
        tool_choice: { type: "tool", name: ROUTER_TOOL.name },
        messages: [{ role: "user", content: symptoms }],
      },
      { timeout: 12_000, maxRetries: 1 },
    );

    const matches = parseMatches(message);
    // An empty result from the model is ambiguous: it can mean "genuinely
    // nothing fits" or a silent schema miss. If our own matcher found
    // something, trust the matcher.
    if (matches.length === 0 && keyword.length > 0) {
      return build(keyword, "keyword", "The model returned no points, so I used direct symptom matching.");
    }
    return build(matches, "claude");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return build(keyword, "keyword", `Model unavailable (${reason}), so I used direct symptom matching.`);
  }
}

/** Lets the UI show an honest "AI / offline" badge before the first message. */
export async function GET() {
  return Response.json({
    model: MODEL,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    pointCount: POINT_IDS.length,
  });
}
