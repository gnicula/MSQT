import numpy as np

def pauli_x():
    return np.array([[0, 1], [1, 0]], dtype=complex)

def hadamard():
    return (1/np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex)
