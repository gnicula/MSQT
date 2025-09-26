// src/components/ClientWorkspace.tsx
"use client";

import { useState } from "react";
import BlochSphere from "./BlochSphere";
import GateEditor from "./GateEditor";
import GatePalette from "./GatePalette";
import { Gate } from "../types";

export default function ClientWorkspace() {
  const [workspace, setWorkspace] = useState<Gate[]>([]);

  const availableGates: Gate[] = [
    { id: 1, name: "X Gate", parameter: 0 },
    { id: 2, name: "Z Gate", parameter: 0 },
    { id: 3, name: "Kraus Operator", parameter: 0.1 },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", gap: "16px" }}>
      {/* Left: Gate palette */}
      <div style={{ width: "200px", background: "#111", padding: "8px" }}>
        <GatePalette gates={availableGates} />
      </div>

      {/* Middle: Bloch Sphere and editor */}
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <BlochSphere />
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
          <p>No gates placed yet</p>
        ) : (
          workspace.map((gate) => (
            <div
              key={gate.id}
              style={{
                margin: "4px 0",
                padding: "4px",
                border: "1px solid #333",
                borderRadius: "4px",
              }}
            >
              {gate.name} — parameter: {gate.parameter}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
