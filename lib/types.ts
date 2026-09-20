import type { Vec3 } from "./anatomy";

export type PointId = "LI4" | "GB20" | "PC6" | "ST36" | "SP6";

/** How hard to press. Ordered: light < moderate < firm < deep. */
export type Pressure = "light" | "moderate" | "firm" | "deep";

/**
 * Which body the points are shown on. This changes the figure's proportions
 * only — shoulder-to-hip ratio and chest — never the location of a point,
 * all five of which sit on the limbs and skull.
 */
export type Sex = "male" | "female";

/** Which face of the model the camera has to be on to see the point. */
export type Approach = "front" | "back";

export interface Acupoint {
  id: PointId;
  /** Pinyin name, e.g. "He Gu". */
  name: string;
  /** English gloss, e.g. "Union Valley". */
  translation: string;
  meridian: string;
  region: string;
  /** Lay-language complaints this point is used for; the router matches on these. */
  symptoms: string[];
  location: string;
  technique: string;
  /** How hard to press, rendered as a red depth ramp on the model. */
  pressure: Pressure;
  coords3D: Vec3;
  cameraTarget: Vec3;
  /** How far back the camera sits from the target. Small points need to be closer. */
  cameraDistance: number;
  approach: Approach;
  /** True when the point exists on both sides and should render a mirrored twin. */
  bilateral: boolean;
  caution: string | null;
}

/** One point the router chose, with the evidence for why. */
export interface Match {
  id: PointId;
  /** The user's own words that triggered this point, for display in the chat. */
  matched: string[];
}

export type RouterSource = "claude" | "keyword";

export interface Recommendation {
  points: Acupoint[];
  matches: Match[];
  /** Which router produced this — surfaced in the UI so the demo never lies. */
  source: RouterSource;
  /** Present when the model was asked but could not be used. */
  note?: string;
}

/** Chat transcript entry. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Point ids referenced by an assistant turn, rendered as inline chips. */
  pointIds?: PointId[];
}
