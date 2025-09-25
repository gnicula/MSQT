"use client";

import { useState } from "react";
import BlochSphere from "@/components/BlochSphere";

export default function Home() {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  async function handleRunCircuit() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/run_circuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: [
            {
              type: "apply_gate",
              name: "X",
              qubit: 0,
              gates: ["X"],
              params: { gamma: 0.1 }
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("Backend Response:", data);
      setSteps(data.steps || []);
      setCurrentStep(0);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function prevStep() {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  function nextStep() {
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <h1 className="text-3xl font-bold">Quantum Circuit Simulation</h1>

      <button
        onClick={handleRunCircuit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        disabled={loading}
      >
        {loading ? "Running..." : "Run Circuit"}
      </button>

      {error && <p className="text-red-500">Error: {error}</p>}

      {steps.length > 0 && (
        <>
          <div className="w-full max-w-4xl h-[500px] border rounded">
            <BlochSphere blochVector={steps[0]?.bloch_vector || { x: 0, y: 0, z: 1 }} />
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={prevStep}
              className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
              disabled={currentStep === 0}
            >
              Previous Step
            </button>
            <button
              onClick={nextStep}
              className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
              disabled={currentStep === steps.length - 1}
            >
              Next Step
            </button>
          </div>

          <div className="w-full max-w-3xl mt-6">
            <h2 className="text-xl font-semibold mb-2">
              Step {currentStep + 1}
            </h2>

            <div>
              <strong>Bloch Vector:</strong>{" "}
              {`x: ${steps[currentStep].bloch_vector.x}, y: ${steps[currentStep].bloch_vector.y}, z: ${steps[currentStep].bloch_vector.z}`}
            </div>

            <div className="mt-2">
              <strong>Density Matrix:</strong>
              {steps[currentStep].density_matrix && steps[currentStep].density_matrix.length > 0 ? (
                <pre className="bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(steps[currentStep].density_matrix, null, 2)}
                </pre>
              ) : (
                <p>No density matrix data</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
