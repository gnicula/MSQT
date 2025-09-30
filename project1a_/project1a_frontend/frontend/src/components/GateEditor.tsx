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
  setWorkspace: (
    ws: CircuitStep[] | ((prev: CircuitStep[]) => CircuitStep[])
  ) => void;

  onSelectStep?: (step: CircuitStep) => void;
  selectedId?: number | null;
  onMoveUp?: (id: number) => void;
  onMoveDown?: (id: number) => void;
  onDelete?: (id: number) => void;

  autoRun?: boolean;
  onToggleAutoRun?: (val: boolean) => void;
  onNudgeForAutoRun?: () => void;
}

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = "",
  children,
  ...rest
}) => (
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

type DragPayload = { kind: "palette-item"; item: PaletteItem };

function isRotationGate(name: string): name is "Rx" | "Ry" | "Rz" {
  return name === "Rx" || name === "Ry" || name === "Rz";
}

// Canonical snap set and exact labels for θ
const SNAP_SET = [
  0,
  Math.PI / 6,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
  (2 * Math.PI) / 3,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 6,
  Math.PI,
  -Math.PI / 6,
  -Math.PI / 4,
  -Math.PI / 3,
  -Math.PI / 2,
  -(3 * Math.PI) / 4,
  -Math.PI,
];

const SNAP_LABELS: Record<number, string> = {
  [0]: "0",
  [Math.PI / 6]: "π/6",
  [Math.PI / 4]: "π/4",
  [Math.PI / 3]: "π/3",
  [Math.PI / 2]: "π/2",
  [(2 * Math.PI) / 3]: "2π/3",
  [(3 * Math.PI) / 4]: "3π/4",
  [(5 * Math.PI) / 6]: "5π/6",
  [Math.PI]: "π",
  [-Math.PI / 6]: "-π/6",
  [-Math.PI / 4]: "-π/4",
  [-Math.PI / 3]: "-π/3",
  [-Math.PI / 2]: "-π/2",
  [-(3 * Math.PI) / 4]: "-3π/4",
  [-Math.PI]: "-π",
};

function nearestSnap(theta: number) {
  let best = SNAP_SET[0],
    dmin = Infinity;
  for (const v of SNAP_SET) {
    const d = Math.abs(theta - v);
    if (d < dmin) {
      dmin = d;
      best = v;
    }
  }
  return { value: best, dist: dmin };
}

function prettyTheta(theta?: number) {
  if (theta == null) return "—";
  const { value, dist } = nearestSnap(theta);
  if (dist < 1e-6) return SNAP_LABELS[value] ?? theta.toFixed(3); // exactly snapped
  if (dist < 0.02) return SNAP_LABELS[value] ?? theta.toFixed(3); // near→show canonical
  return theta.toFixed(3);
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
  const [localSelected, setLocalSelected] = React.useState<number | null>(null);

  const [, drop] = useDrop<DragPayload, void>(() => ({
    accept: "PALETTE_ITEM",
    drop: (payload) => {
      const it = payload.item;
      const id = makeId();

      if (it.type === "gate") {
        // Keep fixed gates fixed; only the Rotation palette item carries Rx (editable to Ry/Rz)
        const name = it.op as GateName; // "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz"
        const theta = name.startsWith("R") ? it.parameter ?? Math.PI / 4 : undefined;
        setWorkspace((prev) => [
          ...prev,
          { id, type: "gate", name, params: theta != null ? { theta } : undefined },
        ]);
      } else {
        // Noise defaults
        const p = it.parameter ?? 0;
        const params: NoiseParams =
          it.op === "amplitude_damping"
            ? { gamma: p }
            : it.op === "phase_damping"
            ? { lambda: p }
            : { p };
        setWorkspace((prev) => [
          ...prev,
          { id, type: "noise", name: it.op, params },
        ]);
      }

      onNudgeForAutoRun?.();
    },
  }), [setWorkspace, onNudgeForAutoRun]);

  const setDropRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) (drop as any)(node); // TS: connect drop to the DOM node
    },
    [drop]
  );

  const selectStep = (s: CircuitStep) =>
    onSelectStep ? onSelectStep(s) : setLocalSelected(s.id);

  const removeStep = (id: number) => {
    if (onDelete) onDelete(id);
    else setWorkspace((prev) => prev.filter((x) => x.id !== id));
    onNudgeForAutoRun?.();
  };

  const moveStep = (id: number, dir: -1 | 1) => {
    const idx = workspace.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= workspace.length) return;

    const perform = () =>
      setWorkspace((prev) => {
        const arr = prev.slice();
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return arr;
      });

    dir === -1 ? (onMoveUp ? onMoveUp(id) : perform()) : (onMoveDown ? onMoveDown(id) : perform());
    onNudgeForAutoRun?.();
  };

  const updateGateName = (id: number, newName: GateName) => {
    setWorkspace((prev) =>
      prev.map((s) => (s.id === id && s.type === "gate" ? { ...s, name: newName } : s))
    );
    onNudgeForAutoRun?.();
  };

  // Live θ update with exact snapping
  const updateTheta = (id: number, rawTheta: number) => {
    const { value, dist } = nearestSnap(rawTheta);
    const snapped = dist < 0.04 ? value : rawTheta; // write the exact constant if close

    setWorkspace((prev) =>
      prev.map((s) => {
        if (s.id !== id || s.type !== "gate" || !isRotationGate(s.name)) return s;
        const next: GateParams = { ...(s.params as GateParams), theta: snapped };
        return { ...s, params: next };
      })
    );
    onNudgeForAutoRun?.();
  };

  return (
    <div
      ref={setDropRef}
      className="p-3 bg-zinc-900 rounded border border-zinc-700 min-h-[460px] w-full"
    >
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

      {workspace.length === 0 && (
        <p className="text-zinc-500">Drag gates/noise here</p>
      )}

      <div className="flex flex-col gap-2">
        {workspace.map((s, idx) => {
          const isSelected = s.id === (selectedId ?? localSelected);
          const isGate = s.type === "gate";
          const theta = isGate ? (s.params as GateParams | undefined)?.theta : undefined;
          const nearSnap = typeof theta === "number" && nearestSnap(theta).dist < 0.02;

          return (
            <div
              key={s.id}
              className={`rounded px-2 py-1 transition-colors border ${
                isSelected
                  ? "bg-blue-600/20 border-blue-500"
                  : "bg-zinc-800 hover:bg-zinc-700 border-transparent"
              }`}
            >
              <div
                className="cursor-pointer flex items-center gap-2"
                onClick={() => selectStep(s)}
                title="Click to edit parameters"
              >
                <span className="font-medium">
                  {isGate ? s.name : `${s.name} (noise)`}
                </span>
                {s.params ? (
                  <span className="text-zinc-400 text-xs">
                    {JSON.stringify(s.params)}
                  </span>
                ) : null}
                <span className="ml-auto text-[10px] text-zinc-500">
                  #{idx + 1}
                </span>
              </div>

              {isSelected && (
                <div className="mt-2 space-y-2 text-xs">
                  {isGate && isRotationGate(s.name) && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Axis</span>
                        <select
                          className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5"
                          value={s.name}
                          onChange={(e) =>
                            updateGateName(s.id, e.target.value as GateName)
                          }
                        >
                          <option value="Rx">Rx</option>
                          <option value="Ry">Ry</option>
                          <option value="Rz">Rz</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="opacity-70">θ (radians)</span>
                          <div className="flex items-center gap-2">
                            {nearSnap && (
                              <span className="px-1 py-0.5 rounded bg-emerald-700/40 border border-emerald-500 text-emerald-100">
                                snapped
                              </span>
                            )}
                            <span className="tabular-nums">
                              {prettyTheta(theta)}
                            </span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={-Math.PI}
                          max={Math.PI}
                          step={Math.PI / 180}
                          value={theta ?? 0}
                          onChange={(e) =>
                            updateTheta(s.id, parseFloat(e.target.value))
                          }
                          className="w-full mt-1"
                        />
                      </div>
                    </>
                  )}

                  <div className="pt-1 flex gap-1">
                    <Btn onClick={() => moveStep(s.id, -1)} title="Move up">
                      ↑
                    </Btn>
                    <Btn onClick={() => moveStep(s.id, +1)} title="Move down">
                      ↓
                    </Btn>
                    <Btn
                      className="!bg-red-900 hover:!bg-red-800 border-red-700"
                      onClick={() => removeStep(s.id)}
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
