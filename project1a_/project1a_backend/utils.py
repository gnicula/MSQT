import numpy as np

pauli_x = np.array([[0, 1], [1, 0]], dtype=complex)
pauli_y = np.array([[0, -1j], [1j, 0]], dtype=complex)
pauli_z = np.array([[1, 0], [0, -1]], dtype=complex)

def bloch_vector(rho):
    x = np.real(np.trace(rho @ pauli_x))
    y = np.real(np.trace(rho @ pauli_y))
    z = np.real(np.trace(rho @ pauli_z))
    return {"x": x, "y": y, "z": z}
 
def serialize_density_matrix(rho):
    return [[[float(np.real(cell)), float(np.imag(cell))] for cell in row] for row in rho]
