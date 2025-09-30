// Shared types used across components

export type GateName = "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz";
export type NoiseName = "amplitude_damping" | "phase_damping" | "depolarizing";

export type GateParams = {
  /** Only used for rotation gates Rx/Ry/Rz */
  theta?: number;
};

export type NoiseParams = {
  /** Amplitude Damping */
  gamma?: number;
  /** Phase Damping */
  lambda?: number;
  /** Depolarizing */
  p?: number;
};

// Palette items you can drag from the right-hand palette
export type Gate = {
  id: number;
  type: "gate";
  /** Display label e.g. "X Gate" */
  name: string;
  /** Semantic operation */
  op: GateName;
  /** Default parameter for rotations (optional) */
  parameter?: number;
};

export type Noise = {
  id: number;
  type: "noise";
  /** Display label e.g. "Amplitude Damping (γ)" */
  name: string;
  op: NoiseName;
  /** Default value (0..1) */
  parameter?: number;
};

export type PaletteItem = Gate | Noise;

// What we store in the workspace editor and send to /api/run_circuit
export type CircuitStep =
  | { id: number; type: "gate"; name: GateName; params?: GateParams }
  | { id: number; type: "noise"; name: NoiseName; params?: NoiseParams };
