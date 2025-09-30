import numpy as np

# ---------- Quantum Noise Channels ----------
# Each function returns a list of Kraus operators {K_i} that describe
# a completely positive trace-preserving (CPTP) map. These operators
# model how realistic noise affects quantum states.


def amplitude_damping(gamma: float):
    """
    Amplitude damping noise channel.

    Models energy relaxation (e.g., spontaneous emission), where |1> decays
    to |0> with probability γ. This is relevant in systems where excited states
    lose energy to the environment.

    Kraus operators:
        K0 = [[1,          0        ],
              [0, sqrt(1-γ)]]

        K1 = [[0, sqrt(γ)],
              [0,     0  ]]

    Args:
        gamma (float): damping probability, 0 ≤ γ ≤ 1

    Returns:
        List[np.ndarray]: two Kraus operators [K0, K1]
    """
    K0 = np.array([[1, 0],
                   [0, np.sqrt(1 - gamma)]], dtype=complex)
    K1 = np.array([[0, np.sqrt(gamma)],
                   [0, 0]], dtype=complex)
    return [K0, K1]


def phase_damping(lmbda: float):
    """
    Phase damping noise channel.

    Models loss of quantum coherence without energy loss (dephasing).
    This causes off-diagonal terms in the density matrix to shrink,
    while populations remain unchanged.

    One common representation uses three Kraus operators:

        K0 = sqrt(1-λ) * I
        K1 = sqrt(λ) * |0><0|
        K2 = sqrt(λ) * |1><1|

    Args:
        lmbda (float): dephasing probability, 0 ≤ λ ≤ 1

    Returns:
        List[np.ndarray]: three Kraus operators [K0, K1, K2]
    """
    K0 = np.sqrt(1 - lmbda) * np.eye(2, dtype=complex)
    K1 = np.sqrt(lmbda) * np.array([[1, 0],
                                    [0, 0]], dtype=complex)
    K2 = np.sqrt(lmbda) * np.array([[0, 0],
                                    [0, 1]], dtype=complex)
    return [K0, K1, K2]


def depolarizing(p: float):
    """
    Depolarizing noise channel.

    With probability p, the qubit is replaced by a maximally mixed state
    (random Pauli error). With probability 1-p, it is left unchanged.

    Equivalent to applying:
        I with probability 1 - 3p/4
        X with probability p/4
        Y with probability p/4
        Z with probability p/4

    Args:
        p (float): depolarizing probability, 0 ≤ p ≤ 1

    Returns:
        List[np.ndarray]: four Kraus operators [K0, K1, K2, K3]
    """
    I = np.eye(2, dtype=complex)
    X = np.array([[0, 1],
                  [1, 0]], dtype=complex)
    Y = np.array([[0, -1j],
                  [1j, 0]], dtype=complex)
    Z = np.array([[1, 0],
                  [0, -1]], dtype=complex)

    # One common parameterization of the depolarizing channel
    K0 = np.sqrt(1 - 3*p/4) * I
    K1 = np.sqrt(p/4) * X
    K2 = np.sqrt(p/4) * Y
    K3 = np.sqrt(p/4) * Z
    return [K0, K1, K2, K3]
