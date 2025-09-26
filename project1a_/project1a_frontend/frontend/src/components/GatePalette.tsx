// src/components/GatePalette.tsx
"use client";

import React from "react";
import { useDrag } from "react-dnd";
import { Gate } from "../types";

interface GatePaletteProps {
  gates: Gate[];
}

interface GateItemProps {
  gate: Gate;
}

const GateItem: React.FC<GateItemProps> = ({ gate }) => {
  const [, drag] = useDrag(() => ({
    type: "GATE",
    item: { gate },
  }));

  return (
    <div
      ref={(node) => drag(node as HTMLDivElement)}
      style={{
        padding: "8px",
        margin: "4px",
        background: "#222",
        borderRadius: "4px",
        cursor: "grab",
      }}
    >
      {gate.name}
    </div>
  );
};

export default function GatePalette({ gates }: GatePaletteProps) {
  if (!gates || gates.length === 0) {
    return <div>No gates available</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {gates.map((gate) => (
        <GateItem key={gate.id} gate={gate} />
      ))}
    </div>
  );
}
