"use client";

import React, { useState } from "react";

interface GateBlock {
  id: string;
  gateType: string;
  inputQubit: number;
  gamma: number;
}

export default function GateUIBuilder() {
  const [gates, setGates] = useState<GateBlock[]>([]);

  const addGate = () => {
    const newGate: GateBlock = {
      id: `gate-${Date.now()}`,
      gateType: "X",
      inputQubit: 0,
      gamma: 0.1
    };
    setGates([...gates, newGate]);
  };

  const updateGate = (id: string, field: keyof GateBlock, value: any) => {
    setGates(gates.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg flex flex-col gap-4">
      <button
        className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-600"
        onClick={addGate}
      >
        Add Gate
      </button>

      {gates.length === 0 && (
        <p className="text-gray-400 text-sm">No gates yet. Click "Add Gate" to start.</p>
      )}

      {gates.map(gate => (
        <div key={gate.id} className="bg-gray-700 p-3 rounded flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <strong>{gate.gateType} Gate</strong>
            <button
              className="text-red-400 hover:text-red-600"
              onClick={() => setGates(gates.filter(g => g.id !== gate.id))}
            >
              ✕
            </button>
          </div>

          {/* Gate Type Selector */}
          <label className="text-sm">
            Gate Type:
            <select
              value={gate.gateType}
              onChange={(e) => updateGate(gate.id, "gateType", e.target.value)}
              className="ml-2 bg-gray-600 rounded p-1"
            >
              <option value="X">X</option>
              <option value="Y">Y</option>
              <option value="Z">Z</option>
              <option value="H">H</option>
              <option value="Kraus">Kraus</option>
            </select>
          </label>

          {/* Input Qubit Selector */}
          <label className="text-sm">
            Input Qubit:
            <input
              type="number"
              min={0}
              value={gate.inputQubit}
              onChange={(e) => updateGate(gate.id, "inputQubit", parseInt(e.target.value))}
              className="ml-2 bg-gray-600 rounded p-1 w-16"
            />
          </label>

          {/* Gamma Slider */}
          {gate.gateType === "Kraus" && (
            <div>
              <label className="text-sm">Gamma: {gate.gamma.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={gate.gamma}
                onChange={(e) => updateGate(gate.id, "gamma", parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
