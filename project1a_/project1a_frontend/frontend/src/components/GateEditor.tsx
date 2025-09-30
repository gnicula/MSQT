"use client";
import React from "react";
import { useDrop } from "react-dnd";
import type { CircuitStep, PaletteItem, NoiseParams } from "../types";

interface GateEditorProps {
  workspace: CircuitStep[];
  setWorkspace: (ws: CircuitStep[] | ((prev: CircuitStep[]) => CircuitStep[])) => void;
  onSelectStep?: (step: CircuitStep) => void;
  selectedId?: number | null;
  onMoveUp?: (id: number) => void;
  onMoveDown?: (id: number) => void;
  onDelete?: (id: number) => void;
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

const GateEditor: React.FC<GateEditorProps> = ({
  workspace,
  setWorkspace,
  onSelectStep,
  selectedId,
  onMoveUp,
  onMoveDown,
  onDelete,
}) => {
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
          it.op === "amplitude_damping"
            ? { gamma: p }
            : it.op === "phase_damping"
            ? { lambda: p }
            : { p };
        const step: CircuitStep = {
          id,
          type: "noise",
          name: it.op, // "amplitude_damping" | "phase_damping" | "depolarizing"
          params,
        };
        setWorkspace((prev) => [...prev, step]);
      }
    },
  }), [setWorkspace]);

  // Use a callback ref to attach the drop connector without casting/comment issues
  const setDropRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      (drop as any)(node);
    }
  }, [drop]);

  return (
    <div ref={setDropRef} className="p-3 bg-zinc-900 rounded border border-zinc-700 min-h-[240px] w-full">
      <div className="text-sm font-semibold text-zinc-200 mb-2">Workspace</div>
      {workspace.length === 0 && <p className="text-zinc-500">Drag gates/noise here</p>}
      <div className="flex flex-col gap-2">
        {workspace.map((s, idx) => {
          const isSelected = s.id === selectedId;
          return (
            <div
              key={s.id}
              className={`rounded px-2 py-1 transition-colors border ${
                isSelected
                  ? "bg-blue-600/30 border-blue-500"
                  : "bg-zinc-800 hover:bg-zinc-700 border-transparent"
              }`}
            >
              <div
                className="cursor-pointer"
                onClick={() => onSelectStep?.(s)}
                title="Click to edit parameters"
              >
                <span className="font-medium">
                  {s.type === "gate" ? s.name : `${s.name} (noise)`}
                </span>{" "}
                {s.params ? (
                  <span className="text-zinc-400 text-xs">{JSON.stringify(s.params)}</span>
                ) : null}
              </div>
              <div className="mt-1 flex gap-1">
                <Btn onClick={() => onMoveUp?.(s.id)} title="Move up">↑</Btn>
                <Btn onClick={() => onMoveDown?.(s.id)} title="Move down">↓</Btn>
                <Btn
                  className="!bg-red-900 hover:!bg-red-800 border-red-700"
                  onClick={() => onDelete?.(s.id)}
                  title="Delete"
                >
                  ✕
                </Btn>
                <span className="ml-auto text-[10px] text-zinc-500">#{idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GateEditor;
