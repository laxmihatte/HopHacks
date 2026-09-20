"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  ANKLE,
  BONE,
  BUILD,
  CLOTHING,
  ELBOW,
  FINGERS,
  HAND,
  HEAD,
  HIP,
  KNEE,
  KNUCKLE_Y,
  LIMB,
  NECK,
  SHOULDER,
  WRIST,
  type Vec3,
} from "@/lib/anatomy";
import type { Sex } from "@/lib/types";

const SKIN = "#c3ab9b";
const SKIN_SHADE = "#b09a8b";
const BONE_COLOUR = "#efe7d8";
const FEATURE = "#6b5a50";
const FABRIC_TOP = "#4a5a72";
const FABRIC_LEGS = "#39465c";

const SEG = 20;

/** Opaque skin, for the head and neck where a visible skull would only be
 *  distracting and the face has to stay readable. */
function Clay({ color = SKIN }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.88} metalness={0.02} />;
}

/**
 * Translucent skin, for the bare limbs.
 *
 * Bones are opaque, so three.js draws them in the opaque pass before this
 * material blends over them — which is what produces the anatomical-chart
 * look. `depthWrite` is off so overlapping skin pieces (palm against fingers)
 * do not z-fight with each other.
 */
function Flesh({ color = SKIN }: { color?: string }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.85}
      metalness={0.02}
      transparent
      opacity={0.66}
      depthWrite={false}
    />
  );
}

function Fabric({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.95} metalness={0} />;
}

/** Faintly self-lit, so the bones read through the skin without a light on them. */
function BoneMat() {
  return (
    <meshStandardMaterial
      color={BONE_COLOUR}
      roughness={0.6}
      metalness={0.05}
      emissive={BONE_COLOUR}
      emissiveIntensity={0.12}
    />
  );
}

type Material = "flesh" | "clay" | "bone" | "fabric-top" | "fabric-legs";

function Surface({ kind }: { kind: Material }) {
  if (kind === "bone") return <BoneMat />;
  if (kind === "clay") return <Clay />;
  if (kind === "fabric-top") return <Fabric color={FABRIC_TOP} />;
  if (kind === "fabric-legs") return <Fabric color={FABRIC_LEGS} />;
  return <Flesh />;
}

/** A tapered segment between two points, with optional joint caps. */
function Seg({
  from,
  to,
  rFrom,
  rTo,
  kind = "flesh",
  caps = true,
}: {
  from: Vec3;
  to: Vec3;
  rFrom: number;
  rTo: number;
  kind?: Material;
  caps?: boolean;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    return {
      position: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      ),
      length: dir.length(),
    };
  }, [from, to]);

  return (
    <group>
      <mesh position={position} quaternion={quaternion}>
        {/* The +Y end maps to `to`, so radiusTop is rTo. */}
        <cylinderGeometry args={[rTo, rFrom, length, SEG]} />
        <Surface kind={kind} />
      </mesh>
      {caps && (
        <>
          <mesh position={from}>
            <sphereGeometry args={[rFrom, SEG, 12]} />
            <Surface kind={kind} />
          </mesh>
          <mesh position={to}>
            <sphereGeometry args={[rTo, SEG, 12]} />
            <Surface kind={kind} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * A capsule between two points — rounded at both ends, one mesh.
 *
 * Used for fingers, thumb and bones. A cylinder's flat ends are invisible at
 * body scale but read as floating slabs once the camera closes to 40cm, which
 * is exactly where the demo spends its time.
 */
function Tube({
  from,
  to,
  r,
  kind = "flesh",
}: {
  from: Vec3;
  to: Vec3;
  r: number;
  kind?: Material;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    return {
      position: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      ),
      // Capsule length excludes the hemispherical caps.
      length: Math.max(dir.length() - r * 2, 0.001),
    };
  }, [from, to, r]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <capsuleGeometry args={[r, length, 4, 14]} />
      <Surface kind={kind} />
    </mesh>
  );
}

/**
 * One joint sphere.
 *
 * Translucent segments must not cap themselves: where two caps overlap, the
 * blend doubles and the joint reads as a bright plastic ball. Each joint is
 * therefore drawn exactly once.
 */
function Joint({ at, r, kind = "flesh" }: { at: Vec3; r: number; kind?: Material }) {
  return (
    <mesh position={at}>
      <sphereGeometry args={[r, SEG, 14]} />
      <Surface kind={kind} />
    </mesh>
  );
}

/** Linear interpolation of a limb's radius at a given height. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Trunk({ sex }: { sex: Sex }) {
  const build = BUILD[sex];
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      build.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    );
    const points = curve.getPoints(40).map((p) => new THREE.Vector2(Math.max(p.x, 0.001), p.y));
    return new THREE.LatheGeometry(points, SEG);
  }, [build.profile]);

  return (
    <group>
      {/* The trunk itself is the tee: opaque fabric, so nothing shows through. */}
      <mesh geometry={geometry} scale={[1, 1, build.depth]}>
        <Fabric color={FABRIC_TOP} />
      </mesh>

      {[1, -1].map((s) => (
        <group key={s}>
          {/* Trapezius bridge, or the deltoids read as floating balls. */}
          <Seg
            from={[s * 0.028, 1.435, 0]}
            to={[s * build.shoulderX, SHOULDER.y, 0]}
            rFrom={0.052}
            rTo={LIMB.shoulderJoint}
            kind="fabric-top"
          />
          <mesh position={[s * build.shoulderX, SHOULDER.y, 0]}>
            <sphereGeometry args={[LIMB.shoulderJoint, SEG, 14]} />
            <Fabric color={FABRIC_TOP} />
          </mesh>
        </group>
      ))}

      {build.bust > 0 &&
        [1, -1].map((s) => (
          <mesh key={s} position={[s * 0.058, 1.252, build.depth * 0.058]} scale={[1.1, 0.85, 0.52]}>
            <sphereGeometry args={[build.bust, SEG, 14]} />
            <Fabric color={FABRIC_TOP} />
          </mesh>
        ))}

      {/* Waistband and seat only. Each thigh is clothed separately below this,
          which is what reads as shorts rather than a skirt. */}
      <mesh position={[0, 0.865, 0]} scale={[1, 1, build.depth + 0.05]}>
        <cylinderGeometry args={[build.hipX + 0.062, build.hipX + 0.052, 0.1, SEG]} />
        <Fabric color={FABRIC_LEGS} />
      </mesh>
    </group>
  );
}

function Head() {
  const r = HEAD.r;
  return (
    <group position={[0, HEAD.y, 0]}>
      <mesh scale={[0.94, 1.12, 1]}>
        <sphereGeometry args={[r, 32, 24]} />
        <Clay />
      </mesh>
      <mesh position={[0, -r * 0.62, r * 0.14]} scale={[0.82, 0.62, 0.9]}>
        <sphereGeometry args={[r * 0.82, 24, 18]} />
        <Clay />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * r * 0.35, r * 0.12, r * 0.88]} scale={[1.4, 0.6, 0.35]}>
          <sphereGeometry args={[r * 0.11, 14, 10]} />
          <meshStandardMaterial color={FEATURE} roughness={0.6} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={`b${s}`} position={[s * r * 0.34, r * 0.3, r * 0.85]} scale={[1.7, 0.25, 0.3]}>
          <sphereGeometry args={[r * 0.12, 14, 10]} />
          <meshStandardMaterial color={FEATURE} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -r * 0.1, r * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[r * 0.13, r * 0.3, 10]} />
        <Clay color={SKIN_SHADE} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={`e${s}`} position={[s * r * 0.9, 0, 0]} scale={[0.4, 1, 0.65]}>
          <sphereGeometry args={[r * 0.28, 12, 10]} />
          <Clay color={SKIN_SHADE} />
        </mesh>
      ))}
    </group>
  );
}

/** The bones inside one side's limbs. Opaque, so the skin blends over them. */
function Skeleton({ s, sex }: { s: 1 | -1; sex: Sex }) {
  const build = BUILD[sex];
  const split = BONE.forearmSplit;

  return (
    <group>
      <Seg
        from={[s * build.shoulderX, SHOULDER.y - 0.02, 0]}
        to={[s * ELBOW.x, ELBOW.y, 0]}
        rFrom={BONE.humerus}
        rTo={BONE.humerus * 0.85}
        kind="bone"
        caps={false}
      />
      {/* Radius on the thumb side, ulna on the little-finger side. The radius
          is slender at the elbow and broad at the wrist; the ulna is the
          reverse, which is what makes the pair readable as a forearm. */}
      <Seg
        from={[s * ELBOW.x, ELBOW.y - 0.01, split]}
        to={[s * WRIST.x, WRIST.y, split]}
        rFrom={BONE.radius * 0.7}
        rTo={BONE.radius}
        kind="bone"
        caps={false}
      />
      <Seg
        from={[s * ELBOW.x, ELBOW.y - 0.01, -split]}
        to={[s * WRIST.x, WRIST.y, -split]}
        rFrom={BONE.ulna}
        rTo={BONE.ulna * 0.7}
        kind="bone"
        caps={false}
      />

      {/* Metacarpals fanning across the palm, then a phalanx per finger. */}
      {FINGERS.map((f, i) => (
        <group key={i}>
          <Tube
            from={[s * HAND.x, WRIST.y - 0.022, f.z * 0.45]}
            to={[s * HAND.x, KNUCKLE_Y + 0.006, f.z]}
            r={BONE.metacarpal}
            kind="bone"
          />
          <Tube
            from={[s * HAND.x, KNUCKLE_Y + 0.004, f.z]}
            to={[s * HAND.x, KNUCKLE_Y + 0.008 - f.length * 0.8, f.z]}
            r={BONE.phalanx}
            kind="bone"
          />
        </group>
      ))}
      {/* Thumb metacarpal, angled forward off the palm. */}
      <Tube
        from={[s * (HAND.x - 0.008), 0.816, 0.018]}
        to={[s * (HAND.x - 0.03), 0.762, 0.068]}
        r={BONE.metacarpal}
        kind="bone"
      />

      <Seg
        from={[s * build.hipX, HIP.y - 0.03, 0]}
        to={[s * KNEE.x, KNEE.y, 0]}
        rFrom={BONE.femur}
        rTo={BONE.femur * 0.8}
        kind="bone"
        caps={false}
      />
      {/* Tibia medial and thick, fibula lateral and slender. */}
      <Seg
        from={[s * (KNEE.x - BONE.legSplit * 0.4), KNEE.y - 0.01, 0]}
        to={[s * (ANKLE.x - BONE.legSplit * 0.35), ANKLE.y, 0]}
        rFrom={BONE.tibia}
        rTo={BONE.tibia * 0.75}
        kind="bone"
        caps={false}
      />
      <Seg
        from={[s * (KNEE.x + BONE.legSplit * 0.8), KNEE.y - 0.03, 0]}
        to={[s * (ANKLE.x + BONE.legSplit * 0.6), ANKLE.y, 0]}
        rFrom={BONE.fibula}
        rTo={BONE.fibula * 0.9}
        kind="bone"
        caps={false}
      />
      {/* Metatarsals, so the LR3 valley between the toes has bones to sit in. */}
      {[-0.03, -0.006, 0.018, 0.042].map((dx, i) => (
        <Tube
          key={i}
          from={[s * (ANKLE.x + dx * 0.3), 0.046, 0.0]}
          to={[s * (ANKLE.x + dx), 0.032, 0.115]}
          r={BONE.phalanx}
          kind="bone"
        />
      ))}
    </group>
  );
}

/** Skin and clothing over one side's limbs. */
function Limbs({ s, sex }: { s: 1 | -1; sex: Sex }) {
  const build = BUILD[sex];

  // Where the sleeve and shorts hems fall along each limb, so the bare part
  // starts exactly at the fabric edge.
  const sleeveT = (SHOULDER.y - CLOTHING.sleeveY) / (SHOULDER.y - ELBOW.y);
  const sleeveX = lerp(build.shoulderX, ELBOW.x, sleeveT);
  const sleeveR = lerp(LIMB.upperArmTop, LIMB.upperArmBottom, sleeveT);

  const shortsT = (HIP.y - CLOTHING.shortsY) / (HIP.y - KNEE.y);
  const shortsX = lerp(build.hipX, KNEE.x, shortsT);
  const shortsR = lerp(LIMB.thighTop, LIMB.thighBottom, shortsT);

  return (
    <group>
      {/* Sleeve */}
      <Seg
        from={[s * build.shoulderX, SHOULDER.y, 0]}
        to={[s * sleeveX, CLOTHING.sleeveY, 0]}
        rFrom={LIMB.upperArmTop + CLOTHING.ease}
        rTo={sleeveR + CLOTHING.ease}
        kind="fabric-top"
        caps={false}
      />
      {/* Bare lower upper-arm */}
      <Seg
        from={[s * sleeveX, CLOTHING.sleeveY, 0]}
        to={[s * ELBOW.x, ELBOW.y, 0]}
        rFrom={sleeveR}
        rTo={LIMB.upperArmBottom}
        caps={false}
      />
      <Joint at={[s * ELBOW.x, ELBOW.y, 0]} r={LIMB.upperArmBottom} />
      <Seg
        from={[s * ELBOW.x, ELBOW.y, 0]}
        to={[s * WRIST.x, WRIST.y, 0]}
        rFrom={LIMB.forearmTop}
        rTo={LIMB.forearmBottom}
        caps={false}
      />
      <Joint at={[s * WRIST.x, WRIST.y, 0]} r={LIMB.forearmBottom} />

      {/* Palm: thin across X, broad across Z, so the thumb webbing is a real
          feature of the silhouette rather than a painted dot. */}
      <mesh position={[s * HAND.x, (WRIST.y + KNUCKLE_Y) / 2, 0.004]} scale={[0.56, 1, 1.15]}>
        <sphereGeometry args={[HAND.r + 0.007, 22, 18]} />
        <Flesh />
      </mesh>
      {FINGERS.map((f, i) => (
        <Tube
          key={i}
          from={[s * HAND.x, KNUCKLE_Y + 0.008, f.z]}
          to={[s * HAND.x, KNUCKLE_Y + 0.008 - f.length, f.z]}
          r={0.0105}
        />
      ))}
      {/* Thumb, in two segments so it bends away from the palm the way a real
          one does. The valley the two make with the index finger is LI4. */}
      <Tube
        from={[s * (HAND.x - 0.01), 0.818, 0.022]}
        to={[s * (HAND.x - 0.026), 0.778, 0.056]}
        r={0.0145}
      />
      <Tube
        from={[s * (HAND.x - 0.026), 0.778, 0.056]}
        to={[s * (HAND.x - 0.034), 0.752, 0.078]}
        r={0.0115}
      />

      {/* Shorts */}
      <Seg
        from={[s * build.hipX, HIP.y, 0]}
        to={[s * shortsX, CLOTHING.shortsY, 0]}
        rFrom={LIMB.thighTop + CLOTHING.ease}
        rTo={shortsR + CLOTHING.ease}
        kind="fabric-legs"
        caps={false}
      />
      {/* Bare lower thigh */}
      <Seg
        from={[s * shortsX, CLOTHING.shortsY, 0]}
        to={[s * KNEE.x, KNEE.y, 0]}
        rFrom={shortsR}
        rTo={LIMB.thighBottom}
        caps={false}
      />
      <Joint at={[s * KNEE.x, KNEE.y, 0]} r={LIMB.thighBottom} />
      <Seg
        from={[s * KNEE.x, KNEE.y, 0]}
        to={[s * ANKLE.x, ANKLE.y, 0]}
        rFrom={LIMB.calfTop}
        rTo={LIMB.calfBottom}
        caps={false}
      />
      <Joint at={[s * ANKLE.x, ANKLE.y, 0]} r={LIMB.calfBottom} />

      {/* Foot: heel, instep, and a toe ridge, so the top of the foot where LR3
          sits is an actual surface. */}
      <mesh position={[s * ANKLE.x, 0.032, -0.012]}>
        <sphereGeometry args={[0.036, 16, 12]} />
        <Flesh />
      </mesh>
      <mesh position={[s * ANKLE.x, 0.035, 0.055]} scale={[1, 1, 1]}>
        <boxGeometry args={[0.07, 0.068, 0.14]} />
        <Flesh />
      </mesh>
      <mesh position={[s * ANKLE.x, 0.022, 0.135]} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[0.035, 16, 12]} />
        <Flesh />
      </mesh>
    </group>
  );
}

export default function Mannequin({ sex }: { sex: Sex }) {
  return (
    <group>
      <Head />
      <Seg
        from={[0, NECK.y - NECK.halfHeight, 0]}
        to={[0, NECK.y + NECK.halfHeight, 0]}
        rFrom={NECK.r * 1.15}
        rTo={NECK.r}
        kind="clay"
      />
      <Trunk sex={sex} />
      {/* Bones first: they are opaque, so the translucent skin blends over. */}
      <Skeleton s={1} sex={sex} />
      <Skeleton s={-1} sex={sex} />
      <Limbs s={1} sex={sex} />
      <Limbs s={-1} sex={sex} />
    </group>
  );
}
