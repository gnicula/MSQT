import { motion } from "framer-motion";

type Props = {
  a: number;   // degrees
  aP: number;  // degrees
  b: number;   // degrees
  bP: number;  // degrees
  size?: number; // px
};

const ARM_COLORS = {
  a:   "#0ea5e9",   // sky-500
  aP:  "#0369a1",   // sky-800
  b:   "#22c55e",   // green-500
  bP:  "#166534",   // green-800
};

export default function analyzerDial({ a, aP, b, bP, size = 280 }: Props) {
  // SVG viewBox is -R..R to make rotation about (0,0) trivial
  const R = size / 2 - 14; // radius for arms (leave margin)
  const stroke = 6;

  // Utility: draw a rotating arm with a label dot
  const Arm = ({
    angleDeg,
    color,
    label,
    r = R,
  }: {
    angleDeg: number;
    color: string;
    label: string;
    r?: number;
  }) => (
    <g>
      <motion.g
        animate={{ rotate: -angleDeg }} // negative so 0° points to +x and angles increase counterclockwise
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
      >
        {/* arm */}
        <line x1={0} y1={0} x2={r} y2={0} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        {/* tip dot */}
        <circle cx={r} cy={0} r={8} fill={color} />
      </motion.g>
      {/* label: draw near the tip but outside the rotating group so text stays upright */}
      <text
        x={(r + 16) * Math.cos((-angleDeg * Math.PI) / 180)}
        y={(r + 16) * Math.sin((-angleDeg * Math.PI) / 180)}
        fontSize="12"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        style={{ fontWeight: 700 }}
      >
        {label}
      </text>
    </g>
  );

  // helper ring ticks every 30°
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">Analyzer Orientations</div>
        <div className="text-xs text-slate-500">0° → right (counterclockwise positive)</div>
      </div>

      <svg width={size} height={size} viewBox={[-size/2, -size/2, size, size].join(" ")}>
        {/* outer circle */}
        <circle cx={0} cy={0} r={R + 6} fill="none" stroke="#e2e8f0" strokeWidth={2} />
        {/* ticks */}
        {ticks.map((deg) => {
          const rad = (-deg * Math.PI) / 180;
          const r1 = R + 2, r2 = R + 10;
          return (
            <line
              key={deg}
              x1={r1 * Math.cos(rad)}
              y1={r1 * Math.sin(rad)}
              x2={r2 * Math.cos(rad)}
              y2={r2 * Math.sin(rad)}
              stroke="#cbd5e1"
              strokeWidth={2}
            />
          );
        })}
        {/* axes crosshair */}
        <line x1={-R-8} y1={0} x2={R+8} y2={0} stroke="#f1f5f9" strokeWidth={2} />
        <line x1={0} y1={-R-8} x2={0} y2={R+8} stroke="#f1f5f9" strokeWidth={2} />

        {/* arms */}
        <Arm angleDeg={a}  color={ARM_COLORS.a}  label="a" />
        <Arm angleDeg={aP} color={ARM_COLORS.aP} label="a′" r={R * 0.88} />
        <Arm angleDeg={b}  color={ARM_COLORS.b}  label="b" />
        <Arm angleDeg={bP} color={ARM_COLORS.bP} label="b′" r={R * 0.88} />
      </svg>

      {/* legend */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        {[
          ["a", ARM_COLORS.a],
          ["a′", ARM_COLORS.aP],
          ["b", ARM_COLORS.b],
          ["b′", ARM_COLORS.bP],
        ].map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color as string }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
