"use client";
import React from "react";
import { useDrag } from "react-dnd";
import type { Gate } from "../types";

function GateItem({ gate }: { gate: Gate }) {
  const [, drag] = useDrag(() => ({ type: "GATE", item: { gate } }));
  return (
    <div
      ref={(node) => drag(node as HTMLDivElement)}
      className="bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-1 cursor-grab select-none"
    >
      {gate.name}
    </div>
  );
}

export default function GatePalette({ gates }: { gates: Gate[] }) {
  return (
    <div className="flex flex-col gap-2">
      {gates.map((g) => <GateItem key={g.id} gate={g} />)}
    </div>
  );
}
