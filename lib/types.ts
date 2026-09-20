import type { Vec3 } from "./anatomy";

/**
 * Every id the app will ever show. Kept as an explicit union rather than
 * derived from the JSON so that the model's tool schema, the router and the
 * tests all agree on one closed set; `data.test.ts` asserts it matches the
 * data file exactly.
 */
export type PointId =
  | "LI4"
  | "SI3"
  | "LU9"
  | "HT7"
  | "PC6"
  | "LU7"
  | "TE5"
  | "LI11"
  | "GB21"
  | "GB20"
  | "GV20"
  | "EX-HN5"
  | "EX-HN3"
  | "BL40"
  | "ST36"
  | "BL57"
  | "SP6"
  | "LR3";

/** Which part of the body a point sits on. Drives the anatomy assertions. */
export type Region =
  | "hand"
  | "wrist"
  | "forearm"
  | "elbow"
  | "shoulder"
  | "neck"
  | "head"
  | "knee"
  | "leg"
  | "calf"
  | "ankle"
  | "foot";

/** How hard to press. Ordered: light < moderate < firm < deep. */
export type Pressure = "light" | "moderate" | "firm" | "deep";

/**
 * Which body the points are shown on. This changes the figure's proportions
 * only — shoulder-to-hip ratio and chest — never the location of a point,
 * all five of which sit on the limbs and skull.
 */
export type Sex = "male" | "female";

export interface Acupoint {
  id: PointId;
  /** Pinyin name, e.g. "He Gu". */
  name: string;
  /** English gloss, e.g. "Union Valley". */
  translation: string;
  meridian: string;
  region: Region;
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
  /**
   * Unit direction from the point to where the camera should sit.
   *
   * Per-point rather than derived from `approach`, because points sit on all
   * four sides of a limb: viewing a point on the inner forearm from the
   * front-right puts the arm itself between the camera and the dot.
   */
  cameraDir: Vec3;
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
