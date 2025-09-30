"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import BlochSphere from "../components/BlochSphere";
import GatePalette from "../components/GatePalette";
import GateEditor from "../components/GateEditor";
import type { CircuitStep, Gate, Noise, PaletteItem } from "../types";

type BlochVector = { x: number; y: number; z: number };
type StepResult = { bloch_vector: BlochVector; density_matrix: number[][][] };
type RunResponse = { steps: StepResult[] };

/* vector helpers, slerp w/ antipode handling — unchanged for brevity */
function length(v: BlochVector) { return Math.hypot(v.x, v.y, v.z); }
function normalize(v: BlochVector): BlochVector { const L = length(v) || 1; return { x: v.x / L, y: v.y / L, z: v.z / L }; }
function dot(a: BlochVector, b: BlochVector) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: BlochVector, b: BlochVector): BlochVector { return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x }; }
function add(a: BlochVector, b: BlochVector): BlochVector { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(v: BlochVector, s: number): BlochVector { return { x: v.x*s, y: v.y*s, z: v.z*s }; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function vecLerp(a: BlochVector, b: BlochVector, t: number): BlochVector { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }; }
function rotateAroundAxis(v: BlochVector, k: BlochVector, t: number): BlochVector {
  const cos = Math.cos(t), sin = Math.sin(t);
  return add(add(scale(v, cos), scale(cross(k, v), sin)), scale(k, (dot(k, v)) * (1 - cos)));
}
function slerpUnit(a: BlochVector, b: BlochVector, t: number): BlochVector {
  const an = normalize(a), bn = normalize(b);
  let c = Math.max(-1, Math.min(1, dot(an, bn)));
  if (1 - Math.abs(c) < 1e-6 && c > 0) {
    const v = vecLerp(an, bn, t);
    const L = length(v);
    return L > 1e-6 ? scale(v, 1 / L) : an;
  }
  if (Math.abs(c + 1) < 1e-6) {
    const zAxis: BlochVector = { x: 0, y: 0, z: 1 };
    const xAxis: BlochVector = { x: 1, y: 0, z: 0 };
    let k = cross(an, zAxis);
    if (length(k) < 1e-6) k = cross(an, xAxis);
    k = normalize(k);
    return normalize(rotateAroundAxis(an, k, Math.PI * t));
  }
  const omega = Math.acos(c);
  const sinom = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinom;
  const s1 = Math.sin(t * omega) / sinom;
  return normalize({ x: s0 * an.x + s1 * bn.x, y: s0 * an.y + s1 * bn.y, z: s0 * an.z + s1 * bn.z });
}
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export default function HomePage() {
  const [workspace, setWorkspace] = useState<CircuitStep[]>([]);
  const [results, setResults] = useState<StepResult[] | null>(null);

  // latest workspace for auto-run
  const workspaceRef = useRef<CircuitStep[]>(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  // playback
  const [idx, setIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // auto-run
  const [autoRun, setAutoRun] = useState(true);
  const autoRunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeAutoRun = () => {
    if (!autoRun) return;
    if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
    autoRunTimer.current = setTimeout(() => {
      if (workspaceRef.current.length > 0) runCircuit();
    }, 250);
  };

  // animation
  const [stepDurationMs, setStepDurationMs] = useState(900);
  const rafRef = useRef<number | null>(null);
  const tweenStartRef = useRef<number>(0);
  const tweenFromRef = useRef<BlochVector | null>(null);
  const tweenToRef = useRef<BlochVector | null>(null);
  const tweenModeRef = useRef<"slerp" | "lerp">("slerp");
  const tweenIndexRef = useRef<number>(0);

  const [renderBV, setRenderBV] = useState<BlochVector | undefined>(undefined);
  const instantBV: BlochVector | undefined = useMemo(() => {
    if (!results || results.length === 0) return undefined;
    const i = Math.max(0, Math.min(idx, results.length - 1));
    return results[i].bloch_vector;
  }, [results, idx]);
  useEffect(() => { if (rafRef.current == null) setRenderBV(instantBV); }, [instantBV]);

  function cancelTween() { if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }

  function beginTween(from: BlochVector, to: BlochVector, mode: "slerp" | "lerp", fromIndex: number) {
    cancelTween();
    tweenFromRef.current = from;
    tweenToRef.current = to;
    tweenModeRef.current = mode;
    tweenIndexRef.current = fromIndex;
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
        setIsPlaying(false); // show ▶ after each tween
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePlayPause() {
    if (!results || results.length <= 1) return;
    if (isPlaying) { setIsPlaying(false); cancelTween(); return; }
    const k = Math.max(0, Math.min(idx, results.length - 2));
    const from = results[k].bloch_vector;
    const to = results[k + 1].bloch_vector;
    const step = workspace[k];
    const mode: "slerp" | "lerp" = step?.type === "noise" ? "lerp" : "slerp";
    setIsPlaying(true);
    beginTween(from, to, mode, k);
  }
  function handlePrev() { if (!results) return; setIsPlaying(false); cancelTween(); setIdx((v) => Math.max(0, v - 1)); }
  function handleNext() { if (!results) return; setIsPlaying(false); cancelTween(); setIdx((v) => Math.min((results?.length ?? 1) - 1, v + 1)); }
  function handleScrub(val: number) { if (!results) return; setIsPlaying(false); cancelTween(); setIdx(val); }

  function resetWorkspace() {
    setWorkspace([]); setResults(null); setIdx(0); setIsPlaying(false); cancelTween(); setRenderBV(undefined);
  }

  async function runCircuit() {
    if (!workspaceRef.current.length) return;
    setIsRunning(true); setIsPlaying(false); cancelTween();
    try {
      const res = await fetch("/api/run_circuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: workspaceRef.current }),
      });
      const data: RunResponse = await res.json();
      const steps = data.steps ?? [];
      setResults(steps);
      setIdx(0);
      setRenderBV(steps[0]?.bloch_vector);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  }

  // 📌 PALETTE: add Y, keep one Rotation (θ)
  const palette: PaletteItem[] = [
    { id: 1, type: "gate", name: "X Gate", op: "X" } as Gate,
    { id: 2, type: "gate", name: "Y Gate", op: "Y" } as Gate,
    { id: 3, type: "gate", name: "Z Gate", op: "Z" } as Gate,
    { id: 4, type: "gate", name: "H Gate", op: "H" } as Gate,
    { id: 5, type: "gate", name: "Rotation (θ)", op: "Rx", parameter: Math.PI / 4 } as Gate, // axis set in editor
    { id: 6, type: "noise", name: "Amplitude Damping (γ)", op: "amplitude_damping", parameter: 0.1 } as Noise,
    { id: 7, type: "noise", name: "Phase Damping (λ)", op: "phase_damping", parameter: 0.1 } as Noise,
    { id: 8, type: "noise", name: "Depolarizing (p)", op: "depolarizing", parameter: 0.05 } as Noise,
  ];

  const stepsCount = results?.length ?? 0;
  const atStart = idx <= 0;
  const atEnd = stepsCount === 0 || idx >= stepsCount - 1;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-screen p-4 grid grid-cols-[320px_1fr_360px] gap-4"
           style={{ background: "var(--background)", color: "var(--foreground)" }}>
        {/* LEFT: Steps */}
        <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/60 flex flex-col">
          <div className="text-sm font-semibold">Steps</div>
          <div className="mt-2 flex-1 overflow-auto space-y-2">
            {workspace.length === 0 ? (
              <p className="text-zinc-500">No steps added yet.</p>
            ) : (
              workspace.map((s, i) => (
                <div key={s.id} className="bg-zinc-800/60 rounded px-2 py-1">
                  {i + 1}. {s.type}: {s.name}{" "}
                  {"params" in s && s.params ? (
                    <span className="text-zinc-400 text-xs">{JSON.stringify(s.params)}</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <div className="text-xs text-zinc-400">Animation duration (per step)</div>
            <input type="range" min={200} max={2000} step={50}
              value={stepDurationMs} onChange={(e) => setStepDurationMs(parseInt(e.target.value, 10))}
              className="w-full mt-1" />
            <div className="text-xs text-zinc-400">{stepDurationMs} ms</div>
          </div>
          <div className="mt-3 text-xs text-zinc-400 leading-snug">
            <b>Tip:</b> Gates rotate the state (arc). Noise contracts/shifts it (straight path).
          </div>
        </div>

        {/* CENTER: Sphere + transport */}
        <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/60 flex flex-col gap-3">
          <div className="text-sm font-semibold">Bloch Sphere</div>
          <BlochSphere blochVector={renderBV} />
          <div className="mt-2 p-2 bg-zinc-950/60 rounded border border-zinc-800/60">
            <div className="flex items-center gap-2">
              <button onClick={handlePrev} disabled={!results || atStart}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-2 py-1" title="Previous">◀</button>
              <button onClick={handlePlayPause} disabled={!results || stepsCount <= 1}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-3 py-1"
                title={isPlaying ? "Pause" : "Play (animate transition)"}>
                {isPlaying ? "❚❚" : "▶"}
              </button>
              <button onClick={handleNext} disabled={!results || atEnd}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded px-2 py-1" title="Next">▶</button>
              <div className="ml-3 text-xs text-zinc-400">
                {results ? `Step ${idx + 1} / ${stepsCount}` : "No results yet"}
              </div>
            </div>
            <input
              type="range" className="w-full mt-2"
              min={0} max={Math.max(0, stepsCount - 1)}
              value={Math.min(idx, Math.max(0, stepsCount - 1))}
              onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
              disabled={!results || stepsCount === 0}
            />
          </div>
          {results && results.length > 0 && (
            <div className="text-xs text-zinc-300">
              {renderBV ? `x=${renderBV.x.toFixed(3)}, y=${renderBV.y.toFixed(3)}, z=${renderBV.z.toFixed(3)}` : "—"}
            </div>
          )}
        </div>

        {/* RIGHT: Palette + Editor */}
        <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/60 flex flex-col gap-3">
          <div className="text-sm font-semibold">Gate & Noise Palette</div>
          <GatePalette gates={palette} />
          <div className="text-sm font-semibold">Workspace Editor</div>
          <div className="min-h-[460px]">
            <GateEditor
              workspace={workspace}
              setWorkspace={setWorkspace}
              autoRun={autoRun}
              onToggleAutoRun={setAutoRun}
              onNudgeForAutoRun={nudgeAutoRun}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
