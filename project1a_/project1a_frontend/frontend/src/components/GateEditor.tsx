"use client";

import React, { useState } from "react";
import { useDrop } from "react-dnd";

export interface Gate {
  id: number;
  type: string;
  name: string;
  parameter?: number;
}

interface GateEditorProps {
  workspace: Gate[];
  setWorkspace: (workspace: Gate[]) => void;
  onSelectGate: (gate: Gate) => void;
}

const GateEditor: React.FC<GateEditorProps> = ({
  workspace,
  setWorkspace,
  onSelectGate,
}) => {
  const [, drop] = useDrop(() => ({
    accept: "GATE",
    drop: (item: { gate: Gate }) => {
      setWorkspace([
        ...workspace,
        { ...item.gate, id: Date.now(), parameter: 0.1 },
      ]);
    },
  }));

  return (
    <div
      ref={drop}
      className="p-4 bg-gray-800 rounded border border-gray-600 min-h-[400px] w-full"
    >
      <h2 className="text-lg font-bold mb-2">Gate Workspace</h2>
      {workspace.length === 0 && (
        <p className="text-gray-400">Drag gates here</p>
      )}
      {workspace.map((gate) => (
        <div
          key={gate.id}
          className="bg-gray-700 p-2 rounded my-2 cursor-pointer"
          onClick={() => onSelectGate(gate)}
        >
          <span className="font-bold">{gate.name}</span>
        </div>
      ))}
    </div>
  );
};

export default GateEditor;
