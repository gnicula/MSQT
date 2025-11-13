/**
 * QuantumCorrelationEngine.tsx
 * ----------------------------------------------------------
 * A visual and interactive simulator of Bell-test correlations
 * comparing Quantum Mechanics (nonlocal) and Classical LHV (local hidden variable) models.
 *
 * --- Quick primer ---
 * Alice chooses between analyzer settings a, a′ and Bob between b, b′.
 * Each run yields ±1 outcomes; the correlation at relative angle θ is E(θ) = ⟨A · B⟩.
 *
 * Models:
 *  • Quantum singlet:    E_Q(θ) = −cos θ  (can reach |S| = 2√2)
 *  • Classical (LHV):    E_C(θ) = 1 − 2θ/π (always |S| ≤ 2)
 *
 * CHSH combination:
 *     S = | E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′) |
 *
 * UI notes:
 *  • Left: angle sliders (a,a′,b,b′) in [0°,180°] since 180° flips are redundant.
 *  • Right: preset buttons, quick theory blurb, and a simple 3D analyzer scene.
 *  • Bottom: correlation curve E(θ), CHSH sample points, and |S| readout.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import AnalyzerScene3D from "@/components/ui/analyzerScene3d";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  ZAxis,
  Scatter,
} from "recharts";

// --- Visual consistency colors (match 3D analyzers & labels) ---
const COLORS = {
  a: "#0ea5e9",  // sky-500 (Alice: a)
  aP: "#0369a1", // sky-800 (Alice: a′)
  b: "#22c55e",  // green-500 (Bob: b)
  bP: "#166534", // green-800 (Bob: b′)
};

// --- Utility math helpers ---
/** Convert degrees → radians for trig functions. */
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Wrap any degree value into [0, 360). */
const wrapDeg = (d: number) => ((d % 360) + 360) % 360;

/**
 * Smallest angular separation in degrees.
 * In this context, directions separated by 180° behave equivalently,
 * so the effective range is [0°, 180°].
 */
const angleDiff = (a: number, b: number) => {
  const diff = Math.abs(wrapDeg(a) - wrapDeg(b));
  return diff > 180 ? 360 - diff : diff; // clamp to [0,180]
};

// --- Physics models ---
/** Quantum singlet prediction: anti-correlation at θ = 0°. */
const E_quantum = (thetaDeg: number) => -Math.cos(toRad(thetaDeg));

/** Simple local-hidden-variable model (linear in θ). */
const E_classical = (thetaDeg: number) => 1 - (2 * toRad(thetaDeg)) / Math.PI;

// --- Compute CHSH value ---
/**
 * Compute |S| and return it along with the four term values for display.
 * S = | E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′) |
 */
function computeS(
  a: number,
  aP: number,
  b: number,
  bP: number,
  corr: (thetaDeg: number) => number
) {
  const ab = corr(angleDiff(a, b));
  const abP = corr(angleDiff(a, bP));
  const aPb = corr(angleDiff(aP, b));
  const aPbP = corr(angleDiff(aP, bP));
  const S = Math.abs(ab - abP + aPb + aPbP);
  return { S, terms: { ab, abP, aPb, aPbP } };
}

// --- Build continuous E(θ) dataset for plotting ---
/** Dense, smooth E(θ) for θ ∈ [0°, 180°] at 2° increments. */
function buildCurve(corr: (thetaDeg: number) => number) {
  const data: { theta: number; E: number }[] = [];
  for (let t = 0; t <= 180; t += 2) data.push({ theta: t, E: +corr(t).toFixed(4) });
  return data;
}

// --- Preset configurations ---
/** Quick landmarks; first is near the quantum-optimal violation (|S| = 2√2). */
const presets = [
  { name: "Quantum-optimal", a: 0, aP: 45, b: 22.5, bP: 67.5 },
  { name: "Aligned", a: 0, aP: 90, b: 0, bP: 90 },
  { name: "Orthogonal pairs", a: 0, aP: 90, b: 45, bP: 135 },
];

export default function QuantumCorrelationEngine() {
  // Analyzer orientations for Alice (a, a′) and Bob (b, b′)
  const [angles, setAngles] = useState({ a: 0, aP: 45, b: 22.5, bP: 67.5 });

  // Active model: switches correlation law used throughout
  const [model, setModel] = useState<"quantum" | "classical">("quantum");

  // Correlation function for current model
  const corr = useMemo(() => (model === "quantum" ? E_quantum : E_classical), [model]);

  // Smooth E(θ) dataset for the chart
  const curve = useMemo(() => buildCurve(corr), [corr]);

  // CHSH terms and magnitude |S| for current angles
  const result = useMemo(
    () => computeS(angles.a, angles.aP, angles.b, angles.bP, corr),
    [angles, corr]
  );

  // Violation if |S| > 2 (tiny epsilon to avoid float jitter)
  const violation = result.S > 2 + 1e-9;

  // Separate one-point series so each can be color-coded consistently
  const pt_ab = useMemo(
    () => [{ theta: angleDiff(angles.a, angles.b), E: corr(angleDiff(angles.a, angles.b)) }],
    [angles, corr]
  );
  const pt_abP = useMemo(
    () => [{ theta: angleDiff(angles.a, angles.bP), E: corr(angleDiff(angles.a, angles.bP)) }],
    [angles, corr]
  );
  const pt_aPb = useMemo(
    () => [{ theta: angleDiff(angles.aP, angles.b), E: corr(angleDiff(angles.aP, angles.b)) }],
    [angles, corr]
  );
  const pt_aPbP = useMemo(
    () => [{ theta: angleDiff(angles.aP, angles.bP), E: corr(angleDiff(angles.aP, angles.bP)) }],
    [angles, corr]
  );

  /** Apply a preset configuration to all four angles at once. */
  const applyPreset = (p: typeof presets[number]) =>
    setAngles({ a: p.a, aP: p.aP, b: p.b, bP: p.bP });

  return (
    <div className="w-full min-h-screen p-6 md:p-10 bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="max-w-6xl mx-auto grid gap-6 md:gap-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Quantum Correlation Engine</h1>
            <p className="text-slate-600 mt-1">
              Fully client-side simulator of EPR–Bell correlations. Toggle models, set analyzer angles, and
              see the CHSH value S update in real time.
            </p>
          </div>

          {/* Model toggle simply swaps correlation function used downstream */}
          <div className="flex items-center gap-3">
            <Label htmlFor="modelSwitch" className="text-sm">
              {model === "quantum" ? "Quantum" : "Classical"}
            </Label>
            <Switch
              id="modelSwitch"
              checked={model === "quantum"}
              onCheckedChange={(v) => setModel(v ? "quantum" : "classical")}
            />
          </div>
        </div>

        {/* Controls: sliders + presets/about + 3D scene */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-6">
            <CardTitle className="text-lg">Measurement Settings (degrees)</CardTitle>
          </CardHeader>

          <CardContent className="grid md:grid-cols-2 gap-6 px-6 pb-6">
            {/* Sliders (a, a′, b, b′) limited to [0°, 180°] */}
            <div className="grid gap-4">
              <AngleSlider label="a"  value={angles.a}  color={COLORS.a}  onChange={(v) => setAngles({ ...angles, a: v })} />
              <AngleSlider label="a′" value={angles.aP} color={COLORS.aP} onChange={(v) => setAngles({ ...angles, aP: v })} />
              <AngleSlider label="b"  value={angles.b}  color={COLORS.b}  onChange={(v) => setAngles({ ...angles, b: v })} />
              <AngleSlider label="b′" value={angles.bP} color={COLORS.bP} onChange={(v) => setAngles({ ...angles, bP: v })} />
            </div>

            {/* Presets + lightweight theory + 3D visualizer */}
            <div className="grid gap-4">
              <Tabs defaultValue="presets" className="w-full">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                  <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>

                {/* Quick angle presets (also duplicated near the CHSH card) */}
                <TabsContent value="presets" className="pt-3">
                  <div className="grid gap-2">
                    {presets.map((p) => (
                      <Button key={p.name} variant="secondary" className="justify-between" onClick={() => applyPreset(p)}>
                        <span>{p.name}</span>
                        <span className="text-xs text-slate-600">
                          a={p.a}°, a′={p.aP}°, b={p.b}°, b′={p.bP}°
                        </span>
                      </Button>
                    ))}
                    <div className="text-xs text-slate-500 mt-1">
                      “Quantum-optimal” maximizes |S| in the quantum model (|S| = 2√2).
                    </div>
                  </div>
                </TabsContent>

                {/* Short theory blurb for context */}
                <TabsContent value="about" className="pt-3">
                  <div className="text-sm text-slate-600 leading-relaxed flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div className="space-y-2">
                      <p>
                        Choose analyzer orientations for Alice (a,a′) and Bob (b,b′).
                        The simulator computes E(a,b), E(a,b′), E(a′,b), E(a′,b′) and combines them
                        into the CHSH value S.
                      </p>
                      <p>
                        "Quantum" uses E(θ) = −cos θ; "Classical" uses E(θ) = 1 − 2θ/π.
                        Classical correlations satisfy |S| ≤ 2, while quantum can reach |S| = 2√2.
                      </p>
                      <p className="text-xs">
                        Tip: CHSH points below share the same colors as the slider labels and 3D scene.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Minimal 3D scene to keep orientations visually grounded */}
              <AnalyzerScene3D a={angles.a} aP={angles.aP} b={angles.b} bP={angles.bP} />
            </div>
          </CardContent>
        </Card>

        {/* Results: correlation curve + CHSH sample points & summary */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Correlation curve E(θ) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-lg">Correlation Curve E(θ)</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 10, right: 14, bottom: 10, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="theta"
                      type="number"
                      domain={[0, 180]}
                      tickCount={10}
                      tickFormatter={(v) => `${v}°`}
                      label={{ value: "θ (deg)", position: "insideBottom", dy: 10 }}
                    />
                    <YAxis domain={[-1, 1]} tickCount={5} />
                    <Tooltip
                      position={{ x: 14, y: 10 }}
                      cursor={false}
                      allowEscapeViewBox={{ x: false, y: false }}
                      wrapperStyle={{
                        background: "rgba(255,255,255,0.95)",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12,
                        padding: "6px 8px",
                        pointerEvents: "none",
                      }}
                      formatter={(v: any) => (typeof v === "number" ? v.toFixed(4) : v)}
                      labelFormatter={(l) => `θ = ${l}°`}
                    />
                    <ReferenceLine y={0} />
                    <Line type="monotone" dataKey="E" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* CHSH sample points: four fixed correlations (tooltips removed for simplicity) */}
              <div className="h-40 w-full mt-4 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 14, bottom: 10, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="theta"
                      type="number"
                      domain={[0, 180]}
                      tickFormatter={(v) => `${v}°`}
                      label={{ value: "θ for CHSH terms (deg)", position: "insideBottom", dy: 10 }}
                    />
                    <YAxis dataKey="E" domain={[-1, 1]} />
                    <ZAxis dataKey={() => 120} range={[120, 120]} />
                    {/* No Tooltip on purpose to keep focus on the CHSH card */}
                    <Scatter name="E(a,b)"   data={pt_ab}   fill={COLORS.a} />
                    <Scatter name="E(a,b′)"  data={pt_abP}  fill={COLORS.aP} />
                    <Scatter name="E(a′,b)"  data={pt_aPb}  fill={COLORS.b} />
                    <Scatter name="E(a′,b′)" data={pt_aPbP} fill={COLORS.bP} />
                    <ReferenceLine y={0} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* CHSH Result summary */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-lg">CHSH Result</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-4">
                {/* Individual correlations; tabular numerals = stable width while updating */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ValueBox label="E(a,b)"   value={result.terms.ab}   color={COLORS.a} />
                  <ValueBox label="E(a,b′)"  value={result.terms.abP}  color={COLORS.aP} />
                  <ValueBox label="E(a′,b)"  value={result.terms.aPb}  color={COLORS.b} />
                  <ValueBox label="E(a′,b′)" value={result.terms.aPbP} color={COLORS.bP} />
                </div>

                {/* |S| with a visual cue when violating the classical bound */}
                <motion.div
                  className={`rounded-2xl p-4 border ${violation ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm text-slate-600">CHSH |S|</div>
                    <div className="text-xs text-slate-500">Classical bound ≤ 2</div>
                  </div>
                  <div className="mt-1 flex items-end gap-3">
                    <div className="text-3xl font-semibold tabular-nums">{result.S.toFixed(4)}</div>
                    <div className={`text-sm ${violation ? "text-emerald-600" : "text-slate-500"}`}>
                      {violation ? "Quantum violation" : "Within classical limit"}
                    </div>
                  </div>
                </motion.div>

                {/* Convenience: same presets repeated here, plus a reset */}
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((p) => (
                    <Button key={p.name} variant="outline" onClick={() => applyPreset(p)}>
                      Use preset: {p.name}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={() => setAngles({ a: 0, aP: 45, b: 22.5, bP: 67.5 })}>
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * AngleSlider
 * ----------------------------------------------------------
 * Thin wrapper around shadcn/ui Slider to present an angle value.
 * Shows current value and uses a color cue to match plots/3D scene.
 */
function AngleSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-sm" style={{ color }}>
          {label}
        </Label>
        <div className="text-sm tabular-nums text-slate-700">{value.toFixed(1)}°</div>
      </div>
      <Slider
        className="h-6" // slimmer track so sliders don’t look oversized
        value={[value]}
        min={0}
        max={180}
        step={0.5}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}

/**
 * ValueBox
 * ----------------------------------------------------------
 * Small boxed readout for a single correlation term value.
 * Uses tabular numerals for jitter-free updates.
 */
function ValueBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border p-3 bg-white/60">
      <div className="text-xs text-slate-500 mb-1">
        <span style={{ color }}>{label}</span>
      </div>
      <div className="text-lg font-medium tabular-nums">{value.toFixed(4)}</div>
    </div>
  );
}
