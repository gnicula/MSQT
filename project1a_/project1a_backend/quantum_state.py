import numpy as np

class QuantumState:
    """
    Represents a single-qubit quantum state using the density matrix formalism.
    
    - By default, the state starts in |0><0| (the ground state).
    - Supports application of unitary gates and noisy channels (via Kraus ops).
    - Maintains a history of states for circuit evolution tracking.
    """

    def __init__(self, initial_state=None):
        """
        Initialize the quantum state.

        Args:
            initial_state (np.ndarray, optional): 
                A custom 2x2 density matrix to initialize with.
                If None, defaults to |0><0|.

        Notes:
            The density matrix must be Hermitian, positive semi-definite,
            and have trace = 1 to represent a valid quantum state.
        """
        if initial_state is None:
            # Default: |0><0| density matrix
            self.state = np.array([[1, 0],
                                   [0, 0]], dtype=complex)
        else:
            self.state = initial_state
        # Keep a history of states (useful for visualization/debugging).
        self.history = []

    def reset(self):
        """
        Reset the quantum state back to the default |0><0|.
        Clears out the state but not the history list.
        """
        self.__init__()

    def apply_gate(self, U: np.ndarray):
        """
        Apply a unitary gate U to the quantum state.

        Transformation:
            ρ → U ρ U†

        Args:
            U (np.ndarray): a 2x2 unitary matrix representing the gate.
        """
        self.state = U @ self.state @ U.conj().T
        self.history.append(self.state.copy())

    def apply_kraus(self, kraus_ops):
        """
        Apply a quantum noise channel defined by a set of Kraus operators.

        Transformation:
            ρ → Σ K_i ρ K_i†

        Args:
            kraus_ops (List[np.ndarray]): list of 2x2 Kraus matrices.
        """
        new_state = np.zeros_like(self.state, dtype=complex)
        for K in kraus_ops:
            new_state += K @ self.state @ K.conj().T
        self.state = new_state
        self.history.append(self.state.copy())
