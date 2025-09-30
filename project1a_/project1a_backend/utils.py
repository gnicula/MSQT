import numpy as np

# ---------- Pauli Operators ----------
# These are the standard Pauli matrices used to extract expectation values
# and compute Bloch vectors.

pauli_x = np.array([[0, 1],
                    [1, 0]], dtype=complex)

pauli_y = np.array([[0, -1j],
                    [1j, 0]], dtype=complex)

pauli_z = np.array([[1, 0],
                    [0, -1]], dtype=complex)


def bloch_vector(rho: np.ndarray):
    """
    Compute the Bloch vector (x, y, z) for a single-qubit density matrix.

    The Bloch vector components are expectation values of the Pauli matrices:
        x = Tr(ρ X)
        y = Tr(ρ Y)
        z = Tr(ρ Z)

    Args:
        rho (np.ndarray): 2x2 density matrix.

    Returns:
        dict: {"x": float, "y": float, "z": float}
    """
    x = np.real(np.trace(rho @ pauli_x))
    y = np.real(np.trace(rho @ pauli_y))
    z = np.real(np.trace(rho @ pauli_z))
    return {"x": float(x), "y": float(y), "z": float(z)}


def serialize_density_matrix(rho: np.ndarray):
    """
    Convert a complex 2x2 density matrix into a JSON-serializable format.

    Each complex entry is stored as a list [real, imag].

    Example:
        [[1+0j, 0+0j],
         [0+0j, 0+0j]]
    becomes:
        [[[1.0, 0.0], [0.0, 0.0]],
         [[0.0, 0.0], [0.0, 0.0]]]

    Args:
        rho (np.ndarray): 2x2 density matrix.

    Returns:
        list[list[list[float]]]: serialized density matrix.
    """
    return [
        [[float(np.real(cell)), float(np.imag(cell))] for cell in row]
        for row in rho
    ]
