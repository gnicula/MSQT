// Shared types used by the UI and API payloads

export type GateName = "H" | "X" | "Y" | "Z" | "Rx" | "Ry" | "Rz";
export type NoiseName = "amplitude_damping" | "phase_damping" | "depolarizing";

export type Gate = {
  id: number;
  type: "gate";
  name: string;
  op: GateName;
  parameter?: number; // e.g., theta (radians) for rotation gates
};

export type Noise = {
  id: number;
  type: "noise";
  name: string;
  op: NoiseName;
  parameter?: number; // e.g., gamma/lambda/p
};

/** What the palette shows on the right */
export type PaletteItem = Gate | Noise;

/** Gate step params */
export type GateParams = {
  theta?: number;
  angle?: number;
  Theta?: number;
};

/** Noise step params (optional keys by design) */
export type NoiseParams = {
  gamma?: number;  // amplitude damping
  lambda?: number; // phase damping
  p?: number;      // depolarizing
};

export type CircuitStep =
  | {
      id: number;
      type: "gate";
      name: GateName;
      params?: GateParams;
    }
  | {
      id: number;
      type: "noise";
      name: NoiseName;
      params?: NoiseParams;
    };
