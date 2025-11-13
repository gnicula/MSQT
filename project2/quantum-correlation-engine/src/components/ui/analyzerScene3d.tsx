// src/components/analyzerScene3d.tsx
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";

type RigProps = { angleDeg: number; label: string; color: string; x: number; y: number };

function SternGerlachRig({ angleDeg, label, color, x, y }: RigProps) {
  const rad = useMemo(() => (-angleDeg * Math.PI) / 180, [angleDeg]); // CCW positive, match app
  return (
    <group position={[x, y, 0]} rotation={[0, 0, rad]}>
      {/* beam (cyan rod along +X) */}
      <mesh position={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.8, 16]} />
        <meshStandardMaterial color="#00E5FF" />
      </mesh>

      {/* magnets: two offset blocks with a gap */}
      <group rotation={[0, 0, 0]}>
        {/* top (N) */}
        <mesh position={[0.2, 0.18, 0]}>
          <boxGeometry args={[1.2, 0.25, 0.4]} />
          <meshStandardMaterial color="#d9d9d9" metalness={0.2} roughness={0.6} />
        </mesh>
        {/* bottom (S) */}
        <mesh position={[0.2, -0.18, 0]}>
          <boxGeometry args={[1.2, 0.25, 0.4]} />
          <meshStandardMaterial color="#cfcfcf" metalness={0.2} roughness={0.7} />
        </mesh>
        {/* little field triangle hint */}
        <mesh position={[-0.2, 0, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.12, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>

      {/* “screen” plane – slightly tilted so 3/4 view is obvious */}
      <mesh position={[1.8, 0, -0.05]} rotation={[0, Math.PI / 6, 0]}>
        <planeGeometry args={[0.4, 0.6]} />
        <meshStandardMaterial color="#eef2ff" />
      </mesh>

      {/* label that does not rotate with rig orientation */}
      <Html position={[-0.5, -0.45, 0]} center>
        <div style={{
          background: "rgba(255,255,255,0.85)",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "2px 6px",
          fontSize: 12,
          color
        }}>
          {label}: {angleDeg.toFixed(1)}°
        </div>
      </Html>
    </group>
  );
}

export default function AnalyzerScene3D({
  a, aP, b, bP, height = 360,
}: { a: number; aP: number; b: number; bP: number; height?: number; }) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-sm text-slate-700 mb-2">Stern–Gerlach analyzers (3D view)</div>
      <Canvas
        orthographic
        camera={{ zoom: 120, position: [2.5, 2.5, 4] }}
        style={{ width: "100%", height }}
      >
        {/* subtle 3/4 lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={0.6} />
        <directionalLight position={[-3, -2, 2]} intensity={0.3} />

        {/* slight global tilt for a 3/4 vibe */}
        <group rotation={[ -0.25, 0.35, 0 ]}>
          {/* layout 2x2 grid */}
          <SternGerlachRig x={-1.0} y={ 0.7} angleDeg={a}  label="a"  color="#0ea5e9" />
          <SternGerlachRig x={ 0.8} y={ 0.7} angleDeg={aP} label="a′" color="#0369a1" />
          <SternGerlachRig x={-1.0} y={-0.6} angleDeg={b}  label="b"  color="#22c55e" />
          <SternGerlachRig x={ 0.8} y={-0.6} angleDeg={bP} label="b′" color="#166534" />
        </group>

        {/* optional: user can orbit a little; damped so it feels anchored */}
        <OrbitControls enablePan={false} enableZoom={false} enableRotate={true} />
      </Canvas>
    </div>
  );
}
