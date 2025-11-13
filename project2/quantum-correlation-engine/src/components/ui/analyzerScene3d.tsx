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

// A single Stern–Gerlach rig: top magnet is a triangular prism, bottom is a box.
// Everything rotates around +X (the beam axis).
function SternGerlachRig({ angleDeg, label, color, pos }: RigProps) {
  const rotX = useMemo(() => toRad(angleDeg), [angleDeg]);

  // dimensions: shorter so we can line up 4 rigs in a row without overlap
  const len = 0.9;      // magnet length along +X
  const gapY = 0.16;    // half-gap between magnets (along Y)
  const boxW = 0.22;    // magnet thickness (Y)
  const boxD = 0.32;    // magnet depth (Z)
  const triR = 0.20;    // “radius” of triangular prism (approx half-width)
  const beamLen = 0.9;  // short cyan rod (centered), purely for orientation cue

  return (
    <group position={pos}>
      {/* rotate about +X so all rigs share the same physical rotation axis */}
      <group rotation={[rotX, 0, 0]}>
        {/* short cyan rod through the gap (orientation cue only) */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
          {/* cylinder default axis is Y; rotate to lie along X */}
          <cylinderGeometry args={[0.012, 0.012, beamLen, 20]} />
          <meshStandardMaterial color="#1eb4c8" />
          {/* rotate to X-axis */}
          <group rotation={[0, 0, Math.PI / 2]} />
        </mesh>

        {/* TOP magnet: triangular prism (cylinder with 3 sides), oriented along +X */}
        <mesh position={[0, gapY, 0]} rotation={[0, 0, Math.PI / 2 /* make its axis along X */]}>
          {/* radiusTop=radiusBottom=triR, height=len, radialSegments=3 => triangular prism */}
          <cylinderGeometry args={[triR, triR, len, 3]} />
          <meshStandardMaterial color="#6b7280" metalness={0.25} roughness={0.55} />
        </mesh>

        {/* BOTTOM magnet: rectangular block */}
        <mesh position={[0, -gapY, 0]}>
          <boxGeometry args={[len, boxW, boxD]} />
          <meshStandardMaterial color="#52525b" metalness={0.25} roughness={0.6} />
        </mesh>
      </group>

      {/* screen-space label (stays upright, does not rotate with rig) */}
      <Html position={[0, -0.42, 0]} center>
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

export default function AnalyzerScene3D({ a, aP, b, bP, height = 320 }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-sm text-slate-700 mb-2">Stern–Gerlach analyzers (3D view)</div>
      <Canvas
        orthographic
        // locked 3/4 isometric view so all rigs share the same global frame
        camera={{ zoom: 140, position: [3.2, 2.6, 4.0] }}
        style={{ width: "100%", height }}
      >
        {/* simple lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={0.55} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* slight global tilt for depth; ALL rigs in one row along X */}
        <group rotation={[-0.28, 0.35, 0]}>
          {/* left → right layout; all share y=0 to be “in line” */}
          <SternGerlachRig pos={[-2.0, 0.0, 0]} angleDeg={a}  color="#0ea5e9" label="a"  />
          <SternGerlachRig pos={[-0.65, 0.0, 0]} angleDeg={aP} color="#0369a1" label="a′" />
          <SternGerlachRig pos={[ 0.65, 0.0, 0]} angleDeg={b}  color="#22c55e" label="b"  />
          <SternGerlachRig pos={[ 2.0, 0.0, 0]} angleDeg={bP} color="#166534" label="b′" />
        </group>
      </Canvas>
    </div>
  );
}
