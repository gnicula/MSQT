from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
import numpy as np
from numpy import cos, sin, exp

# Local modules
from quantum_state import QuantumState
from noise import amplitude_damping, phase_damping, depolarizing

# (You can swap these for imports from gates.py if you prefer)
def X():
    return np.array([[0, 1], [1, 0]], dtype=complex)
def Y():
    return np.array([[0, -1j], [1j, 0]], dtype=complex)
def Z():
    return np.array([[1, 0], [0, -1]], dtype=complex)
def H():
    return (1/np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex)

def Rx(theta: float):
    return np.array([
        [cos(theta/2), -1j*sin(theta/2)],
        [-1j*sin(theta/2), cos(theta/2)]
    ], dtype=complex)

def Ry(theta: float):
    return np.array([
        [cos(theta/2), -sin(theta/2)],
        [sin(theta/2), cos(theta/2)]
    ], dtype=complex)

def Rz(theta: float):
    return np.array([
        [exp(-1j*theta/2), 0],
        [0, exp(1j*theta/2)]
    ], dtype=complex)

# ---------- FastAPI app ----------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
GateName = Literal["X", "Y", "Z", "H", "Rx", "Ry", "Rz"]
NoiseName = Literal["amplitude_damping", "phase_damping", "depolarizing"]

class Step(BaseModel):
    id: Optional[int] = None
    type: Literal["gate", "noise"]
    name: str
    params: Optional[Dict[str, Any]] = None

class CircuitRequest(BaseModel):
    steps: List[Step]

# ---------- Helpers ----------
def gate_unitary(name: str, params: Optional[Dict[str, Any]] = None) -> np.ndarray:
    p = params or {}
    if name == "X": return X()
    if name == "Y": return Y()
    if name == "Z": return Z()
    if name == "H": return H()
    if name == "Rx": return Rx(p.get("theta", np.pi/2))
    if name == "Ry": return Ry(p.get("theta", np.pi/2))
    if name == "Rz": return Rz(p.get("theta", np.pi/2))
    raise ValueError(f"Unknown gate: {name}")

def kraus_operators(name: str, params: Optional[Dict[str, Any]] = None):
    p = params or {}
    if name == "amplitude_damping":
        gamma = float(p.get("gamma", 0.1))
        gamma = max(0.0, min(1.0, gamma))
        return amplitude_damping(gamma)
    if name == "phase_damping":
        lam = float(p.get("lambda", 0.1))
        lam = max(0.0, min(1.0, lam))
        return phase_damping(lam)
    if name == "depolarizing":
        prob = float(p.get("p", 0.05))
        prob = max(0.0, min(1.0, prob))
        return depolarizing(prob)
    raise ValueError(f"Unknown noise channel: {name}")

def bloch_vector_from_rho(rho: np.ndarray) -> Dict[str, float]:
    X_ = X(); Y_ = Y(); Z_ = Z()
    x = float(np.real(np.trace(rho @ X_)))
    y = float(np.real(np.trace(rho @ Y_)))
    z = float(np.real(np.trace(rho @ Z_)))
    return {"x": x, "y": y, "z": z}

def serialize_density_matrix(rho: np.ndarray):
    return [[[float(np.real(v)), float(np.imag(v))] for v in row] for row in rho]

# ---------- Route ----------
@app.post("/run_circuit")
async def run_circuit(circuit: CircuitRequest):
    qs = QuantumState()  # starts at |0><0|
    out_steps = []

    for step in circuit.steps:
        if step.type == "gate":
            U = gate_unitary(step.name, step.params)
            qs.apply_gate(U)
        elif step.type == "noise":
            Ks = kraus_operators(step.name, step.params)
            qs.apply_kraus(Ks)
        else:
            raise ValueError(f"Unsupported step: {step.type}")

        rho = qs.state
        out_steps.append({
            "bloch_vector": bloch_vector_from_rho(rho),
            "density_matrix": serialize_density_matrix(rho),
        })

    return {"steps": out_steps}
