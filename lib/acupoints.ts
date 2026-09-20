import raw from "@/data/acupoints.json";
import type { Acupoint, PointId } from "./types";

/**
 * The approved database. Nothing outside this file may invent a point: the
 * language model selects ids, and every word of location and technique text
 * shown to a user comes from here.
 */
export const ACUPOINTS = raw as unknown as Record<PointId, Acupoint>;

/** Fixed order, used for the legend and for deterministic tie-breaking. */
export const POINT_IDS = Object.keys(ACUPOINTS) as PointId[];

export function isPointId(value: unknown): value is PointId {
  return typeof value === "string" && Object.hasOwn(ACUPOINTS, value);
}

export function getPoint(id: PointId): Acupoint {
  return ACUPOINTS[id];
}

/** Drops anything the model hallucinated and de-duplicates, preserving order. */
export function coercePointIds(values: unknown): PointId[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<PointId>();
  for (const v of values) {
    if (isPointId(v)) seen.add(v);
  }
  return [...seen];
}
