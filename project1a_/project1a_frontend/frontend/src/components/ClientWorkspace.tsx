// src/components/ClientWorkspace.tsx
"use client";

import { useState } from "react";
import BlochSphere from "./BlochSphere";
import GateEditor from "./GateEditor";
import GatePalette from "./GatePalette";
import type { Gate, Noise, PaletteItem, CircuitStep } from "../types";

/* ===========================================================
   ClientWorkspace
   -----------------------------------------------------------
   High-level, self-contained workspace UI that ties together:
     - A palette of available gates & noise channels
     - A central Bloch sphere visualization
     - An editor for assembling a sequence of steps (workspace)
   This component focuses on local UI state and composition;
   network I/O (e.g., running circuits) is handled elsewhere.
   =========================================================== */
export default function ClientWorkspace() {
  // Workspace holds the ordered list of steps the user assembles.
  // Each step is either a "gate" or "noise" and may carry params.
  const [workspace, setWorkspace] = useState<CircuitStep[]>([]);

  /* ---------------------------------------------------------
     Palette contents
     ---------------------------------------------------------
     We expose a small set of gates and noise operators with
     sensible defaults. GateEditor/GatePalette will drive the
     interactions (drag/drop, add/remove), while this wrapper
     just feeds them the available items.
     --------------------------------------------------------- */

  // Gates (fixed + one parameterized rotation)
  const gateItems: Gate[] = [
    { id: 1, type: "gate", name: "X Gate", op: "X" },
    { id: 2, type: "gate", name: "Z Gate", op: "Z" },
    { id: 3, type: "gate", name: "H Gate", op: "H" },
    { id: 4, type: "gate", name: "Rx(θ)", op: "Rx", parameter: Math.PI / 2 },
  ];

  // Noise channels with default strengths (match backend defaults closely)
  const noiseItems: Noise[] = [
    { id: 101, type: "noise", name: "Amplitude Damping (γ)", op: "amplitude_damping", parameter: 0.1 },
    { id: 102, type: "noise", name: "Phase Damping (λ)", op: "phase_damping", parameter: 0.1 },
    { id: 103, type: "noise", name: "Depolarizing (p)", op: "depolarizing", parameter: 0.05 },
  ];

  // Unified list for the palette component (supports both kinds)
  const availableItems: PaletteItem[] = [...gateItems, ...noiseItems];

  /* ---------------------------------------------------------
     Layout
     ---------------------------------------------------------
     Three-column flexible layout:
       [LEFT]  Palette (scrollable)
       [MIDDLE]Bloch sphere + step editor
       [RIGHT] Workspace readout (scrollable)
     Inline styles keep this file self-contained and decoupled
     from Tailwind; feel free to convert to TW classes later.
     --------------------------------------------------------- */
  return (
    <div style={{ display: "flex", height: "100vh", gap: "16px" }}>
      {/* Left: Gate & Noise palette */}
      <div style={{ width: "200px", background: "#111", padding: "8px", color: "#fff", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 8 }}>Palette</h3>
        {/* GatePalette is expected to support a mixed list of gates + noise */}
        <GatePalette gates={availableItems} />
      </div>

      {/* Middle: Bloch Sphere and editor */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* BlochSphere renders the current Bloch vector; when used without props,
           it relies on its own internal default (|0⟩) and external updates. */}
        <BlochSphere />

        {/* GateEditor handles add/remove/reorder/edit of steps.
           It accepts the unified CircuitStep[] workspace and a setter.
           If it previously accepted only gates, it has since been updated
           to support mixed gate/noise steps. */}
        <GateEditor workspace={workspace} setWorkspace={setWorkspace} />
      </div>

      {/* Right: Workspace view (read-only preview of current steps) */}
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
              {/* Show params when present (e.g., theta for rotations or probabilities for noise) */}
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
