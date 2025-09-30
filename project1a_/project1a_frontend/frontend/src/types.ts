// Shared types used across components
// -------------------------------------------------------------
// This file centralizes the data model used by the UI and the
// /api/run_circuit route. It mirrors the FastAPI payload shape:
//   CircuitRequest = { steps: Step[] }
// where each Step is either a "gate" or "noise" operation.
//
// Conventions:
// - Angles (theta) are in radians.
// - Noise parameters (gamma, lambda, p) are probabilities in [0,1].
// - Discriminated unions use the "type" field to branch logic.
// -------------------------------------------------------------

/** Names of supported single-qubit gates (fixed + parameterized rotations). */
export type GateName = "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz";

/** Names of supported single-qubit noise channels (Kraus-based on the backend). */
export type NoiseName = "amplitude_damping" | "phase_damping" | "depolarizing";

/** Parameters for gates. Only rotation gates (Rx/Ry/Rz) use θ. */
export type GateParams = {
  /** Rotation angle (radians). Used only for Rx/Ry/Rz. */
  theta?: number;
};

/** Parameters for noise channels. All are clamped to [0,1] server-side. */
export type NoiseParams = {
  /** Amplitude Damping strength γ (0..1). */
  gamma?: number;
  /** Phase Damping strength λ (0..1). */
  lambda?: number;
  /** Depolarizing probability p (0..1). */
  p?: number;
};

// ---------------- Palette models ----------------
// These types back the right-hand palette (drag sources). They include
// human-friendly display labels and an optional default parameter value
// used when the item is dropped into the workspace.

/** Palette entry for a gate (e.g., "X Gate", "Rotation (θ)"). */
export type Gate = {
  id: number;
  type: "gate";
  /** Display label shown in the UI (e.g., "X Gate"). */
  name: string;
  /** Semantic operation dispatched to the simulator/backend. */
  op: GateName;
  /** Optional default parameter (e.g., θ for rotations, in radians). */
  parameter?: number;
};

/** Palette entry for a noise channel (e.g., "Amplitude Damping (γ)"). */
export type Noise = {
  id: number;
  type: "noise";
  /** Display label shown in the UI (e.g., "Amplitude Damping (γ)"). */
  name: string;
  /** Semantic operation dispatched to the simulator/backend. */
  op: NoiseName;
  /** Optional default strength/probability in [0,1]. */
  parameter?: number;
};

/** A palette item can be either a gate or a noise entry. */
export type PaletteItem = Gate | Noise;

// ---------------- Workspace / API payload ----------------
// CircuitStep is the discriminated union stored in the editor
// and POSTed to /api/run_circuit. The backend expects exactly
// this shape (id + type + name + optional params).

/** A single step in the circuit: either a gate or a noise channel. */
export type CircuitStep =
  | { id: number; type: "gate"; name: GateName; params?: GateParams }
  | { id: number; type: "noise"; name: NoiseName; params?: NoiseParams };
