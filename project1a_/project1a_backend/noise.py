import numpy as np

def amplitude_damping(gamma: float):
    K0 = np.array([[1, 0], [0, np.sqrt(1 - gamma)]], dtype=complex)
    K1 = np.array([[0, np.sqrt(gamma)], [0, 0]], dtype=complex)
    return [K0, K1]

def phase_damping(lmbda: float):
    # Simple 3-Kraus phase damping
    K0 = np.sqrt(1 - lmbda) * np.eye(2, dtype=complex)
    K1 = np.sqrt(lmbda) * np.array([[1, 0], [0, 0]], dtype=complex)
    K2 = np.sqrt(lmbda) * np.array([[0, 0], [0, 1]], dtype=complex)
    return [K0, K1, K2]

def depolarizing(p: float):
    I = np.eye(2, dtype=complex)
    X = np.array([[0, 1], [1, 0]], dtype=complex)
    Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    Z = np.array([[1, 0], [0, -1]], dtype=complex)
    # One common parameterization
    K0 = np.sqrt(1 - 3*p/4) * I
    K1 = np.sqrt(p/4) * X
    K2 = np.sqrt(p/4) * Y
    K3 = np.sqrt(p/4) * Z
    return [K0, K1, K2, K3]
