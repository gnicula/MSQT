"use client";
import React from "react";
import { useDrop } from "react-dnd";
import type { Gate, CircuitStep } from "../types";

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

const GateEditor: React.FC<GateEditorProps> = ({
  workspace,
  setWorkspace,
  onSelectStep,
  selectedId,
  onMoveUp,
  onMoveDown,
  onDelete,
}) => {
  const [, drop] = useDrop(() => ({
    accept: "GATE",
    drop: (item: { gate: Gate }) => {
      const id = makeId();
      if (item.gate.type === "gate") {
        const theta = item.gate.parameter ?? Math.PI / 2;

        // NEW: generic Rotation gate (op === "R") becomes Rx by default
        const op = item.gate.op === "R" ? "Rx" : (item.gate.op as any);

        setWorkspace((prev) => [
          ...prev,
          { id, type: "gate", name: op, params: { theta } },
        ]);
      } else {
        const defaults =
          item.gate.op === "amplitude_damping" ? { gamma: item.gate.parameter ?? 0.1 } :
          item.gate.op === "phase_damping" ? { lambda: item.gate.parameter ?? 0.1 } :
          { p: item.gate.parameter ?? 0.05 };
        setWorkspace((prev) => [
          ...prev,
          { id, type: "noise", name: item.gate.op as any, params: defaults },
        ]);
      }
    },
  }), [setWorkspace]);

  return (
    <div ref={drop} className="p-3 bg-zinc-900 rounded border border-zinc-700 min-h-[240px] w-full">
      <div className="text-sm font-semibold text-zinc-200 mb-2">Workspace</div>
      {workspace.length === 0 && <p className="text-zinc-500">Drag gates here</p>}
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
                {s.params ? <span className="text-zinc-400 text-xs">{JSON.stringify(s.params)}</span> : null}
              </div>
              <div className="mt-1 flex gap-1">
                <Btn onClick={() => onMoveUp?.(s.id)} title="Move up">↑</Btn>
                <Btn onClick={() => onMoveDown?.(s.id)} title="Move down">↓</Btn>
                <Btn className="!bg-red-900 hover:!bg-red-800 border-red-700" onClick={() => onDelete?.(s.id)} title="Delete">✕</Btn>
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
