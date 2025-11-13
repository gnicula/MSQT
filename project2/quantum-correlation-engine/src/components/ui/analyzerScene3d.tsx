// src/components/analyzerScene3d.tsx
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo } from "react";

type Props = { a: number; aP: number; b: number; bP: number; height?: number };
type RigProps = { angleDeg: number; label: string; color: string; pos: [number, number, number] };

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Magnetic pole colors (N = red, S = blue)
const TOP_COLOR = "#dc2626";
const BOT_COLOR = "#2563eb";

// Prism rotation about the X-axis; adjusts orientation of the triangular magnet
const TRI_ROLL = Math.PI / 2;

function SternGerlachRig({ angleDeg, label, color, pos }: RigProps) {
  // Rotation of the entire analyzer around the beam axis (+X)
  const rotX = useMemo(() => toRad(angleDeg), [angleDeg]);

  // Dimensions tuned for compact layout of multiple analyzers
  const len = 0.56;   // magnet length along +X
  const gapY = 0.14;  // half the vertical separation between magnets
  const boxW = 0.18;  // magnet block thickness
  const boxD = 0.26;  // magnet block depth
  const triR = 0.16;  // triangular prism radius

  return (
    <group position={pos}>
      {/* Rotating assembly for the analyzer */}
      <group rotation={[rotX, 0, 0]}>
        {/* Top magnet: triangular prism with apex directed toward the bottom block */}
        <mesh position={[0, gapY, 0]} rotation={[TRI_ROLL, 0, Math.PI / 2]}>
          <cylinderGeometry args={[triR, triR, len, 3]} />
          <meshStandardMaterial color={TOP_COLOR} metalness={0.25} roughness={0.5} />
        </mesh>

        {/* Bottom magnet: rectangular block */}
        <mesh position={[0, -gapY, 0]}>
          <boxGeometry args={[len, boxW, boxD]} />
          <meshStandardMaterial color={BOT_COLOR} metalness={0.25} roughness={0.55} />
        </mesh>
      </group>

      {/* Text label, fixed in screen space */}
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
        // Slightly angled top-down view for clarity
        camera={{ zoom: 190, position: [3.0, 1.9, 4.1] }}
        style={{ width: "100%", height }}
      >
        {/* Lighting setup */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={0.55} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* Global rotation to give a natural perspective */}
        <group rotation={[-0.14, -0.30, 0.12]}>
          {/* Four analyzers, evenly spaced along the X-axis */}
          <SternGerlachRig pos={[-1.35, 0.0, 0]} angleDeg={a}  color="#0ea5e9" label="a"  />
          <SternGerlachRig pos={[-0.45, 0.0, 0]} angleDeg={aP} color="#0369a1" label="a′" />
          <SternGerlachRig pos={[ 0.45, 0.0, 0]} angleDeg={b}  color="#22c55e" label="b"  />
          <SternGerlachRig pos={[ 1.35, 0.0, 0]} angleDeg={bP} color="#166534" label="b′" />
        </group>
      </Canvas>
    </div>
  );
}
