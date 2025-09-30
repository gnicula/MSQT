from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
import numpy as np
from numpy import cos, sin, exp

# Local modules
from quantum_state import QuantumState
from noise import amplitude_damping, phase_damping, depolarizing


# ---------- Quantum Gate Definitions ----------
# These functions return 2x2 unitary matrices for common gates.
# They are defined here directly, but could be imported from gates.py.

def X():
    """Pauli-X gate (bit flip)."""
    return np.array([[0, 1],
                     [1, 0]], dtype=complex)

def Y():
    """Pauli-Y gate."""
    return np.array([[0, -1j],
                     [1j, 0]], dtype=complex)

def Z():
    """Pauli-Z gate (phase flip)."""
    return np.array([[1, 0],
                     [0, -1]], dtype=complex)

def H():
    """Hadamard gate: creates superposition."""
    return (1/np.sqrt(2)) * np.array([[1,  1],
                                      [1, -1]], dtype=complex)

def Rx(theta: float):
    """Rotation around the X-axis by angle θ."""
    return np.array([
        [cos(theta/2), -1j*sin(theta/2)],
        [-1j*sin(theta/2), cos(theta/2)]
    ], dtype=complex)

def Ry(theta: float):
    """Rotation around the Y-axis by angle θ."""
    return np.array([
        [cos(theta/2), -sin(theta/2)],
        [sin(theta/2),  cos(theta/2)]
    ], dtype=complex)

def Rz(theta: float):
    """Rotation around the Z-axis by angle θ."""
    return np.array([
        [exp(-1j*theta/2), 0],
        [0, exp(1j*theta/2)]
    ], dtype=complex)


# ---------- FastAPI App Setup ----------
app = FastAPI()

# Allow cross-origin requests (CORS).
# For development this is set to "*", but in production you should restrict it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # TODO: restrict for security in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Data Models ----------
GateName = Literal["X", "Y", "Z", "H", "Rx", "Ry", "Rz"]
NoiseName = Literal["amplitude_damping", "phase_damping", "depolarizing"]

class Step(BaseModel):
    """Represents a single step in the quantum circuit (gate or noise)."""
    id: Optional[int] = None
    type: Literal["gate", "noise"]  # distinguishes between gates and noise channels
    name: str                       # gate/noise name, e.g. "X" or "amplitude_damping"
    params: Optional[Dict[str, Any]] = None  # optional parameters (e.g., rotation angle)

class CircuitRequest(BaseModel):
    """Represents an incoming circuit execution request."""
    steps: List[Step]


# ---------- Helper Functions ----------
def gate_unitary(name: str, params: Optional[Dict[str, Any]] = None) -> np.ndarray:
    """
    Look up the unitary matrix for a given gate by name.
    Supports both fixed gates (X, Y, Z, H) and parameterized rotations (Rx, Ry, Rz).
    """
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
    """
    Look up the Kraus operators for a given noise channel by name.
    Input parameters are validated and clamped to [0,1] for safety.
    """
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
    """
    Compute the Bloch vector (x,y,z) from a single-qubit density matrix ρ.
    This is done using expectation values of Pauli operators.
    """
    X_ = X(); Y_ = Y(); Z_ = Z()
    x = float(np.real(np.trace(rho @ X_)))
    y = float(np.real(np.trace(rho @ Y_)))
    z = float(np.real(np.trace(rho @ Z_)))
    return {"x": x, "y": y, "z": z}

def serialize_density_matrix(rho: np.ndarray):
    """
    Convert a density matrix (complex 2x2 array) into a JSON-serializable structure.
    Each entry is represented as [real, imag].
    """
    return [[[float(np.real(v)), float(np.imag(v))] for v in row] for row in rho]


# ---------- API Route ----------
@app.post("/run_circuit")
async def run_circuit(circuit: CircuitRequest):
    """
    Run a quantum circuit consisting of gates and noise channels in sequence.
    
    Workflow:
    1. Initialize the quantum state at |0><0|.
    2. Apply each step in the circuit (either a unitary gate or a noise channel).
    3. After each step, record the Bloch vector and density matrix.
    4. Return the evolution as a list of step outputs.
    """
    qs = QuantumState()  # initialize state at |0>
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

        # Capture the current state after this step
        rho = qs.state
        out_steps.append({
            "bloch_vector": bloch_vector_from_rho(rho),
            "density_matrix": serialize_density_matrix(rho),
        })

    return {"steps": out_steps}
