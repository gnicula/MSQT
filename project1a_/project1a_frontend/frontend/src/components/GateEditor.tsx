// scr/component
// GateEditor.tsx

"use client";
import React from "react";
import { useDrop } from "react-dnd";
import type {
  CircuitStep,
  PaletteItem,
  NoiseParams,
  GateName,
  GateParams,
  NoiseName,
} from "../types";

/* ===========================================================
   Props
   -----------------------------------------------------------
   - workspace / setWorkspace: the ordered list of steps (gate/noise)
   - onSelectStep / selectedId: optional external selection control
   - onMoveUp / onMoveDown / onDelete: optional external mutations
   - autoRun / onToggleAutoRun / onNudgeForAutoRun:
       * autoRun toggles whether the parent should auto-run on edits
       * onNudgeForAutoRun() asks the parent to debounce/run soon
   =========================================================== */
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

/* Small utility button used in the inline controls for each step. */
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

/* Generate a reasonably unique id. Combines timestamp and a random suffix. */
function makeId() {
  return Number(`${Date.now()}${Math.floor(Math.random() * 1e6)}`);
}

/* Payload type accepted by react-dnd from the palette. */
type DragPayload = { kind: "palette-item"; item: PaletteItem };

/* Type guard to check if a gate name is a rotation (parameterized). */
function isRotationGate(name: string): name is "Rx" | "Ry" | "Rz" {
  return name === "Rx" || name === "Ry" || name === "Rz";
}

/** ---- θ snapping helpers (write exact constants when near special angles) ----
 * We expose a set of “special” angles on the unit circle (in radians).
 * When the user drags the θ slider near one of these, we snap exactly
 * to the constant to keep outputs clean (e.g., show π/2 instead of 1.571).
 */
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
] as const;

/* Labels for displaying pretty π-based values in the UI. */
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

/* Find the nearest snap angle to a given θ, returning the value and distance. */
function nearestSnap(theta: number) {
  let best = SNAP_SET[0] as number,
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

/* Pretty-print θ:
   - If we’re very close to a snap angle, show its π-based label
   - Else show a numeric with fixed precision */
function prettyTheta(theta?: number) {
  if (theta == null) return "—";
  const { value, dist } = nearestSnap(theta);
  if (dist < 1e-6) return SNAP_LABELS[value] ?? theta.toFixed(3);
  if (dist < 0.02) return SNAP_LABELS[value] ?? theta.toFixed(3);
  return theta.toFixed(3);
}
/** --------------------------------------------------------------------------- */

/* ===========================================================
   GateEditor component
   -----------------------------------------------------------
   Responsibilities:
   - Accept “palette item” drops and append steps to workspace.
   - Render each step with context-appropriate controls:
       * Rotation gates: axis selector + θ slider (with snapping)
       * Noise steps: one slider in [0,1] for its strength
   - Provide move-up / move-down / delete actions per step.
   - Support external selection, or maintain local selection when
     no external handler is provided.
   =========================================================== */
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
  /* Local fallback selection if parent doesn’t manage selection. */
  const [localSelected, setLocalSelected] = React.useState<number | null>(null);

  /* ----------------------- Drag & Drop target -----------------------
     We define a drop zone that accepts "PALETTE_ITEM" payloads
     and appends a corresponding step to the workspace.
     ----------------------------------------------------------------- */
  const dropRef = React.useRef<HTMLDivElement | null>(null);
  const [, drop] = useDrop<DragPayload, void>(() => ({
    accept: "PALETTE_ITEM",
    drop: (payload) => {
      const it = payload.item;
      const id = makeId();

      if (it.type === "gate") {
        // Fixed gates have no params; rotation gates default θ if not present.
        // Palette sends "Rotation (θ)" with op "Rx" (axis is editable later).
        const name = it.op as GateName; // "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz"
        const theta = name.startsWith("R") ? it.parameter ?? Math.PI / 4 : undefined;
        setWorkspace((prev) => [
          ...prev,
          { id, type: "gate", name, params: theta != null ? { theta } : undefined },
        ]);
      } else {
        // Noise channels map their single parameter into the right key.
        const p = it.parameter ?? 0.1;
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

      // Ask parent to consider re-running (debounced upstream).
      onNudgeForAutoRun?.();
    },
  }), [setWorkspace, onNudgeForAutoRun]);

  /* Connect the ref to the drop target (avoids LegacyRef typing issues). */
  React.useEffect(() => {
    if (dropRef.current) {
      (drop as any)(dropRef);
    }
  }, [drop]);

  /* Selection helper:
     - Use external callback if provided
     - Otherwise maintain a local selection id */
  const selectStep = (s: CircuitStep) =>
    onSelectStep ? onSelectStep(s) : setLocalSelected(s.id);

  /* Removal helper:
     - Delegate to parent if onDelete provided
     - Else mutate workspace locally
     - Nudge auto-run after mutation */
  const removeStep = (id: number) => {
    if (onDelete) onDelete(id);
    else setWorkspace((prev) => prev.filter((x) => x.id !== id));
    onNudgeForAutoRun?.();
  };

  /* Move a step up/down one position (or delegate to parent).
     Performs bounds checks; nudges auto-run on change. */
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

  /* Update a gate’s name (used to switch Rx/Ry/Rz axis). */
  const updateGateName = (id: number, newName: GateName) => {
    setWorkspace((prev) =>
      prev.map((s) => (s.id === id && s.type === "gate" ? { ...s, name: newName } : s))
    );
    onNudgeForAutoRun?.();
  };

  /* Update θ with snapping:
     - If raw value is near a snap angle (≤ ~0.04), write exact constant.
     - Keeps the UI pretty and avoids floating point drift. */
  const updateTheta = (id: number, rawTheta: number) => {
    const { value, dist } = nearestSnap(rawTheta);
    const snapped = dist < 0.04 ? value : rawTheta;
    setWorkspace((prev) =>
      prev.map((s) => {
        if (s.id !== id || s.type !== "gate" || !isRotationGate(s.name)) return s;
        const next: GateParams = { ...(s.params as GateParams), theta: snapped };
        return { ...s, params: next };
      })
    );
    onNudgeForAutoRun?.();
  };

  /* Update a noise parameter (all in [0,1]): gamma, lambda, or p. */
  const updateNoiseParam = (
    id: number,
    key: keyof NoiseParams, // "gamma" | "lambda" | "p"
    value: number
  ) => {
    setWorkspace((prev) =>
      prev.map((s) => {
        if (s.id !== id || s.type !== "noise") return s;
        const prevParams: NoiseParams = (s.params as NoiseParams) || {};
        return { ...s, params: { ...prevParams, [key]: value } };
      })
    );
    onNudgeForAutoRun?.();
  };

  /* Which step is currently selected (external id wins over local). */
  const selectedKey = selectedId ?? localSelected;

  /* ===========================================================
     Render
     -----------------------------------------------------------
     - Drop zone region (entire component) accepts palette items.
     - List of steps with number badges (#1, #2...) for context.
     - Conditional editor sections per step type:
         * Gate → axis selector (for rotations) + θ slider
         * Noise → single slider for γ / λ / p in [0,1]
     - Move up/down and delete controls appear when selected.
     =========================================================== */
  return (
    <div
      ref={dropRef}
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
          const isSelected = s.id === selectedKey;

          /* ------- Gate controls (axis + θ) appear only for rotation gates ------- */
          const renderGateControls = () => {
            if (s.type !== "gate") return null;
            const isRot = isRotationGate(s.name);
            const theta = isRot ? (s.params as GateParams | undefined)?.theta ?? 0 : undefined;
            const nearSnap = typeof theta === "number" && nearestSnap(theta).dist < 0.02;

            return (
              <div className="mt-2 space-y-2 text-xs">
                {isRot && (
                  <>
                    {/* Axis selector: switch between Rx/Ry/Rz (keeps θ) */}
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

                    {/* θ slider (radians) with snap indicator + pretty label */}
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
              </div>
            );
          };

          /* ------- Noise controls (single [0,1] slider) ------- */
          const renderNoiseControls = () => {
            if (s.type !== "noise") return null;
            const name = s.name as NoiseName;
            const params: NoiseParams = (s.params as NoiseParams) || {};

            // Generic row factory for γ/λ/p sliders
            const sliderRow = (
              label: string,
              key: keyof NoiseParams,
              value: number | undefined
            ) => (
              <div className="mt-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="opacity-70">{label}</span>
                  <span className="tabular-nums">{(value ?? 0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={value ?? 0}
                  onChange={(e) =>
                    updateNoiseParam(s.id, key, parseFloat(e.target.value))
                  }
                  className="w-full mt-1"
                />
              </div>
            );

            return (
              <div className="mt-2">
                {name === "amplitude_damping" && sliderRow("γ (strength)", "gamma", params.gamma)}
                {name === "phase_damping" && sliderRow("λ (strength)", "lambda", params.lambda)}
                {name === "depolarizing" && sliderRow("p (probability)", "p", params.p)}
              </div>
            );
          };

          /* ------- Step row (selectable; shows controls when selected) ------- */
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
                onClick={() => (onSelectStep ? onSelectStep(s) : setLocalSelected(s.id))}
                title="Click to edit parameters"
              >
                <span className="font-medium">
                  {s.type === "gate" ? s.name : `${s.name} (noise)`}
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
                <>
                  {renderGateControls()}
                  {renderNoiseControls()}

                  {/* Row actions: move up/down, delete */}
                  <div className="pt-2 flex gap-1">
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GateEditor;
