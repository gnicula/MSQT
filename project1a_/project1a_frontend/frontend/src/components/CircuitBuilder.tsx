"use client";

import React, { useState } from "react";
import type { CircuitStep } from "../types";

interface CircuitBuilderProps {
  onUpdate: (blochVector: any, densityMatrix: any) => void;
}

export default function CircuitBuilder({ onUpdate }: CircuitBuilderProps) {
  const [steps, setSteps] = useState<CircuitStep[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStep(step: CircuitStep) {
    setSteps((prev) => [...prev, step]);
  }

  function clearSteps() {
    setSteps([]);
    setError(null);
  }

  async function runCircuit() {
    if (steps.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/run_circuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ steps }),
      });

      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(`API ${res.status}: ${msg || "Unknown error"}`);
      }

      const data = await res.json();
      const last = data?.steps?.[data.steps.length - 1];
      if (last) onUpdate(last.bloch_vector, last.density_matrix);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Gates */}
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() => addStep({ id: Date.now(), type: "gate", name: "X" })}
        >
          Add X
        </button>
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() => addStep({ id: Date.now(), type: "gate", name: "H" })}
        >
          Add H
        </button>
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() =>
            addStep({ id: Date.now(), type: "gate", name: "Rx", params: { theta: Math.PI / 2 } })
          }
        >
          Add Rx(π/2)
        </button>

        {/* Noise */}
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() =>
            addStep({
              id: Date.now(),
              type: "noise",
              name: "amplitude_damping",
              params: { gamma: 0.2 },
            })
          }
        >
          Add Amplitude Damping (γ=0.2)
        </button>
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() =>
            addStep({
              id: Date.now(),
              type: "noise",
              name: "phase_damping",
              params: { lambda: 0.2 },
            })
          }
        >
          Add Phase Damping (λ=0.2)
        </button>
        <button
          className="bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1"
          onClick={() =>
            addStep({
              id: Date.now(),
              type: "noise",
              name: "depolarizing",
              params: { p: 0.1 },
            })
          }
        >
          Add Depolarizing (p=0.1)
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="bg-zinc-200 text-black rounded px-3 py-1 disabled:opacity-60"
          onClick={runCircuit}
          disabled={running || steps.length === 0}
        >
          {running ? "Running..." : "Run Circuit"}
        </button>
        <button className="bg-zinc-800 rounded px-3 py-1" onClick={clearSteps}>
          Clear
        </button>
        {error && <span className="text-xs text-red-400">Error: {error}</span>}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-1">Steps:</h3>
        <ul className="text-xs space-y-1">
          {steps.map((s) => (
            <li key={s.id}>
              {s.type}: {s.name}
              {"params" in s && s.params ? (
                <span className="opacity-70"> {JSON.stringify(s.params)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
