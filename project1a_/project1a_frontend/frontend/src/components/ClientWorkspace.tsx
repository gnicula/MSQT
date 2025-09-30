// src/components/ClientWorkspace.tsx
"use client";

import { useState } from "react";
import BlochSphere from "./BlochSphere";
import GateEditor from "./GateEditor";
import GatePalette from "./GatePalette";
import type { Gate, Noise, PaletteItem, CircuitStep } from "../types";

export default function ClientWorkspace() {
  // Workspace holds the steps you assemble (gate or noise with optional params)
  const [workspace, setWorkspace] = useState<CircuitStep[]>([]);

  // Palette can include both gates and noise operators
  const gateItems: Gate[] = [
    { id: 1, type: "gate", name: "X Gate", op: "X" },
    { id: 2, type: "gate", name: "Z Gate", op: "Z" },
    { id: 3, type: "gate", name: "H Gate", op: "H" },
    { id: 4, type: "gate", name: "Rx(θ)", op: "Rx", parameter: Math.PI / 2 },
  ];

  const noiseItems: Noise[] = [
    { id: 101, type: "noise", name: "Amplitude Damping (γ)", op: "amplitude_damping", parameter: 0.1 },
    { id: 102, type: "noise", name: "Phase Damping (λ)", op: "phase_damping", parameter: 0.1 },
    { id: 103, type: "noise", name: "Depolarizing (p)", op: "depolarizing", parameter: 0.05 },
  ];

  const availableItems: PaletteItem[] = [...gateItems, ...noiseItems];

  return (
    <div style={{ display: "flex", height: "100vh", gap: "16px" }}>
      {/* Left: Gate & Noise palette */}
      <div style={{ width: "200px", background: "#111", padding: "8px", color: "#fff", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 8 }}>Palette</h3>
        <GatePalette gates={availableItems} />
      </div>

      {/* Middle: Bloch Sphere and editor */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Keep your sphere usage the same (no prop needed if your component makes it optional) */}
        <BlochSphere />
        {/* GateEditor should already accept CircuitStep[]; if it only accepted gates before,
            we updated earlier to support mixed steps. */}
        <GateEditor workspace={workspace} setWorkspace={setWorkspace} />
      </div>

      {/* Right: Workspace view */}
      <div
        style={{
          width: "300px",
          background: "#111",
          padding: "8px",
          color: "#fff",
          overflowY: "auto",
        }}
      >
        <h3>Workspace</h3>
        {workspace.length === 0 ? (
          <p>No steps placed yet</p>
        ) : (
          workspace.map((s) => (
            <div
              key={s.id}
              style={{
                margin: "4px 0",
                padding: "4px",
                border: "1px solid #333",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {s.type.toUpperCase()} — {s.name}
              </div>
              {"params" in s && s.params ? (
                <div style={{ fontSize: 12, opacity: 0.8 }}>{JSON.stringify(s.params)}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
