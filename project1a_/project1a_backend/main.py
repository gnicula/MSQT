from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
from numpy import cos, sin, exp

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to ["http://localhost:3000"] if you want it strict
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Data Models ----------
class Step(BaseModel):
    type: str
    name: str
    qubit: int
    gates: List[str]
    params: Optional[Dict[str, Any]] = None

class CircuitRequest(BaseModel):
    steps: List[Step]

# ---------- Gate Definitions ----------
I = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
H = (1 / np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex)

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

gate_map = {
    "X": X,
    "Y": Y,
    "Z": Z,
    "H": H,
    "Rx": Rx,
    "Ry": Ry,
    "Rz": Rz
}

# ---------- Utility Functions ----------
def bloch_vector(state: np.ndarray) -> Dict[str, float]:
    """Compute Bloch vector from a state vector."""
    rho = np.outer(state, state.conj())  # density matrix
    x = np.real(np.trace(rho @ X))
    y = np.real(np.trace(rho @ Y))
    z = np.real(np.trace(rho @ Z))
    return {"x": float(x), "y": float(y), "z": float(z)}

def density_matrix(state: np.ndarray) -> List[List[List[float]]]:
    """Convert density matrix to JSON-serializable format."""
    rho = np.outer(state, state.conj())
    return [[[float(np.real(val)), float(np.imag(val))] for val in row] for row in rho]

# ---------- Simulation ----------
@app.post("/run_circuit")
async def run_circuit(circuit: CircuitRequest):
    steps_output = []

    # Start in |0⟩ state
    state = np.array([1, 0], dtype=complex)

    for step in circuit.steps:
        for g in step.gates:
            if g in ["Rx", "Ry", "Rz"]:
                theta = step.params.get("theta", np.pi/2)
                U = gate_map[g](theta)
            else:
                U = gate_map[g]

            state = U @ state

        steps_output.append({
            "bloch_vector": bloch_vector(state),
            "density_matrix": density_matrix(state)
        })

    return {"steps": steps_output}
