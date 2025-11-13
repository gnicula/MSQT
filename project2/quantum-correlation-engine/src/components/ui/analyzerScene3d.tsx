// src/components/analyzerScene3d.tsx
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo } from "react";

type Props = { a: number; aP: number; b: number; bP: number; height?: number };
type RigProps = { angleDeg: number; label: string; color: string; pos: [number, number, number] };

const toRad = (deg: number) => (deg * Math.PI) / 180;

// palette: common convention (N = red, S = blue)
const TOP_COLOR = "#dc2626"; // red-600 (N)
const BOT_COLOR = "#2563eb"; // blue-600 (S)

// rotate the triangular prism around +X so a VERTEX points straight down (-Y)
// use +π/2 (mirrored from before); tweak by ±π/3 to snap a different corner if desired
const TRI_ROLL = Math.PI / 2;

function SternGerlachRig({ angleDeg, label, color, pos }: RigProps) {
  // rotate WHOLE rig about +X (beam axis)
  const rotX = useMemo(() => toRad(angleDeg), [angleDeg]);

  // shortened geometry so 4 rigs fit comfortably
  const len = 0.56;   // magnet length along +X (shorter than before)
  const gapY = 0.14;  // half-gap between magnets (Y)
  const boxW = 0.18;  // bottom magnet thickness (Y)
  const boxD = 0.26;  // bottom magnet depth (Z)
  const triR = 0.16;  // triangular prism “radius”

  return (
    <group position={pos}>
      {/* everything inside rotates about +X together */}
      <group rotation={[rotX, 0, 0]}>
        {/* TOP magnet: triangular prism; axis along +X, apex aimed toward center of bottom block */}
        <mesh position={[0, gapY, 0]} rotation={[TRI_ROLL, 0, Math.PI / 2]}>
          {/* cylinder with 3 radial segments => triangular prism */}
          <cylinderGeometry args={[triR, triR, len, 3]} />
          <meshStandardMaterial color={TOP_COLOR} metalness={0.25} roughness={0.5} />
        </mesh>

        {/* BOTTOM magnet: rectangular block (centered) */}
        <mesh position={[0, -gapY, 0]}>
          <boxGeometry args={[len, boxW, boxD]} />
          <meshStandardMaterial color={BOT_COLOR} metalness={0.25} roughness={0.55} />
        </mesh>
      </group>

      {/* label (stays upright; not part of rotating group) */}
      <Html position={[0, -0.36, 0]} center>
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

export default function AnalyzerScene3D({ a, aP, b, bP, height = 280 }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-sm text-slate-700 mb-2">Stern–Gerlach analyzers (3D view)</div>
      <Canvas
        orthographic
        // shallower 3/4 angle; a touch of clockwise roll for the whole row
        camera={{ zoom: 190, position: [3.0, 1.9, 4.1] }}
        style={{ width: "100%", height }}
      >
        {/* lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={0.55} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* global tilt: [pitch, yaw, roll]; small positive roll gives a clockwise vibe */}
        <group rotation={[-0.14, 0.30, 0.12]}>
          {/* single row, evenly spaced; all at y=0 so they’re perfectly in line */}
          <SternGerlachRig pos={[-1.35, 0.0, 0]} angleDeg={a}  color="#0ea5e9" label="a"  />
          <SternGerlachRig pos={[-0.45, 0.0, 0]} angleDeg={aP} color="#0369a1" label="a′" />
          <SternGerlachRig pos={[ 0.45, 0.0, 0]} angleDeg={b}  color="#22c55e" label="b"  />
          <SternGerlachRig pos={[ 1.35, 0.0, 0]} angleDeg={bP} color="#166534" label="b′" />
        </group>
      </Canvas>
    </div>
  );
}
