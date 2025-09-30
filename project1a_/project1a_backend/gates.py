import numpy as np

def pauli_x():
    """
    Return the 2x2 matrix representation of the Pauli-X (NOT) gate.
    
    The Pauli-X gate flips |0> to |1> and |1> to |0>, 
    analogous to a classical bit flip.
    
    Matrix form:
        [[0, 1],
         [1, 0]]
    """
    return np.array([[0, 1],
                     [1, 0]], dtype=complex)


def hadamard():
    """
    Return the 2x2 matrix representation of the Hadamard gate.
    
    The Hadamard gate creates superposition by mapping:
        |0> → (|0> + |1>) / sqrt(2)
        |1> → (|0> - |1>) / sqrt(2)
    
    Matrix form:
        (1/sqrt(2)) * [[ 1,  1],
                       [ 1, -1]]
    """
    return (1 / np.sqrt(2)) * np.array([[1,  1],
                                        [1, -1]], dtype=complex)
