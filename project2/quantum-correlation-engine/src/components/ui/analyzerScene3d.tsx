import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo } from "react";

type Props = { a: number; aP: number; b: number; bP: number; height?: number };

type RigProps = {
  angleDeg: number; label: string; color: string; pos: [number, number, number];
};

// helper: degrees → radians, CCW positive matches your app convention
const toRad = (deg: number) => (deg * Math.PI) / 180;

function SternGerlachRig({ angleDeg, label, color, pos }: RigProps) {
  // rotate AROUND THE BEAM AXIS (+X), so use rotation about X
  const rotX = useMemo(() => toRad(angleDeg), [angleDeg]);

  return (
    <group position={pos}>
      {/* This child rotates about +X, carrying magnets + beam together */}
      <group rotation={[rotX, 0, 0]}>
        {/* beam along +X */}
        <mesh position={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.8, 16]} />
          <meshStandardMaterial color="#00E5FF" />
        </mesh>

        {/* magnets: gap along Y, centered at x≈0.2 so beam passes through */}
        <mesh position={[0.2, 0.18, 0]}>
          <boxGeometry args={[1.2, 0.25, 0.4]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0.2, -0.18, 0]}>
          <boxGeometry args={[1.2, 0.25, 0.4]} />
          <meshStandardMaterial color="#a3a3a3" metalness={0.2} roughness={0.7} />
        </mesh>

        {/* tiny “field wedge” just as a directional cue */}
        <mesh position={[-0.25, 0, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.12, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* screen plane downstream, fixed relative to rig */}
        <mesh position={[1.9, 0, -0.06]} rotation={[0, Math.PI / 6, 0]}>
          <planeGeometry args={[0.45, 0.65]} />
          <meshStandardMaterial color="#eef2ff" />
        </mesh>
      </group>

      {/* screen-space label that does NOT rotate with the rig */}
      <Html position={[-0.55, -0.5, 0]} center>
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "2px 6px",
            fontSize: 12,
            color,
            fontWeight: 600,
          }}
        >
          {label}: {angleDeg.toFixed(1)}°
        </div>
      </Html>
    </group>
  );
}

export default function AnalyzerScene3D({ a, aP, b, bP, height = 360 }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-sm text-slate-700 mb-2">Stern–Gerlach analyzers (3D view)</div>
      <Canvas
        orthographic
        // lock a clean 3/4 isometric view; no orbit so axes stay consistent
        camera={{ zoom: 120, position: [3.2, 2.6, 4.0] }}
        style={{ width: "100%", height }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={0.6} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* global subtle tilt so everything shares the same 3/4 view */}
        <group rotation={[-0.28, 0.35, 0]}>
          {/* 2×2 layout: all beams go +X, all rigs rotate about +X */}
          <SternGerlachRig pos={[-1.1,  0.8, 0]} angleDeg={a}  color="#0ea5e9" label="a"  />
          <SternGerlachRig pos={[ 0.9,  0.8, 0]} angleDeg={aP} color="#0369a1" label="a′" />
          <SternGerlachRig pos={[-1.1, -0.7, 0]} angleDeg={b}  color="#22c55e" label="b"  />
          <SternGerlachRig pos={[ 0.9, -0.7, 0]} angleDeg={bP} color="#166534" label="b′" />
        </group>
      </Canvas>
    </div>
  );
}
