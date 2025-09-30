"use client";
import React from "react";
import { useDrop } from "react-dnd";
import type { CircuitStep, PaletteItem, NoiseParams } from "../types";

interface GateEditorProps {
  workspace: CircuitStep[];
  setWorkspace: (ws: CircuitStep[] | ((prev: CircuitStep[]) => CircuitStep[])) => void;

  // Optional: parent-managed selection & ordering; if not provided, we fall back to internal behavior
  onSelectStep?: (step: CircuitStep) => void;
  selectedId?: number | null;
  onMoveUp?: (id: number) => void;
  onMoveDown?: (id: number) => void;
  onDelete?: (id: number) => void;

  // Auto-run controls (parent wires to runCircuit). We render the checkbox and call onToggle/onNudge.
  autoRun?: boolean;
  onToggleAutoRun?: (val: boolean) => void;
  onNudgeForAutoRun?: () => void; // call when workspace/params change
}

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...rest }) => (
  <button
    className={`px-1.5 py-0.5 text-[11px] rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 ${className}`}
    {...rest}
  >
    {children}
  </button>
);

function makeId() {
  return Number(`${Date.now()}${Math.floor(Math.random() * 1e6)}`);
}

type DragPayload = {
  kind: "palette-item";
  item: PaletteItem; // gate or noise
};

function isRotationGate(name: string): name is "Rx" | "Ry" | "Rz" {
  return name === "Rx" || name === "Ry" || name === "Rz";
}

function prettyTheta(theta?: number) {
  if (theta == null) return "—";
  const pi = Math.PI;
  const approx = (x: number) => Math.abs(x - theta) < 0.02; // ~1.1°
  const list: Array<[number, string]> = [
    [0, "0"],
    [pi/6, "π/6"],
    [pi/4, "π/4"],
    [pi/3, "π/3"],
    [pi/2, "π/2"],
    [2*pi/3, "2π/3"],
    [3*pi/4, "3π/4"],
    [5*pi/6, "5π/6"],
    [pi, "π"],
    [-pi/6, "-π/6"],
    [-pi/4, "-π/4"],
    [-pi/3, "-π/3"],
    [-pi/2, "-π/2"],
    [-3*pi/4, "-3π/4"],
    [-pi, "-π"],
  ];
  for (const [v, label] of list) if (approx(v)) return label;
  return theta.toFixed(3);
}

function snapTheta(theta: number) {
  const pi = Math.PI;
  const specials = [0, pi/6, pi/4, pi/3, pi/2, 2*pi/3, 3*pi/4, 5*pi/6, pi, -pi/6, -pi/4, -pi/3, -pi/2, -3*pi/4, -pi];
  let best = theta, bestd = Infinity;
  for (const v of specials) {
    const d = Math.abs(theta - v);
    if (d < bestd) { bestd = d; best = v; }
  }
  return bestd < 0.04 ? best : theta; // ~2.3° snap window
}

const GateEditor: React.FC<GateEditorProps> = ({
  workspace,
  setWorkspace,
  onSelectStep,
  selectedId,
  onMoveUp,
  onMoveDown,
  onDelete,
  autoRun = false,
  onToggleAutoRun,
  onNudgeForAutoRun,
}) => {
  // internal selection fallback if parent doesn't manage it
  const [localSelected, setLocalSelected] = React.useState<number | null>(null);
  const effectiveSelectedId = selectedId ?? localSelected;

  const [, drop] = useDrop<DragPayload, void>(() => ({
    accept: "PALETTE_ITEM",
    drop: (payload) => {
      const it = payload.item;
      const id = makeId();

      if (it.type === "gate") {
        const theta = it.parameter ?? (it.op.startsWith("R") ? Math.PI / 2 : undefined);
        const step: CircuitStep = {
          id,
          type: "gate",
          name: it.op, // "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz"
          params: theta != null ? { theta } : undefined,
        };
        setWorkspace((prev) => [...prev, step]);
      } else {
        const p = it.parameter ?? 0;
        const params: NoiseParams =
          it.op === "amplitude_damping" ? { gamma: p } :
          it.op === "phase_damping"     ? { lambda: p } :
                                          { p };
        const step: CircuitStep = {
          id,
          type: "noise",
          name: it.op, // "amplitude_damping" | "phase_damping" | "depolarizing"
          params,
        };
        setWorkspace((prev) => [...prev, step]);
      }

      onNudgeForAutoRun?.();
    },
  }), [setWorkspace, onNudgeForAutoRun]);

  // helpers to mutate workspace even if parent callbacks are missing
  const fallbackSelect = (s: CircuitStep) => {
    if (onSelectStep) onSelectStep(s);
    else setLocalSelected(s.id);
  };

  const fallbackDelete = (id: number) => {
    if (onDelete) onDelete(id);
    else setWorkspace((prev) => prev.filter((x) => x.id !== id));
    onNudgeForAutoRun?.();
  };

  const fallbackMove = (id: number, dir: -1 | 1) => {
    const idx = workspace.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= workspace.length) return;

    if (dir === -1) onMoveUp ? onMoveUp(id) : setWorkspace((prev) => {
      const arr = prev.slice();
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
    else onMoveDown ? onMoveDown(id) : setWorkspace((prev) => {
      const arr = prev.slice();
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });

    onNudgeForAutoRun?.();
  };

  const updateStep = (id: number, patch: Partial<CircuitStep>) => {
    setWorkspace((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch }) : s)));
    onNudgeForAutoRun?.();
  };

  const updateParams = (id: number, params: Record<string, number>) => {
    setWorkspace((prev) => prev.map((s) => (s.id === id ? ({ ...s, params: { ...(s.params || {}), ...params } }) : s)));
    onNudgeForAutoRun?.();
  };

  // callback ref to attach drop connector
  const setDropRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) (drop as any)(node);
  }, [drop]);

  return (
    <div ref={setDropRef} className="p-3 bg-zinc-900 rounded border border-zinc-700 min-h-[260px] w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-zinc-200">Workspace</div>
        <label className="text-[11px] flex items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={!!autoRun}
            onChange={(e) => onToggleAutoRun?.(e.target.checked)}
          />
          Auto-run
        </label>
      </div>

      {workspace.length === 0 && <p className="text-zinc-500">Drag gates/noise here</p>}

      <div className="flex flex-col gap-2">
        {workspace.map((s, idx) => {
          const isSelected = s.id === effectiveSelectedId;
          const isGate = s.type === "gate";
          const isNoise = s.type === "noise";

          return (
            <div
              key={s.id}
              className={`rounded px-2 py-1 transition-colors border ${
                isSelected ? "bg-blue-600/20 border-blue-500" : "bg-zinc-800 hover:bg-zinc-700 border-transparent"
              }`}
            >
              <div
                className="cursor-pointer flex items-center gap-2"
                onClick={() => fallbackSelect(s)}
                title="Click to edit parameters"
              >
                <span className="font-medium">
                  {isGate ? s.name : `${s.name} (noise)`}
                </span>
                {s.params ? <span className="text-zinc-400 text-xs">{JSON.stringify(s.params)}</span> : null}
                <span className="ml-auto text-[10px] text-zinc-500">#{idx + 1}</span>
              </div>

              {/* Inline controls */}
              {isSelected && (
                <div className="mt-2 space-y-2 text-xs">
                  {isGate && (
                    <>
                      {/* Rotation axis if applicable */}
                      {isRotationGate(s.name) && (
                        <div className="flex items-center gap-2">
                          <span className="opacity-70">Axis</span>
                          <select
                            className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
                            value={s.name}
                            onChange={(e) => updateStep(s.id, { name: e.target.value as any })}
                          >
                            <option value="Rx">Rx</option>
                            <option value="Ry">Ry</option>
                            <option value="Rz">Rz</option>
                          </select>
                        </div>
                      )}

                      {/* Theta slider for rotations; for X/Y/Z/H hide slider */}
                      {isRotationGate(s.name) && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">θ (radians)</span>
                            <span className="tabular-nums">{prettyTheta(s.params?.theta)}</span>
                          </div>
                          <input
                            type="range"
                            min={-Math.PI}
                            max={Math.PI}
                            step={Math.PI / 180}
                            value={s.params?.theta ?? 0}
                            onChange={(e) => updateParams(s.id, { theta: parseFloat(e.target.value) })}
                            onMouseUp={() => {
                              // snap on release
                              const t = s.params?.theta ?? 0;
                              const snapped = snapTheta(t);
                              if (snapped !== t) updateParams(s.id, { theta: snapped });
                            }}
                            className="w-full mt-1"
                          />
                        </div>
                      )}

                      {/* For fixed gates (X,Y,Z,H), no params shown */}
                    </>
                  )}

                  {isNoise && (
                    <>
                      {s.name === "amplitude_damping" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">γ</span>
                            <span className="tabular-nums">{(s.params?.gamma ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={s.params?.gamma ?? 0}
                            onChange={(e) => updateParams(s.id, { gamma: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                      {s.name === "phase_damping" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">λ</span>
                            <span className="tabular-nums">{(s.params?.lambda ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={s.params?.lambda ?? 0}
                            onChange={(e) => updateParams(s.id, { lambda: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                      {s.name === "depolarizing" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">p</span>
                            <span className="tabular-nums">{(s.params?.p ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={s.params?.p ?? 0}
                            onChange={(e) => updateParams(s.id, { p: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-1 flex gap-1">
                    <Btn onClick={() => fallbackMove(s.id, -1)} title="Move up">↑</Btn>
                    <Btn onClick={() => fallbackMove(s.id, +1)} title="Move down">↓</Btn>
                    <Btn
                      className="!bg-red-900 hover:!bg-red-800 border-red-700"
                      onClick={() => fallbackDelete(s.id)}
                      title="Delete"
                    >
                      ✕
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GateEditor;
