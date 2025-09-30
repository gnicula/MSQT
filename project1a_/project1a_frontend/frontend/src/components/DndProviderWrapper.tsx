// src/components/DndProviderWrapper.tsx
"use client";

import { ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

/* ===========================================================
   DndProviderWrapper
   -----------------------------------------------------------
   Small utility component to scope a react-dnd provider
   around any subtree that needs drag & drop.

   Why wrap it?
   - Avoids repeating <DndProvider backend={HTML5Backend}> in multiple places.
   - Keeps "use client" at the boundary where it’s needed (Next.js app dir).
   - Makes it easy to swap backends later (e.g., TouchBackend) from one file.
   - Helps with testing: you can mount components inside this wrapper.

   Usage:
     <DndProviderWrapper>
       <YourDnDComponents />
     </DndProviderWrapper>

   Notes:
   - HTML5Backend supports desktop mouse-based drag/drop.
   - For touch devices, you can create a parallel wrapper using TouchBackend
     or conditionally select a backend at runtime if desired.
   =========================================================== */
export default function DndProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  // Provide the DnD context to all descendants.
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
