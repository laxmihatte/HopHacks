"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  ANKLE,
  BUILD,
  ELBOW,
  HAND,
  HEAD,
  HIP,
  KNEE,
  LIMB,
  NECK,
  SHOULDER,
  WRIST,
  type Vec3,
} from "@/lib/anatomy";
import type { Sex } from "@/lib/types";

/** A matte clay finish: neutral, unbranded, and the only unsaturated surface
 *  in the scene, so the red pressure marks are the only colour that carries
 *  meaning. */
const SKIN = "#c3ab9b";
const SKIN_SHADE = "#ab9484";
const FEATURE = "#6b5a50";

const SEGMENTS = 22;

function Clay({ color = SKIN }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.88} metalness={0.02} />;
}

/**
 * A limb segment: a tapered cylinder between two landmarks, capped with a
 * sphere at each joint so the seams read as anatomy rather than as a join.
 */
function Bone({
  from,
  to,
  rFrom,
  rTo,
  color,
}: {
  from: Vec3;
  to: Vec3;
  rFrom: number;
  rTo: number;
  color?: string;
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
        {/* The +Y end of the cylinder maps to `to`, so radiusTop is rTo. */}
        <cylinderGeometry args={[rTo, rFrom, length, SEGMENTS]} />
        <Clay color={color} />
      </mesh>
      <mesh position={from}>
        <sphereGeometry args={[rFrom, SEGMENTS, 12]} />
        <Clay color={color} />
      </mesh>
      <mesh position={to}>
        <sphereGeometry args={[rTo, SEGMENTS, 12]} />
        <Clay color={color} />
      </mesh>
    </group>
  );
}

/**
 * The trunk, revolved from the build's silhouette profile and then flattened
 * front-to-back. A lathe rather than stacked boxes: the human trunk has no
 * step changes in width, and a stack of slabs reads as a robot.
 */
function Trunk({ sex }: { sex: Sex }) {
  const build = BUILD[sex];

  const geometry = useMemo(() => {
    // Resample the profile through a spline, so the silhouette is smooth
    // between the handful of authored control points.
    const curve = new THREE.CatmullRomCurve3(
      build.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    );
    const points = curve.getPoints(40).map((p) => new THREE.Vector2(Math.max(p.x, 0.001), p.y));
    return new THREE.LatheGeometry(points, SEGMENTS);
  }, [build.profile]);

  return (
    <group>
      <mesh geometry={geometry} scale={[1, 1, build.depth]}>
        <Clay />
      </mesh>

      {/* Shoulder caps, plus a trapezius bridge back to the neck. Without the
          bridge the deltoids read as two balls floating beside the chest,
          because the lathe narrows sharply above the bust line. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Bone
            from={[s * 0.028, 1.435, 0]}
            to={[s * build.shoulderX, SHOULDER.y, 0]}
            rFrom={0.052}
            rTo={LIMB.shoulderJoint}
          />
          <mesh position={[s * build.shoulderX, SHOULDER.y, 0]}>
            <sphereGeometry args={[LIMB.shoulderJoint, SEGMENTS, 14]} />
            <Clay />
          </mesh>
        </group>
      ))}

      {build.bust > 0 &&
        [1, -1].map((s) => (
          <mesh key={s} position={[s * 0.058, 1.252, build.depth * 0.058]} scale={[1.1, 0.85, 0.52]}>
            <sphereGeometry args={[build.bust, SEGMENTS, 14]} />
            <Clay />
          </mesh>
        ))}
    </group>
  );
}

/**
 * The head, with just enough face to make orientation unambiguous.
 *
 * This is not decoration. On a body map the user has to know whether they are
 * looking at the front or the back of the neck, or GB20 is meaningless.
 */
function Head() {
  const r = HEAD.r;
  return (
    <group position={[0, HEAD.y, 0]}>
      <mesh scale={[0.94, 1.12, 1]}>
        <sphereGeometry args={[r, 32, 24]} />
        <Clay />
      </mesh>
      {/* Jaw */}
      <mesh position={[0, -r * 0.62, r * 0.14]} scale={[0.82, 0.62, 0.9]}>
        <sphereGeometry args={[r * 0.82, 24, 18]} />
        <Clay />
      </mesh>
      {/* Eyes */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * r * 0.35, r * 0.12, r * 0.88]} scale={[1.4, 0.6, 0.35]}>
          <sphereGeometry args={[r * 0.11, 14, 10]} />
          <meshStandardMaterial color={FEATURE} roughness={0.6} />
        </mesh>
      ))}
      {/* Nose */}
      <mesh position={[0, -r * 0.1, r * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[r * 0.13, r * 0.3, 10]} />
        <Clay color={SKIN_SHADE} />
      </mesh>
      {/* Ears */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * r * 0.9, 0, 0]} scale={[0.4, 1, 0.65]}>
          <sphereGeometry args={[r * 0.28, 12, 10]} />
          <Clay color={SKIN_SHADE} />
        </mesh>
      ))}
    </group>
  );
}

/** One arm and one leg for the given side (+1 = the figure's right). */
function Limbs({ s, sex }: { s: 1 | -1; sex: Sex }) {
  const build = BUILD[sex];
  return (
    <group>
      <Bone
        from={[s * build.shoulderX, SHOULDER.y, 0]}
        to={[s * ELBOW.x, ELBOW.y, 0]}
        rFrom={LIMB.upperArmTop}
        rTo={LIMB.upperArmBottom}
      />
      <Bone
        from={[s * ELBOW.x, ELBOW.y, 0]}
        to={[s * WRIST.x, WRIST.y, 0]}
        rFrom={LIMB.forearmTop}
        rTo={LIMB.forearmBottom}
      />

      {/* Palm: flattened side-to-side, so the thumb side faces forward and the
          LI4 webbing is a real feature of the silhouette. */}
      <mesh position={[s * HAND.x, HAND.y - 0.012, 0.012]} scale={[0.52, 1, 1.15]}>
        <sphereGeometry args={[HAND.r, 18, 14]} />
        <Clay />
      </mesh>
      {/* Fingers, overlapping the palm so the hand is one continuous form. */}
      <mesh position={[s * HAND.x, HAND.y - 0.046, 0.013]} scale={[0.5, 1, 1.1]}>
        <capsuleGeometry args={[0.021, 0.042, 4, 12]} />
        <Clay />
      </mesh>
      {/* Thumb, swung forward off the radial side — the webbing it makes with
          the palm is exactly where LI4 sits. */}
      <Bone
        from={[s * (HAND.x - 0.014), HAND.y + 0.016, 0.028]}
        to={[s * (HAND.x - 0.03), HAND.y - 0.026, 0.055]}
        rFrom={0.016}
        rTo={0.012}
      />

      <Bone
        from={[s * build.hipX, HIP.y, 0]}
        to={[s * KNEE.x, KNEE.y, 0]}
        rFrom={LIMB.thighTop}
        rTo={LIMB.thighBottom}
      />
      <Bone
        from={[s * KNEE.x, KNEE.y, 0]}
        to={[s * ANKLE.x, ANKLE.y, 0]}
        rFrom={LIMB.calfTop}
        rTo={LIMB.calfBottom}
      />
      {/* Foot, meeting the ankle joint exactly so the leg does not float. */}
      <mesh position={[s * ANKLE.x, 0.035, 0.05]}>
        <boxGeometry args={[0.072, 0.07, 0.2]} />
        <Clay color={SKIN_SHADE} />
      </mesh>
    </group>
  );
}

export default function Mannequin({ sex }: { sex: Sex }) {
  return (
    <group>
      <Head />
      <Bone
        from={[0, NECK.y - NECK.halfHeight, 0]}
        to={[0, NECK.y + NECK.halfHeight, 0]}
        rFrom={NECK.r * 1.15}
        rTo={NECK.r}
      />
      <Trunk sex={sex} />
      <Limbs s={1} sex={sex} />
      <Limbs s={-1} sex={sex} />
    </group>
  );
}
