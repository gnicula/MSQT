// Shared types used across components

export type GateName = "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz";
export type NoiseName = "amplitude_damping" | "phase_damping" | "depolarizing";

export type GateParams = {
  theta?: number; // only for R* rotations
};

export type NoiseParams = {
  gamma?: number;  // amplitude_damping
  lambda?: number; // phase_damping
  p?: number;      // depolarizing
};

// Palette items you can drag from the right-hand palette
export type Gate = {
  id: number;
  type: "gate";
  name: string;       // display label e.g. "X Gate"
  op: GateName;       // semantic op
  parameter?: number; // optional default parameter for rotations
};

export type Noise = {
  id: number;
  type: "noise";
  name: string;       // display label e.g. "Amplitude Damping (γ)"
  op: NoiseName;
  parameter?: number; // default value (0..1)
};

export type PaletteItem = Gate | Noise;

// What we store in the workspace editor and send to /api/run_circuit
export type CircuitStep =
  | { id: number; type: "gate";  name: GateName;  params?: GateParams }
  | { id: number; type: "noise"; name: NoiseName; params?: NoiseParams };
