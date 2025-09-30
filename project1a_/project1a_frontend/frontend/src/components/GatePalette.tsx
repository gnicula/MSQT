"use client";

import { useMemo } from "react";
import { useDrag } from "react-dnd";
import type { PaletteItem } from "../types";

type Props = {
  gates: PaletteItem[]; // can be Gate or Noise
};

type DragPayload = {
  kind: "palette-item";
  item: PaletteItem;
};

// Small badge showing if it's a Gate or a Noise operator
function Badge({ t }: { t: "gate" | "noise" }) {
  return (
    <span
      className="text-[10px] px-1 py-[2px] rounded border"
      style={{ borderColor: "rgba(113,113,122,0.6)" }}
    >
      {t === "gate" ? "GATE" : "NOISE"}
    </span>
  );
}

function SubLabel({ item }: { item: PaletteItem }) {
  if (item.type === "gate") return <span className="text-xs opacity-70">{item.op}</span>;
  // compact codes for noise
  const code =
    item.op === "amplitude_damping" ? "AD" :
    item.op === "phase_damping"     ? "PD" :
    "DEP";
  return <span className="text-xs opacity-70">{code}</span>;
}

function PaletteTile({ item }: { item: PaletteItem }) {
  const [{ isDragging }, dragRef] = useDrag<DragPayload, unknown, { isDragging: boolean }>(
    () => ({
      type: "PALETTE_ITEM",
      item: { kind: "palette-item", item },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [item]
  );

  return (
    <div
      ref={dragRef as any}
      className={`rounded px-3 py-2 cursor-grab select-none transition-colors ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
      style={{ border: "1px solid rgba(113,113,122,0.6)", background: "rgba(39,39,42,0.6)" }}
      title={`${item.name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{item.name}</span>
        <div className="flex items-center gap-2">
          <SubLabel item={item} />
          <Badge t={item.type} />
        </div>
      </div>
      {"parameter" in item && item.parameter != null ? (
        <div className="text-[11px] opacity-70 mt-1">param: {item.parameter}</div>
      ) : null}
    </div>
  );
}

export default function GatePalette({ gates }: Props) {
  const items = useMemo(() => gates, [gates]);
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <PaletteTile key={`${it.type}-${it.id}`} item={it} />
      ))}
    </div>
  );
}
