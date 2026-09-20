"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HEIGHT, type Vec3 } from "@/lib/anatomy";
import { ACUPOINTS, POINT_IDS } from "@/lib/acupoints";
import type { Acupoint, PointId, Sex } from "@/lib/types";
import Hotspot from "./Hotspot";
import Mannequin from "./Mannequin";

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;

/** The resting shot: the whole figure, slightly off-axis. */
const HOME = {
  target: [0, HEIGHT * 0.52, 0] as Vec3,
  position: [0.95, HEIGHT * 0.72, 2.55] as Vec3,
};

/** Unit direction the camera sits in, relative to its target. */
const DIRECTION = {
  front: new THREE.Vector3(0.5, 0.28, 1).normalize(),
  back: new THREE.Vector3(0.4, 0.28, -1).normalize(),
};

function desiredShot(point: Acupoint | null) {
  if (!point) return HOME;
  const target = new THREE.Vector3(...point.cameraTarget);
  const position = target
    .clone()
    .add(DIRECTION[point.approach].clone().multiplyScalar(point.cameraDistance));
  return {
    target: target.toArray() as Vec3,
    position: position.toArray() as Vec3,
  };
}

/**
 * Flies the camera to the focused point and hands control back to the user.
 *
 * The tween is abandoned the moment the user touches the controls — an
 * auto-pan that fights a dragging hand is the single most common way a 3D demo
 * feels broken on stage.
 */
function CameraRig({
  focus,
  controls,
}: {
  focus: Acupoint | null;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const flying = useRef(false);
  const goal = useRef(desiredShot(null));

  useEffect(() => {
    goal.current = desiredShot(focus);
    flying.current = true;
  }, [focus]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => {
      flying.current = false;
    };
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((state, delta) => {
    const c = controls.current;
    if (!flying.current || !c) return;

    // Exponential approach, framerate-independent: fast at first, easing out.
    const k = 1 - Math.exp(-4.2 * delta);
    const wantPos = new THREE.Vector3(...goal.current.position);
    const wantTarget = new THREE.Vector3(...goal.current.target);

    state.camera.position.lerp(wantPos, k);
    c.target.lerp(wantTarget, k);
    c.update();

    if (
      state.camera.position.distanceTo(wantPos) < 0.004 &&
      c.target.distanceTo(wantTarget) < 0.004
    ) {
      flying.current = false;
    }
  });

  return null;
}

/** A light plane that sweeps up the body while the router is thinking. */
function ScanSweep({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (!active) {
      t.current = 0;
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    t.current = (t.current + delta * 0.85) % 1;
    ref.current.position.y = t.current * (HEIGHT + 0.1);
    const m = ref.current.material as THREE.MeshBasicMaterial;
    // Fade in and out at the ends of the travel so it reads as a sweep rather
    // than a plane that teleports back to the floor.
    m.opacity = Math.sin(t.current * Math.PI) * 0.5;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.12, 0.56, 48]} />
      <meshBasicMaterial
        color="#22d3ee"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Scene({
  recommended,
  selectedId,
  focusId,
  scanning,
  sex,
  onSelect,
}: {
  recommended: PointId[];
  selectedId: PointId | null;
  /** The point the camera should fly to. Distinct from selection so that
   *  closing the details panel does not yank the camera home. */
  focusId: PointId | null;
  scanning: boolean;
  sex: Sex;
  onSelect: (id: PointId) => void;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const [ready, setReady] = useState(false);

  const focus = focusId ? ACUPOINTS[focusId] : null;

  return (
    <Canvas
      // No shadow map and no environment probe on purpose. Both cost enough
      // GPU that a software rasteriser or a weak laptop drops the WebGL
      // context outright — which is a black stage on stage. The depth cueing
      // comes from ContactShadows and a three-light rig instead, and nothing
      // here fetches an asset over the network.
      dpr={[1, 1.75]}
      camera={{ position: HOME.position, fov: 38, near: 0.05, far: 60 }}
      onCreated={() => setReady(true)}
      className="scene-canvas"
    >
      <color attach="background" args={["#070b14"]} />
      <fog attach="fog" args={["#070b14", 4.5, 11]} />

      <ambientLight intensity={0.7} />
      {/* Key */}
      <directionalLight position={[2.4, 3.2, 2.6]} intensity={2.1} />
      {/* Cyan rim from behind, which is what makes the low-poly facets read. */}
      <directionalLight position={[-2.6, 1.8, -2.2]} intensity={0.9} color="#22d3ee" />
      {/* Cool fill from below, to keep the legs from going to silhouette. */}
      <directionalLight position={[0, -1.4, 2.2]} intensity={0.5} color="#7dd3fc" />

      <group ref={body}>
        <Mannequin sex={sex} />
      </group>

      {/* Markers live outside the occluder group so they never occlude each other. */}
      {ready &&
        POINT_IDS.map((id) => (
          <Hotspot
            key={id}
            point={ACUPOINTS[id]}
            active={recommended.includes(id)}
            selected={selectedId === id}
            occluder={body}
            onSelect={onSelect}
          />
        ))}

      <ScanSweep active={scanning} />

      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.5}
        scale={3.2}
        blur={2.4}
        far={1.2}
        color="#02040a"
      />
      {/* Floor grid, purely for depth cueing */}
      <gridHelper args={[8, 32, "#132033", "#0d1626"]} position={[0, 0, 0]} />

      <OrbitControls
        ref={controls}
        target={HOME.target}
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        minDistance={0.28}
        maxDistance={5}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 1.9}
      />
      <CameraRig focus={focus} controls={controls} />
    </Canvas>
  );
}
