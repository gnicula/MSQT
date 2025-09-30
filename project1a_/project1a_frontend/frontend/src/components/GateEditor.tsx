"use client";
import React from "react";
import { useDrop } from "react-dnd";
import type {
  CircuitStep,
  PaletteItem,
  NoiseParams,
  GateName,
  GateParams,
} from "../types";

interface GateEditorProps {
  workspace: CircuitStep[];
  setWorkspace: (ws: CircuitStep[] | ((prev: CircuitStep[]) => CircuitStep[])) => void;

  onSelectStep?: (step: CircuitStep) => void;
  selectedId?: number | null;
  onMoveUp?: (id: number) => void;
  onMoveDown?: (id: number) => void;
  onDelete?: (id: number) => void;

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

const SNAP_SET = [
  0, Math.PI/6, Math.PI/4, Math.PI/3, Math.PI/2, (2*Math.PI)/3, (3*Math.PI)/4, (5*Math.PI)/6, Math.PI,
  -Math.PI/6, -Math.PI/4, -Math.PI/3, -Math.PI/2, -(3*Math.PI)/4, -Math.PI,
];

function nearestSnap(theta: number) {
  let best = SNAP_SET[0], dmin = Infinity;
  for (const v of SNAP_SET) {
    const d = Math.abs(theta - v);
    if (d < dmin) { dmin = d; best = v; }
  }
  return { value: best, dist: dmin };
}

function prettyTheta(theta?: number) {
  if (theta == null) return "—";
  const labels: Record<number, string> = {
    [0]: "0",
    [Math.PI/6]: "π/6", [Math.PI/4]: "π/4", [Math.PI/3]: "π/3",
    [Math.PI/2]: "π/2", [(2*Math.PI)/3]: "2π/3", [(3*Math.PI)/4]: "3π/4", [(5*Math.PI)/6]: "5π/6",
    [Math.PI]: "π",
    [-Math.PI/6]: "-π/6", [-Math.PI/4]: "-π/4", [-Math.PI/3]: "-π/3",
    [-Math.PI/2]: "-π/2", [-(3*Math.PI)/4]: "-3π/4", [-Math.PI]: "-π",
  };
  const { value, dist } = nearestSnap(theta);
  if (dist < 0.02) return labels[value] ?? theta.toFixed(3);
  return theta.toFixed(3);
}

function snapTheta(theta: number) {
  const { value, dist } = nearestSnap(theta);
  return dist < 0.04 ? value : theta;
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

  const [, drop] = useDrop<DragPayload, void>(
    () => ({
      accept: "PALETTE_ITEM",
      drop: (payload) => {
        const it = payload.item;
        const id = makeId();

        if (it.type === "gate") {
          // For a single palette "Rotation (θ)" we default to Rx and allow changing axis below.
          const theta = it.parameter ?? (it.op.startsWith("R") ? Math.PI / 4 : undefined);
          const name: GateName =
            it.op === "Rx" || it.op === "Ry" || it.op === "Rz" ? it.op : "Rx";
          const step: CircuitStep = {
            id,
            type: "gate",
            name,
            params: theta != null ? { theta } : undefined,
          };
          setWorkspace((prev) => [...prev, step]);
        } else {
          const p = it.parameter ?? 0;
          const params: NoiseParams =
            it.op === "amplitude_damping"
              ? { gamma: p }
              : it.op === "phase_damping"
              ? { lambda: p }
              : { p };
          const step: CircuitStep = {
            id,
            type: "noise",
            name: it.op,
            params,
          };
          setWorkspace((prev) => [...prev, step]);
        }

        onNudgeForAutoRun?.();
      },
    }),
    [setWorkspace, onNudgeForAutoRun]
  );

  // Helpers (type-safe)
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

    if (dir === -1)
      onMoveUp
        ? onMoveUp(id)
        : setWorkspace((prev) => {
            const arr = prev.slice();
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            return arr;
          });
    else
      onMoveDown
        ? onMoveDown(id)
        : setWorkspace((prev) => {
            const arr = prev.slice();
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            return arr;
          });

    onNudgeForAutoRun?.();
  };

  const updateGateName = (id: number, newName: GateName) => {
    setWorkspace((prev) =>
      prev.map((s) =>
        s.id === id && s.type === "gate" ? { ...s, name: newName } : s
      )
    );
    onNudgeForAutoRun?.();
  };

  // Narrowed params update by step type
  const updateParams = (id: number, params: Partial<GateParams> | Partial<NoiseParams>) => {
    setWorkspace((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        if (s.type === "gate") {
          const next: GateParams = { ...(s.params as GateParams) };
          if ("theta" in params && typeof params.theta === "number") next.theta = params.theta;
          return { ...s, params: next };
        } else {
          const next: NoiseParams = { ...(s.params as NoiseParams) };
          if ("gamma" in params && typeof (params as any).gamma === "number") next.gamma = (params as any).gamma;
          if ("lambda" in params && typeof (params as any).lambda === "number") next.lambda = (params as any).lambda;
          if ("p" in params && typeof (params as any).p === "number") next.p = (params as any).p;
          return { ...s, params: next };
        }
      })
    );
    onNudgeForAutoRun?.();
  };

  // Use a callback ref to attach the drop connector
  const setDropRef = React.useCallback(
    (node: HTMLDivElement | null) => { if (node) (drop as any)(node); },
    [drop]
  );

  return (
    <div ref={setDropRef} className="p-3 bg-zinc-900 rounded border border-zinc-700 min-h={[260]} w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-zinc-200">Workspace</div>
        <label className="text-[11px] flex items-center gap-2 select-none">
          <input type="checkbox" checked={!!autoRun} onChange={(e) => onToggleAutoRun?.(e.target.checked)} />
          Auto-run
        </label>
      </div>

      {workspace.length === 0 && <p className="text-zinc-500">Drag gates/noise here</p>}

      <div className="flex flex-col gap-2">
        {workspace.map((s, idx) => {
          const isSelected = s.id === (selectedId ?? localSelected);
          const isGate = s.type === "gate";
          const isNoise = s.type === "noise";

          // Snap indicator state (for rotation gate only)
          const theta = isGate ? (s.params as GateParams | undefined)?.theta : undefined;
          const nearSnap = typeof theta === "number" && nearestSnap(theta).dist < 0.02;

          return (
            <div
              key={s.id}
              className={`rounded px-2 py-1 transition-colors border ${
                isSelected ? "bg-blue-600/20 border-blue-500" : "bg-zinc-800 hover:bg-zinc-700 border-transparent"
              }`}
            >
              <div
                className="cursor-pointer flex items-center gap-2"
                onClick={() => (onSelectStep ? onSelectStep(s) : (setLocalSelected(s.id)))}
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
                      {/* Rotation axis selector for rotation gates */}
                      {isRotationGate(s.name) && (
                        <div className="flex items-center gap-2">
                          <span className="opacity-70">Axis</span>
                          <select
                            className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
                            value={s.name}
                            onChange={(e) => updateGateName(s.id, e.target.value as GateName)}
                          >
                            <option value="Rx">Rx</option>
                            <option value="Ry">Ry</option>
                            <option value="Rz">Rz</option>
                          </select>
                        </div>
                      )}

                      {/* Theta slider for rotations */}
                      {isRotationGate(s.name) && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">θ (radians)</span>
                            <div className="flex items-center gap-2">
                              {nearSnap && (
                                <span className="px-1 py-0.5 rounded bg-emerald-700/40 border border-emerald-500 text-emerald-100">
                                  snapped
                                </span>
                              )}
                              <span className="tabular-nums">{prettyTheta(theta)}</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={-Math.PI}
                            max={Math.PI}
                            step={Math.PI / 180}
                            value={theta ?? 0}
                            onChange={(e) => updateParams(s.id, { theta: parseFloat(e.target.value) })}
                            onMouseUp={() => {
                              const t = (s.params as GateParams | undefined)?.theta ?? 0;
                              const snapped = snapTheta(t);
                              if (snapped !== t) updateParams(s.id, { theta: snapped });
                            }}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                      {/* Fixed gates (X,Y,Z,H) intentionally have no θ; extra scalar/global phase doesn't move the Bloch vector */}
                    </>
                  )}

                  {isNoise && (
                    <>
                      {s.name === "amplitude_damping" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">γ</span>
                            <span className="tabular-nums">{((s.params as NoiseParams | undefined)?.gamma ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={(s.params as NoiseParams | undefined)?.gamma ?? 0}
                            onChange={(e) => updateParams(s.id, { gamma: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                      {s.name === "phase_damping" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">λ</span>
                            <span className="tabular-nums">{((s.params as NoiseParams | undefined)?.lambda ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={(s.params as NoiseParams | undefined)?.lambda ?? 0}
                            onChange={(e) => updateParams(s.id, { lambda: parseFloat(e.target.value) })}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                      {s.name === "depolarizing" && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">p</span>
                            <span className="tabular-nums">{((s.params as NoiseParams | undefined)?.p ?? 0).toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={(s.params as NoiseParams | undefined)?.p ?? 0}
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
                    <Btn className="!bg-red-900 hover:!bg-red-800 border-red-700" onClick={() => fallbackDelete(s.id)} title="Delete">✕</Btn>
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
