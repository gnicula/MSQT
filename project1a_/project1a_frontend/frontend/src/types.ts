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

export type CircuitStep =
  | {
      id: number;
      type: "gate";
      name: string;
      params?: { theta?: number; angle?: number; Theta?: number };
    }
  | {
      id: number;
      type: "noise";
      name: string;
      params?: Record<string, number>;
    };
