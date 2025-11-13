import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import AnalyzerDial from "@/components/ui/analyzerDial";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ZAxis,
} from "recharts";

// --- Utility math helpers ---
const toRad = (deg: number) => (deg * Math.PI) / 180;
const wrapDeg = (d: number) => ((d % 360) + 360) % 360;
const angleDiff = (a: number, b: number) => {
  // Return smallest angle between two directions, in [0, 180]
  const diff = Math.abs(wrapDeg(a) - wrapDeg(b));
  return diff > 180 ? 360 - diff : diff;
};

// Quantum correlation for singlet state: E_Q(θ) = -cos θ
const E_quantum = (thetaDeg: number) => -Math.cos(toRad(thetaDeg));

// A simple local-hidden-variable (LHV) analytic model yielding the triangular correlation:
// E_C(θ) = 1 - 2θ/π for θ in [0, π]. This respects |S| ≤ 2.
const E_classical = (thetaDeg: number) => 1 - (2 * toRad(thetaDeg)) / Math.PI;

// Compute CHSH S given four angle settings (degrees) and a correlation function.
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

// Build a dataset E(θ) for θ ∈ [0,180]
function buildCurve(corr: (thetaDeg: number) => number) {
  const data: { theta: number; E: number }[] = [];
  for (let t = 0; t <= 180; t += 2) data.push({ theta: t, E: +corr(t).toFixed(4) });
  return data;
}

// Suggested angles that maximize the quantum CHSH value: 0°, 45°, 22.5°, 67.5°
const presets = [
  { name: "Quantum-optimal", a: 0, aP: 45, b: 22.5, bP: 67.5 },
  { name: "Aligned", a: 0, aP: 90, b: 0, bP: 90 },
  { name: "Orthogonal pairs", a: 0, aP: 90, b: 45, bP: 135 },
];

export default function QuantumCorrelationEngine() {
  const [angles, setAngles] = useState({ a: 0, aP: 45, b: 22.5, bP: 67.5 });
  const [model, setModel] = useState<"quantum" | "classical">("quantum");
  const [showPoints, setShowPoints] = useState(true);

  const corr = useMemo(() => (model === "quantum" ? E_quantum : E_classical), [model]);
  const curve = useMemo(() => buildCurve(corr), [corr]);
  const result = useMemo(
    () => computeS(angles.a, angles.aP, angles.b, angles.bP, corr),
    [angles, corr]
  );

  const violation = result.S > 2 + 1e-9; // numerical cushion

  const pointData = [
    { theta: angleDiff(angles.a, angles.b), E: corr(angleDiff(angles.a, angles.b)) },
    { theta: angleDiff(angles.a, angles.bP), E: corr(angleDiff(angles.a, angles.bP)) },
    { theta: angleDiff(angles.aP, angles.b), E: corr(angleDiff(angles.aP, angles.b)) },
    { theta: angleDiff(angles.aP, angles.bP), E: corr(angleDiff(angles.aP, angles.bP)) },
  ];

  const applyPreset = (p: typeof presets[number]) => setAngles({ a: p.a, aP: p.aP, b: p.b, bP: p.bP });

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
          <div className="flex items-center gap-3">
            <Label htmlFor="modelSwitch" className="text-sm">{model === "quantum" ? "Quantum" : "Classical"}</Label>
            <Switch id="modelSwitch" checked={model === "quantum"} onCheckedChange={(v) => setModel(v ? "quantum" : "classical")} />
          </div>
        </div>

        {/* Controls */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Measurement Settings (degrees)</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="grid gap-5">
              <AngleSlider label="a" value={angles.a} onChange={(v) => setAngles({ ...angles, a: v })} />
              <AngleSlider label="a′ (a prime)" value={angles.aP} onChange={(v) => setAngles({ ...angles, aP: v })} />
              <AngleSlider label="b" value={angles.b} onChange={(v) => setAngles({ ...angles, b: v })} />
              <AngleSlider label="b′ (b prime)" value={angles.bP} onChange={(v) => setAngles({ ...angles, bP: v })} />
            </div>

            <div className="grid gap-4">
              <Tabs defaultValue="presets" className="w-full">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                  <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>
                <TabsContent value="presets" className="pt-3">
                  <div className="grid gap-2">
                    {presets.map((p) => (
                      <Button key={p.name} variant="secondary" className="justify-between" onClick={() => applyPreset(p)}>
                        <span>{p.name}</span>
                        <span className="text-xs text-slate-600">a={p.a}°, a′={p.aP}°, b={p.b}°, b′={p.bP}°</span>
                      </Button>
                    ))}
                    <div className="text-xs text-slate-500 mt-1">
                      The "Quantum-optimal" preset is close to the settings that maximize |S| in the quantum model.
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="about" className="pt-3">
                  <div className="text-sm text-slate-600 leading-relaxed flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <p>
                      Quantum model uses E(θ) = -cos θ for the singlet state. Classical model uses a simple
                      local-hidden-variable correlation E(θ) = 1 - 2θ/π, which always satisfies |S| ≤ 2.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-3">
                <Switch id="points" checked={showPoints} onCheckedChange={setShowPoints} />
                <Label htmlFor="points" className="text-sm">Show CHSH sample points on the curve</Label>
              </div>
                <AnalyzerDial a={angles.a} aP={angles.aP} b={angles.b} bP={angles.bP} />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Correlation Curve E(θ)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 10, right: 14, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="theta" type="number" domain={[0, 180]} tickCount={10} tickFormatter={(v) => `${v}°`} label={{ value: "θ (deg)", position: "insideBottom", dy: 10 }} />
                    <YAxis domain={[-1, 1]} tickCount={5} />
                    <Tooltip formatter={(v: any) => v.toFixed ? v.toFixed(4) : v} labelFormatter={(l) => `θ = ${l}°`} />
                    <ReferenceLine y={0} />
                    <Line type="monotone" dataKey="E" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {showPoints && (
                <div className="h-40 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 14, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="theta" type="number" domain={[0, 180]} tickFormatter={(v) => `${v}°`} label={{ value: "θ for CHSH terms (deg)", position: "insideBottom", dy: 10 }} />
                      <YAxis dataKey="E" domain={[-1, 1]} />
                      <ZAxis dataKey={() => 100} range={[100, 100]} />
                      <Tooltip formatter={(v: any) => (typeof v === "number" ? v.toFixed(4) : v)} labelFormatter={(l) => `θ = ${l}°`} />
                      <Scatter data={pointData} />
                      <ReferenceLine y={0} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">CHSH Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ValueBox label="E(a,b)" value={result.terms.ab} />
                  <ValueBox label="E(a,b′)" value={result.terms.abP} />
                  <ValueBox label="E(a′,b)" value={result.terms.aPb} />
                  <ValueBox label="E(a′,b′)" value={result.terms.aPbP} />
                </div>

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

                <div className="grid grid-cols-2 gap-3">
                  {presets.map((p) => (
                    <Button key={p.name} variant="outline" onClick={() => applyPreset(p)}>
                      Use preset: {p.name}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={() => setAngles({ a: 0, aP: 45, b: 22.5, bP: 67.5 })}>Reset</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer note */}
        <div className="text-xs text-slate-500">
          This is a pure frontend implementation (no backend). The quantum curve uses E(θ) = -cos θ; the classical curve uses
          a simple deterministic local model E(θ) = 1 - 2θ/π for θ ∈ [0, π].
        </div>
      </div>
    </div>
  );
}

function AngleSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm">{label}</Label>
        <div className="text-sm tabular-nums text-slate-700">{value.toFixed(1)}°</div>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={180}
        step={0.5}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3 bg-white/60">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-medium tabular-nums">{value.toFixed(4)}</div>
    </div>
  );
}
