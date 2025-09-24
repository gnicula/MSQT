import React, { useState } from "react";
import axios from "axios";

interface CircuitStep {
  type: string;
  name: string;
  params?: any;
}

interface CircuitBuilderProps {
  onUpdate: (blochVector: any, densityMatrix: any) => void;
}

const CircuitBuilder: React.FC<CircuitBuilderProps> = ({ onUpdate }) => {
  const [steps, setSteps] = useState<CircuitStep[]>([]);

  const addStep = (step: CircuitStep) => {
    setSteps([...steps, step]);
  };

  const runCircuit = async () => {
    const res = await axios.post("http://127.0.0.1:8000/run_circuit", { steps });
    const lastStep = res.data.steps[res.data.steps.length - 1];
    onUpdate(lastStep.bloch_vector, lastStep.density_matrix);
  };

  return (
    <div>
      <button onClick={() => addStep({ type: "gate", name: "pauli-x" })}>Add Pauli-X</button>
      <button
        onClick={() =>
          addStep({ type: "noise", name: "amplitude_damping", params: { gamma: 0.2 } })
        }
      >
        Add Amplitude Damping
      </button>
      <button onClick={runCircuit}>Run Circuit</button>

      <div>
        <h3>Steps:</h3>
        <ul>
          {steps.map((s, i) => (
            <li key={i}>
              {s.type}: {s.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CircuitBuilder;
