"use client";
import React from "react";
import { useDrag } from "react-dnd";
import type { PaletteItem } from "../types";

/* ===========================================================
   Drag payload
   -----------------------------------------------------------
   We wrap the item in a small envelope identifying the payload
   kind. This makes it easier for drop targets to discriminate
   between different draggable types in the future.
   =========================================================== */
type DragPayload = { kind: "palette-item"; item: PaletteItem };

/* ===========================================================
   PaletteButton
   -----------------------------------------------------------
   A single draggable entry in the palette. Uses react-dnd's
   useDrag hook with a *ref object* connector (v16 style).
   - The drop zone in GateEditor expects type "PALETTE_ITEM".
   - We pass the entire PaletteItem through the payload.
   - Using a ref object + drag(ref) avoids callback-ref typing
     issues and keeps the DOM node under our control.
   =========================================================== */
function PaletteButton({ item }: { item: PaletteItem }) {
  // Use a ref object and let react-dnd decorate it; avoids callback-ref type issues
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  // Attach the drag connector to our ref
  // (In react-dnd v16, the connector is a function you call with the ref object)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [, drag] = useDrag<DragPayload, void, unknown>(
    () => ({
      type: "PALETTE_ITEM",
      item: { kind: "palette-item", item },
    }),
    [item]
  );

  React.useEffect(() => {
    if (nodeRef.current) {
      // Important: pass the ref object, not a callback
      drag(nodeRef);
    }
  }, [drag]);

  return (
    <div
      ref={nodeRef}
      className="bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-1 cursor-grab select-none"
      title={item.type === "gate" ? item.op : `${item.op} (noise)`}
    >
      {item.name}
    </div>
  );
}

/* ===========================================================
   GatePalette
   -----------------------------------------------------------
   Renders a vertical list of PaletteButton components.
   Each entry is independently draggable and carries its
   own metadata (id, type, name, op, parameter if present).
   =========================================================== */
export default function GatePalette({ gates }: { gates: PaletteItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {gates.map((g) => (
        <PaletteButton key={g.id} item={g} />
      ))}
    </div>
  );
}
