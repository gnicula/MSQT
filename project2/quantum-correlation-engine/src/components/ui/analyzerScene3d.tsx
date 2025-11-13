// src/components/analyzerScene3d.tsx
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo } from "react";

type Props = { a: number; aP: number; b: number; bP: number; height?: number };

type RigProps = {
  angleDeg: number;
  label: string;
  color: string;
  pos: [number, number, number];
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

// palette
const TOP_COLOR = "#475569";    // slate-600 (triangular prism)
const BOT_COLOR = "#1f2937";    // slate-900 (rect box)
const ROD_COLOR = "#1fb6c9";    // cyan-ish orientation cue

// roll the triangular prism around +X so one vertex points straight down (-Y)
// (this makes the “point” aim toward the center of the bottom block at 0°)
const TRI_ROLL = -Math.PI / 2; // adjust +/- 60° (π/3) if you want a different face orientation

function SternGerlachRig({ angleDeg, label, color, pos }: RigProps) {
  // rotate WHOLE rig about +X => matches “rotate analyzer around the beam axis”
  const rotX = useMemo(() => toRad(angleDeg), [angleDeg]);

  // shorter magnets so all 4 fit easily
  const len = 0.68;   // along +X
  const gapY = 0.15;  // half-gap between magnets (Y)
  const boxW = 0.20;  // bottom magnet thickness (Y)
  const boxD = 0.30;  // bottom magnet depth (Z)
  const triR = 0.18;  // triangular prism “radius”
  const rodLen = 0.72;

  return (
    <group position={pos}>
      {/* everything below rotates around X together */}
      <group rotation={[rotX, 0, 0]}>
        {/* short cyan rod through the gap (orientation cue) */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, rodLen, 20]} />
          <meshStandardMaterial color={ROD_COLOR} />
        </mesh>

        {/* TOP magnet: triangular prism; axis along +X, with a roll so the tip points to center */}
        <mesh position={[0, gapY, 0]} rotation={[TRI_ROLL, 0, Math.PI / 2]}>
          {/* cylinder with 3 radial segments => triangular prism */}
          <cylinderGeometry args={[triR, triR, len, 3]} />
          <meshStandardMaterial color={TOP_COLOR} metalness={0.25} roughness={0.55} />
        </mesh>

        {/* BOTTOM magnet: rectangular block */}
        <mesh position={[0, -gapY, 0]}>
          <boxGeometry args={[len, boxW, boxD]} />
          <meshStandardMaterial color={BOT_COLOR} metalness={0.25} roughness={0.6} />
        </mesh>
      </group>

      {/* screen-space label (upright; does not rotate with rig) */}
      <Html position={[0, -0.40, 0]} center>
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

export default function AnalyzerScene3D({ a, aP, b, bP, height = 300 }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-sm text-slate-700 mb-2">Stern–Gerlach analyzers (3D view)</div>
      <Canvas
        orthographic
        // shallower 3/4 view (less tilt), with a touch more zoom so the row fits snugly
        camera={{ zoom: 165, position: [3.0, 2.0, 4.2] }}
        style={{ width: "100%", height }}
      >
        {/* lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={0.55} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* global gentle tilt so the row “leans” away into the screen and toward the viewer */}
        <group rotation={[-0.18, 0.26, 0]}>
          {/* single row, evenly spaced; all share y=0 so they’re “in line” */}
          <SternGerlachRig pos={[-1.6, 0.0, 0]} angleDeg={a}  color="#0ea5e9" label="a"  />
          <SternGerlachRig pos={[-0.53, 0.0, 0]} angleDeg={aP} color="#0369a1" label="a′" />
          <SternGerlachRig pos={[ 0.53, 0.0, 0]} angleDeg={b}  color="#22c55e" label="b"  />
          <SternGerlachRig pos={[ 1.6, 0.0, 0]} angleDeg={bP} color="#166534" label="b′" />
        </group>
      </Canvas>
    </div>
  );
}
