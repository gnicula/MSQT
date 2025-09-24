import numpy as np

class QuantumState:
    def __init__(self, initial_state=None):
        if initial_state is None:
            # Default: |0><0| density matrix
            self.state = np.array([[1, 0], [0, 0]], dtype=complex)
        else:
            self.state = initial_state
        self.history = []  # Track each state step for /run_circuit

    def reset(self):
        self.__init__()

    def apply_gate(self, U):
        self.state = U @ self.state @ U.conj().T
        self.history.append(self.state.copy())

    def apply_kraus(self, kraus_ops):
        new_state = np.zeros_like(self.state, dtype=complex)
        for K in kraus_ops:
            new_state += K @ self.state @ K.conj().T
        self.state = new_state
        self.history.append(self.state.copy())
