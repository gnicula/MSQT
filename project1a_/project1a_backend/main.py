from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from quantum_state import QuantumState
import gates, noise, utils
from utils import bloch_vector, serialize_density_matrix

app = FastAPI()
quantum_state = QuantumState()

class GateRequest(BaseModel):
    gate: str

class NoiseRequest(BaseModel):
    noise_type: str
    params: dict

class CircuitStep(BaseModel):
    type: str  # "gate" or "noise"
    name: str
    params: Optional[dict] = None

class CircuitRequest(BaseModel):
    steps: List[CircuitStep]

@app.post("/apply_gate")
def apply_gate(request: GateRequest):
    if request.gate.lower() == "pauli-x":
        U = gates.pauli_x()
    else:
        return {"error": "Gate not implemented"}
    quantum_state.apply_gate(U)
    return {
        "density_matrix": serialize_density_matrix(quantum_state.state),
        "bloch_vector": bloch_vector(quantum_state.state)
    }

@app.post("/apply_noise")
def apply_noise(request: NoiseRequest):
    if request.noise_type.lower() == "amplitude_damping":
        gamma = request.params.get("gamma", 0.1)
        kraus_ops = noise.amplitude_damping(gamma)
    else:
        return {"error": "Noise type not implemented"}
    quantum_state.apply_kraus(kraus_ops)
    return {
        "density_matrix": serialize_density_matrix(quantum_state.state),
        "bloch_vector": bloch_vector(quantum_state.state)
    }

@app.post("/run_circuit")
def run_circuit(request: CircuitRequest):
    quantum_state.reset()
    results = []
    for step in request.steps:
        if step.type == "gate":
            if step.name.lower() == "pauli-x":
                quantum_state.apply_gate(gates.pauli_x())
        elif step.type == "noise":
            if step.name.lower() == "amplitude_damping":
                gamma = step.params.get("gamma", 0.1)
                quantum_state.apply_kraus(noise.amplitude_damping(gamma))
        results.append({
            "density_matrix": serialize_density_matrix(quantum_state.state),
            "bloch_vector": bloch_vector(quantum_state.state)
        })
    return {"steps": results}

@app.get("/reset")
def reset():
    quantum_state.reset()
    return {"message": "Quantum state reset"}
