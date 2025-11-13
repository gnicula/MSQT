/**
 * QuantumCorrelationEngine.tsx
 * ----------------------------------------------------------
 * A visual and interactive simulator of Bell-test correlations
 * comparing Quantum Mechanics (nonlocal) and Classical LHV (local hidden variable) models.
 *
 * --- Physics summary ---
 * In a typical Bell/CHSH setup:
 *  - Alice chooses between analyzer settings a, a′
 *  - Bob chooses between b, b′
 * Each measurement yields ±1 outcomes.
 *
 * The correlation between outcomes at angle difference θ is:
 *     E(θ) = ⟨A(θ_A) * B(θ_B)⟩
 *
 * For the *quantum singlet state* (maximally entangled spins),
 *     E_Q(θ) = −cos(θ)
 * For a simple *classical local hidden variable* (LHV) model:
 *     E_C(θ) = 1 − 2θ/π
 * 
 * The CHSH inequality combines four correlations:
 *     S = | E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′) |
 * Classically: |S| ≤ 2
 * Quantum mechanically: |S| ≤ 2√2  ≈ 2.828
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
  a:   "#0ea5e9", // sky-500
  aP:  "#0369a1", // sky-800
  b:   "#22c55e", // green-500
  bP:  "#166534", // green-800
};

// --- Utility math helpers ---
/** Convert degrees → radians. Essential since trig functions use radians. */
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Wrap any degree value into the canonical [0, 360) interval. */
const wrapDeg = (d: number) => ((d % 360) + 360) % 360;

/**
 * Return the smallest angular separation between two orientations in degrees.
 * In this CHSH context, analyzer directions 180° apart are physically equivalent,
 * so the effective relative angle lies in [0°, 180°].
 */
const angleDiff = (a: number, b: number) => {
  const diff = Math.abs(wrapDeg(a) - wrapDeg(b));
  return diff > 180 ? 360 - diff : diff; // [0,180]
};

/**
 * Quantum prediction for the singlet state:
 *   E_Q(θ) = −cos(θ)
 * Negative sign encodes perfect anti-correlation at θ = 0°.
 */
const E_quantum = (thetaDeg: number) => -Math.cos(toRad(thetaDeg));

/**
 * A simple classical (local hidden-variable) model:
 *   E_C(θ) = 1 − 2θ/π
 * Linear in θ and respects the classical Bell bound |S| ≤ 2.
 */
const E_classical = (thetaDeg: number) => 1 - (2 * toRad(thetaDeg)) / Math.PI;

/**
 * Compute the CHSH value |S| and the four contributing correlations.
 *
 * Inputs: analyzer settings a, a′, b, b′ (in degrees), and a correlation function corr(θ).
 * CHSH: S = | E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′) |
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

/**
 * Build a dense table of E(θ) for θ ∈ [0°, 180°] used by the plotted curve.
 */
function buildCurve(corr: (thetaDeg: number) => number) {
  const data: { theta: number; E: number }[] = [];
  for (let t = 0; t <= 180; t += 2) data.push({ theta: t, E: +corr(t).toFixed(4) });
  return data;
}

// --- Reference presets ---
// These settings are convenient landmarks; the first is near the maximum quantum violation |S| = 2√2.
const presets = [
  { name: "Quantum-optimal", a: 0, aP: 45, b: 22.5, bP: 67.5 },
  { name: "Aligned", a: 0, aP: 90, b: 0, bP: 90 },
  { name: "Orthogonal pairs", a: 0, aP: 90, b: 45, bP: 135 },
];

export default function QuantumCorrelationEngine() {
  // Analyzer orientations for Alice (a, a′) and Bob (b, b′)
  const [angles, setAngles] = useState({ a: 0, aP: 45, b: 22.5, bP: 67.5 });

  // Active physical model: "quantum" (E_Q) or "classical" (E_C)
  const [model, setModel] = useState<"quantum" | "classical">("quantum");

  // Select the correlation function for the chosen model
  const corr = useMemo(() => (model === "quantum" ? E_quantum : E_classical), [model]);

  // Precompute the smooth E(θ) plot for the active model
  const curve = useMemo(() => buildCurve(corr), [corr]);

  // Compute the CHSH magnitude and the four term values for the current angles
  const result = useMemo(
    () => computeS(angles.a, angles.aP, angles.b, angles.bP, corr),
    [angles, corr]
  );

  // Quantum violation if |S| > 2 (with a tiny cushion to avoid floating-point wobble)
  const violation = result.S > 2 + 1e-9;

  // --- Individual CHSH points (kept separate to color-match UI and 3D scene) ---
  const pt_ab   = useMemo(() => [{ theta: angleDiff(angles.a,  angles.b),  E: corr(angleDiff(angles.a,  angles.b))  }], [angles, corr]);
  const pt_abP  = useMemo(() => [{ theta: angleDiff(angles.a,  angles.bP), E: corr(angleDiff(angles.a,  angles.bP)) }], [angles, corr]);
  const pt_aPb  = useMemo(() => [{ theta: angleDiff(angles.aP, angles.b),  E: corr(angleDiff(angles.aP, angles.b))  }], [angles, corr]);
  const pt_aPbP = useMemo(() => [{ theta: angleDiff(angles.aP, angles.bP), E: corr(angleDiff(angles.aP, angles.bP)) }], [angles, corr]);

  // Apply one of the reference angle presets
  const applyPreset = (p: typeof presets[number]) =>
    setAngles({ a: p.a, aP: p.aP, b: p.b, bP: p.bP });

  return (
    <div className="w-full min-h-screen p-6 md:p-10 bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="max-w-6xl mx-auto grid gap-6 md:gap-8">
        {/* ---------------------------------------------------------- */}
        {/* Header: title + model toggle                              */}
        {/* ---------------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Quantum Correlation Engine</h1>
            <p className="text-slate-600 mt-1">
              Fully client-side simulator of EPR–Bell correlations. Toggle models, set analyzer angles, and
              see the CHSH value S update in real time.
            </p>
          </div>
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

        {/* ---------------------------------------------------------- */}
        {/* Controls: sliders, presets/about, 3D scene                  */}
        {/* ---------------------------------------------------------- */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-6">
            <CardTitle className="text-lg">Measurement Settings (degrees)</CardTitle>
          </CardHeader>

          <CardContent className="grid md:grid-cols-2 gap-6 px-6 pb-6">
            {/* Sliders for a, a′, b, b′ (restricted to [0°, 180°]) */}
            <div className="grid gap-4">
              <AngleSlider label="a"   value={angles.a}   color={COLORS.a}  onChange={(v) => setAngles({ ...angles, a: v })} />
              <AngleSlider label="a′"  value={angles.aP}  color={COLORS.aP} onChange={(v) => setAngles({ ...angles, aP: v })} />
              <AngleSlider label="b"   value={angles.b}   color={COLORS.b}  onChange={(v) => setAngles({ ...angles, b: v })} />
              <AngleSlider label="b′"  value={angles.bP}  color={COLORS.bP} onChange={(v) => setAngles({ ...angles, bP: v })} />
            </div>

            {/* Presets / About tabs + 3D scene */}
            <div className="grid gap-4">
              <Tabs defaultValue="presets" className="w-full">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                  <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>

                {/* Quick angle presets (also listed again near the CHSH card for convenience) */}
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
                      “Quantum-optimal” is near the settings that maximize |S| in the quantum model.
                    </div>
                  </div>
                </TabsContent>

                {/* Inline theory primer for context */}
                <TabsContent value="about" className="pt-3">
                  <div className="text-sm text-slate-600 leading-relaxed flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div className="space-y-2">
                      <p>
                        Alice and Bob each choose between two analyzer orientations (a,a′ for Alice; b,b′ for Bob).
                        The simulator computes four correlations E(a,b), E(a,b′), E(a′,b), E(a′,b′) and combines them
                        into the CHSH value S = |E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)|.
                      </p>
                      <p>
                        The “Quantum” model uses the singlet prediction E(θ)=−cosθ. The “Classical” model uses a
                        simple local-hidden-variable correlation E(θ)=1−2θ/π, which never exceeds the classical
                        Bell bound |S|≤2. Quantum correlations can reach |S|=2√2.
                      </p>
                      <p className="text-xs">
                        Tip: the 3D magnets and the slider labels share colors with the four CHSH sample points below.
                        Adjust angles and watch the points move along the correlation curve.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 3D visualization of analyzer vectors (keeps UI mentally grounded) */}
              <AnalyzerScene3D a={angles.a} aP={angles.aP} b={angles.b} bP={angles.bP} />
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------- */}
        {/* Results: correlation curve + CHSH sample points & summary   */}
        {/* ---------------------------------------------------------- */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Correlation curve (continuous E(θ)) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-lg">Correlation Curve E(θ)</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 10, right: 14, bottom: 10, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="theta" type="number" domain={[0, 180]} tickCount={10}
                      tickFormatter={(v) => `${v}°`} label={{ value: "θ (deg)", position: "insideBottom", dy: 10 }} />
                    <YAxis domain={[-1, 1]} tickCount={5} />
                    <Tooltip formatter={(v: any) => (typeof v === "number" && v.toFixed ? v.toFixed(4) : v)}
                             labelFormatter={(l) => `θ = ${l}°`} />
                    <ReferenceLine y={0} />
                    <Line type="monotone" dataKey="E" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Always display the four CHSH points (color-coded by analyzer pairing) */}
              <div className="h-40 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 14, bottom: 10, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="theta" type="number" domain={[0, 180]}
                      tickFormatter={(v) => `${v}°`}
                      label={{ value: "θ for CHSH terms (deg)", position: "insideBottom", dy: 10 }} />
                    <YAxis dataKey="E" domain={[-1, 1]} />
                    <ZAxis dataKey={() => 120} range={[120, 120]} />
                    <Tooltip formatter={(v: any) => (typeof v === "number" ? v.toFixed(4) : v)}
                             labelFormatter={(l) => `θ = ${l}°`} />
                    {/* Four distinct series so each can have its own consistent color */}
                    <Scatter name="E(a,b)"     data={pt_ab}   fill={COLORS.a} />
                    <Scatter name="E(a,b′)"    data={pt_abP}  fill={COLORS.aP} />
                    <Scatter name="E(a′,b)"    data={pt_aPb}  fill={COLORS.b} />
                    <Scatter name="E(a′,b′)"   data={pt_aPbP} fill={COLORS.bP} />
                    <ReferenceLine y={0} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* CHSH numeric summary with violation highlight */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-6">
              <CardTitle className="text-lg">CHSH Result</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-4">
                {/* Individual correlation values (kept small and tabular for readability) */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ValueBox label="E(a,b)"   value={result.terms.ab}   color={COLORS.a} />
                  <ValueBox label="E(a,b′)"  value={result.terms.abP}  color={COLORS.aP} />
                  <ValueBox label="E(a′,b)"  value={result.terms.aPb}  color={COLORS.b} />
                  <ValueBox label="E(a′,b′)" value={result.terms.aPbP} color={COLORS.bP} />
                </div>

                {/* S value with clear classical-bound cueing */}
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

                {/* Quick-access presets and a reset shortcut */}
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
 * Thin wrapper around the shadcn/ui Slider to present an angle value.
 * Shows the current numeric value and uses a color cue to match plots/3D scene.
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
        className="h-6"               // slimmer track so sliders don’t look oversized
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
