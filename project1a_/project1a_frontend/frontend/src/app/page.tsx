"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import BlochSphere from "../components/BlochSphere";
import GatePalette from "../components/GatePalette";
import GateEditor from "../components/GateEditor";
import type { CircuitStep, Gate } from "../types";

type BlochVector = { x: number; y: number; z: number };
type StepResult = { bloch_vector: BlochVector; density_matrix: number[][][] };
type RunResponse = { steps: StepResult[] };

/** ---------- Math helpers ---------- */
function length(v: BlochVector) { return Math.hypot(v.x, v.y, v.z); }
function normalize(v: BlochVector): BlochVector { const L = length(v) || 1; return { x: v.x/L, y: v.y/L, z: v.z/L }; }
function dot(a: BlochVector, b: BlochVector) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function vecLerp(a: BlochVector, b: BlochVector, t: number): BlochVector { return { x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t), z: lerp(a.z,b.z,t) }; }
function slerpUnit(a: BlochVector, b: BlochVector, t: number): BlochVector {
  const an = normalize(a), bn = normalize(b);
  const cosom = Math.max(-1, Math.min(1, dot(an, bn)));
  const EPS = 1e-6;
  if (1 - Math.abs(cosom) < EPS) {
    const v = vecLerp(an, bn, t); const L = length(v);
    return L > EPS ? { x: v.x/L, y: v.y/L, z: v.z/L } : an;
  }
  const omega = Math.acos(cosom), sinom = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinom, s1 = Math.sin(t * omega) / sinom;
  return { x: s0*an.x + s1*bn.x, y: s0*an.y + s1*bn.y, z: s0*an.z + s1*bn.z };
}
function easeInOutCubic(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }

/** ---------- Angle snapping helpers (for θ) ---------- */
const TAU = Math.PI * 2;
function normAngle(a: number) { let x = a % TAU; if (x < 0) x += TAU; return x; }
const SNAP_POINTS = Array.from({ length: 24 + 1 }, (_, k) => (k * TAU) / 24);
function snapAngle(val: number, tol = 0.025) {
  const x = normAngle(val);
  let best = x, snapped = false, bestDist = Infinity;
  for (const p of SNAP_POINTS) {
    const d = Math.min(Math.abs(x - p), TAU - Math.abs(x - p));
    if (d < bestDist) { bestDist = d; best = p; }
  }
  if (bestDist <= tol) snapped = true;
  return { val: snapped ? best : x, snapped };
}
function gcd(a: number, b: number): number { while (b) { const t = b; b = a % b; a = t; } return Math.abs(a); }
function formatTheta(theta: number) {
  const x = normAngle(theta);
  const n12 = Math.round((x / Math.PI) * 12); // multiples of (π/12)
  const g12 = gcd(Math.abs(n12), 12);
  const a = n12 / g12; // numerator
  const b = 12 / g12;  // denominator
  if (Math.abs(x) < 1e-6) return "0";
  if (Math.abs(x - TAU) < 1e-6) return "2π";
  if (b === 1) return a === 1 ? "π" : `${a}π`;
  return a === 1 ? `π/${b}` : `${a}π/${b}`;
}

/** ---------- Component ---------- */
export default function HomePage() {
  const [workspace, setWorkspace] = useState<CircuitStep[]>([]);
  const [results, setResults] = useState<StepResult[] | null>(null);

  // selection for inline editing
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIndex = useMemo(() => workspace.findIndex(s => s.id === selectedId), [workspace, selectedId]);
  const selectedStep = selectedIndex >= 0 ? workspace[selectedIndex] : null;

  // playback state
  const [idx, setIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // animation config
  const [stepDurationMs, setStepDurationMs] = useState(900);
  const rafRef = useRef<number | null>(null);
  const tweenStartRef = useRef<number>(0);
  const tweenFromRef = useRef<BlochVector | null>(null);
  const tweenToRef = useRef<BlochVector | null>(null);
  const tweenModeRef = useRef<"slerp" | "lerp">("slerp");
  const tweenIndexRef = useRef<number>(0);

  // auto-run after edits
  const [autoRun, setAutoRun] = useState<boolean>(true);
  const debounceRef = useRef<number | null>(null);

  // rendered BV (uses tween if active)
  const [renderBV, setRenderBV] = useState<BlochVector | undefined>(undefined);

  // instant BV when not tweening
  const instantBV: BlochVector | undefined = useMemo(() => {
    if (!results || results.length === 0) return undefined;
    const i = Math.max(0, Math.min(idx, results.length - 1));
    return results[i].bloch_vector;
  }, [results, idx]);

  useEffect(() => { if (rafRef.current == null) setRenderBV(instantBV); }, [instantBV]);

  function cancelTween() { if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }

  function beginTween(from: BlochVector, to: BlochVector, mode: "slerp" | "lerp", fromIndex: number) {
    cancelTween();
    tweenFromRef.current = from; tweenToRef.current = to;
    tweenModeRef.current = mode; tweenIndexRef.current = fromIndex;
    tweenStartRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const tRaw = (now - tweenStartRef.current) / stepDurationMs;
      const t = Math.max(0, Math.min(1, easeInOutCubic(tRaw)));
      const a = tweenFromRef.current!, b = tweenToRef.current!;
      const v = mode === "slerp" ? slerpUnit(a, b, t) : vecLerp(a, b, t);
      setRenderBV(v);

      if (tRaw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIdx(tweenIndexRef.current + 1);
        rafRef.current = null;
        setRenderBV(b);
        if (isPlaying) stepToNextTween();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stepToNextTween() {
    if (!results || results.length === 0) return;
    const k = Math.max(0, Math.min(idx, results.length - 1));
    if (k >= results.length - 1) { setIsPlaying(false); return; }
    const from = results[k].bloch_vector;
    const to = results[k + 1].bloch_vector;
    const nextStep = workspace[k];
    const mode: "slerp" | "lerp" = nextStep?.type === "noise" ? "lerp" : "slerp";
    beginTween(from, to, mode, k);
  }

  function handlePlayPause() {
    if (!results || results.length <= 1) return;
    if (isPlaying) { setIsPlaying(false); cancelTween(); return; }
    if (idx >= results.length - 1) setIdx(0);
    setIsPlaying(true); stepToNextTween();
  }
  function handlePrev() { if (!results || results.length === 0) return; setIsPlaying(false); cancelTween(); setIdx(v => Math.max(0, v - 1)); }
  function handleNext() { if (!results || results.length === 0) return; setIsPlaying(false); cancelTween(); setIdx(v => Math.min(results.length - 1, v + 1)); }
  function handleScrub(val: number) { if (!results || results.length === 0) return; setIsPlaying(false); cancelTween(); setIdx(val); }

  function resetWorkspace() {
    setWorkspace([]); setResults(null); setIdx(0); setIsPlaying(false); cancelTween(); setRenderBV(undefined); setSelectedId(null);
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
  }

  async function runCircuit() {
    if (!workspace.length) { setResults(null); setRenderBV(undefined); return; }
    setIsRunning(true); setIsPlaying(false); cancelTween();
    try {
      const res = await fetch("/api/run_circuit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps: workspace })
      });
      const data: RunResponse = await res.json();
      const steps = data.steps ?? [];
      setResults(steps); setIdx(0); setRenderBV(steps[0]?.bloch_vector);
    } catch (e) { console.error(e); } finally { setIsRunning(false); }
  }

  // auto-run debounce on workspace changes
  useEffect(() => {
    if (!autoRun) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { runCircuit(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  /** Palette: add a generic Rotation (θ) gate (op "R"). */
  const palette: Gate[] = [
    { id: 1, name: "X Gate", type: "gate", op: "X" },
    { id: 2, name: "Z Gate", type: "gate", op: "Z" },
    { id: 3, name: "H Gate", type: "gate", op: "H" },
    { id: 4, name: "Rotation (θ)", type: "gate", op: "R", parameter: Math.PI / 2 }, // NEW
    { id: 5, name: "Amplitude Damping (γ)", type: "noise", op: "amplitude_damping", parameter: 0.1 },
    { id: 6, name: "Phase Damping (λ)", type: "noise", op: "phase_damping", parameter: 0.1 },
    { id: 7, name: "Depolarizing (p)", type: "noise", op: "depolarizing", parameter: 0.05 },
  ];

  const stepsCount = results?.length ?? 0;
  const atStart = idx <= 0;
  const atEnd = stepsCount === 0 || idx >= stepsCount - 1;

  // ---- Inline Parameter Editor helpers ----
  function isRotationGate(s: CircuitStep | null) {
    return !!s && s.type === "gate" && /^R[xyz]$/i.test(s.name);
  }
  function currentParamName(s: CircuitStep | null): string | null {
    if (!s) return null;
    if (s.type === "gate") return "theta";
    if (s.name === "amplitude_damping") return "gamma";
    if (s.name === "phase_damping") return "lambda";
    return "p";
  }
  function currentParamRange(s: CircuitStep | null): [number, number, number] {
    if (!s) return [0, 1, 0.01];
    if (s.type === "gate") return [0, Math.PI * 2, 0.001];
    return [0, 1, 0.01];
  }
  const paramKey = currentParamName(selectedStep);
  const [minV, maxV, stepV] = currentParamRange(selectedStep);
  const currentValue: number | undefined = selectedStep && paramKey ? (selectedStep.params?.[paramKey] as number) : undefined;

  const [thetaWasSnapped, setThetaWasSnapped] = useState(false);

  function updateSelectedParam(val: number) {
    if (!selectedStep || !paramKey) return;
    if (paramKey === "theta") {
      const { val: snappedVal, snapped } = snapAngle(val, 0.025);
      setThetaWasSnapped(snapped);
      setWorkspace(prev =>
        prev.map((s) =>
          s.id === selectedStep.id ? { ...s, params: { ...(s.params || {}), [paramKey]: snappedVal } } : s
        )
      );
      return;
    }
    setWorkspace(prev =>
      prev.map((s) =>
        s.id === selectedStep.id ? { ...s, params: { ...(s.params || {}), [paramKey]: val } } : s
      )
    );
  }

  // NEW: axis switcher for Rotation gate (actually switches step.name among Rx/Ry/Rz)
  function setAxis(axis: "x" | "y" | "z") {
    if (!selectedStep) return;
    if (selectedStep.type !== "gate") return;
    const newName = axis === "x" ? "Rx" : axis === "y" ? "Ry" : "Rz";
    setWorkspace(prev => prev.map(s => s.id === selectedStep.id ? { ...s, name: newName } : s));
  }
  function currentAxis(): "x" | "y" | "z" | null {
    if (!isRotationGate(selectedStep)) return null;
    const ch = selectedStep!.name[1]?.toLowerCase();
    return ch === "x" || ch === "y" || ch === "z" ? ch : null;
  }

  // P(0) / P(1) from current Bloch vector (z)
  const prob = useMemo(() => {
    const v = renderBV || instantBV;
    if (!v) return null;
    const z = Math.max(-1, Math.min(1, v.z));
    const p0 = (1 + z) / 2;
    return { p0, p1: 1 - p0 };
  }, [renderBV, instantBV]);

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Layout: [LEFT steps] [CENTER sphere] [RIGHT palette + workspace] */}
      <div className="h-screen w-screen bg-black text-zinc-100 p-4 grid grid-cols-[320px_1fr_360px] gap-4">
        {/* LEFT: Steps list */}
        <div className="bg-zinc-900 p-3 rounded border border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Steps</div>
            <label className="flex items-center gap-2 text-[11px] text-zinc-400">
              <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
              Auto-run
            </label>
          </div>

          <div className="mt-2 overflow-auto space-y-2 max-h-64 md:max-h-72">
            {workspace.length === 0 ? (
              <p className="text-zinc-500">No steps added yet.</p>
            ) : (
              workspace.map((s, i) => (
                <div key={s.id} className="bg-zinc-800 rounded px-2 py-1">
                  {i + 1}. {s.type}: {s.name}{" "}
                  {s.params ? <span className="text-zinc-400 text-xs">{JSON.stringify(s.params)}</span> : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 shrink-0">
            <div className="text-xs text-zinc-400">Animation duration (per step)</div>
            <input
              type="range" min={200} max={2000} step={50}
              value={stepDurationMs}
              onChange={(e) => setStepDurationMs(parseInt(e.target.value, 10))}
              className="w-full mt-1"
            />
            <div className="text-xs text-zinc-400">{stepDurationMs} ms</div>
          </div>
          <div className="mt-3 text-xs text-zinc-400 leading-snug shrink-0">
            <b>Tip:</b> Gates rotate the state (arc on the sphere). Noise contracts or shifts it (straight path).
          </div>
        </div>

        {/* CENTER: Sphere + transport controls */}
        <div className="bg-zinc-900 p-3 rounded border border-zinc-800 flex flex-col gap-3">
          <div className="text-sm font-semibold">Bloch Sphere</div>
          <BlochSphere blochVector={renderBV} />

          <div className="mt-2 p-2 bg-zinc-950 rounded border border-zinc-800">
            <div className="flex items-center gap-2">
              <button onClick={handlePrev} disabled={!results || atStart} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-2 py-1" title="Previous step">◀</button>
              <button onClick={handlePlayPause} disabled={!results || stepsCount <= 1} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-3 py-1" title={isPlaying ? "Pause" : "Play (animate transitions)"}>{isPlaying ? "❚❚" : "▶"}</button>
              <button onClick={handleNext} disabled={!results || atEnd} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-2 py-1" title="Next step">▶</button>
              <div className="ml-3 text-xs text-zinc-400">{results ? `Step ${idx + 1} / ${stepsCount}` : "No results yet"}</div>
            </div>

            <input
              type="range" className="w-full mt-2"
              min={0} max={Math.max(0, stepsCount - 1)}
              value={Math.min(idx, Math.max(0, stepsCount - 1))}
              onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
              disabled={!results || stepsCount === 0}
            />
          </div>

          <div className="text-xs text-zinc-300 flex items-center gap-4">
            {renderBV ? (
              <>
                <span>x={renderBV.x.toFixed(3)}</span>
                <span>y={renderBV.y.toFixed(3)}</span>
                <span>z={renderBV.z.toFixed(3)}</span>
              </>
            ) : <span>—</span>}
            {prob && (
              <span className="ml-auto text-zinc-400">
                P(0)={prob.p0.toFixed(3)} · P(1)={prob.p1.toFixed(3)}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Palette + Run/Reset + Workspace editor + Inline Param Editor */}
        <div className="bg-zinc-900 p-3 rounded border border-zinc-800 flex flex-col gap-3">
          <div className="text-sm font-semibold">Gate Palette</div>
          <GatePalette gates={palette} />

          <div className="flex gap-2">
            <button
              onClick={runCircuit}
              className="bg-zinc-200 text-black rounded px-3 py-1 disabled:opacity-60"
              disabled={isRunning || workspace.length === 0}
              title={workspace.length === 0 ? "Add steps first" : "Run circuit"}
            >
              {isRunning ? "Running..." : "Run"}
            </button>
            <button onClick={resetWorkspace} className="bg-zinc-800 text-zinc-200 rounded px-3 py-1">Reset</button>
          </div>

          <div className="text-sm font-semibold">Workspace Editor</div>
          <GateEditor
            workspace={workspace}
            setWorkspace={setWorkspace}
            onSelectStep={(s) => setSelectedId(s.id)}
            selectedId={selectedId}
            onMoveUp={(id) => setWorkspace(prev => {
              const i = prev.findIndex(s => s.id === id); if (i <= 0) return prev;
              const copy = prev.slice(); const [item] = copy.splice(i, 1); copy.splice(i - 1, 0, item); return copy;
            })}
            onMoveDown={(id) => setWorkspace(prev => {
              const i = prev.findIndex(s => s.id === id); if (i < 0 || i >= prev.length - 1) return prev;
              const copy = prev.slice(); const [item] = copy.splice(i, 1); copy.splice(i + 1, 0, item); return copy;
            })}
            onDelete={(id) => { setWorkspace(prev => prev.filter(s => s.id !== id)); if (selectedId === id) setSelectedId(null); }}
          />

          {/* Inline Parameter Editor */}
          <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded p-3">
            <div className="text-sm font-semibold">Parameter Editor</div>
            {!selectedStep ? (
              <div className="text-xs text-zinc-500 mt-1">Select a step to edit its parameter.</div>
            ) : (
              <>
                <div className="text-xs text-zinc-400 mt-1">
                  Editing: <span className="text-zinc-200">
                    {selectedStep.type === "gate" ? selectedStep.name : `${selectedStep.name} (noise)`}
                  </span>
                </div>

                {/* Axis switcher for rotation gates */}
                {isRotationGate(selectedStep) && (
                  <div className="mt-2">
                    <div className="text-xs text-zinc-400 mb-1">Axis</div>
                    <div className="flex gap-1">
                      {(["x", "y", "z"] as const).map(ax => {
                        const active = currentAxis() === ax;
                        return (
                          <button
                            key={ax}
                            onClick={() => setAxis(ax)}
                            className={`px-2 py-1 rounded text-xs border ${
                              active
                                ? "bg-blue-600/40 border-blue-500"
                                : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                            }`}
                          >
                            {ax.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <label className="text-xs text-zinc-400">
                    {paramKey === "theta" ? "θ (radians)" :
                     paramKey === "gamma" ? "γ" :
                     paramKey === "lambda" ? "λ" : "p"}
                  </label>
                  <input
                    type="range"
                    min={minV}
                    max={maxV}
                    step={stepV}
                    value={currentValue ?? minV}
                    onChange={(e) => updateSelectedParam(parseFloat(e.target.value))}
                    className="w-full mt-1"
                  />
                  <div className="text-xs text-zinc-300 mt-1 flex items-center gap-2">
                    {currentValue !== undefined
                      ? (paramKey === "theta"
                          ? `${(normAngle(currentValue)).toFixed(3)} rad`
                          : currentValue.toFixed(3))
                      : "—"}
                    {paramKey === "theta" && currentValue !== undefined && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-200">{formatTheta(currentValue)}</span>
                        {thetaWasSnapped && (
                          <span className="ml-2 px-1.5 py-[1px] rounded bg-emerald-900/50 border border-emerald-700 text-emerald-200 text-[10px]">
                            snapped
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
