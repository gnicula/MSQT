"use client";
import React from "react";
import { useDrag } from "react-dnd";
import type { PaletteItem } from "../types";

type DragPayload = { kind: "palette-item"; item: PaletteItem };

function PaletteButton({ item }: { item: PaletteItem }) {
  const [, drag] = useDrag<DragPayload, void, unknown>(
    () => ({
      type: "PALETTE_ITEM",
      item: { kind: "palette-item", item },
    }),
    [item]
  );

  return (
    <div
      ref={(node) => drag(node as HTMLDivElement)}
      className="bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-1 cursor-grab select-none"
      title={item.type === "gate" ? item.op : `${item.op} (noise)`}
    >
      {item.name}
    </div>
  );
}

export default function GatePalette({ gates }: { gates: PaletteItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {gates.map((g) => (
        <PaletteButton key={g.id} item={g} />
      ))}
    </div>
  );
}
