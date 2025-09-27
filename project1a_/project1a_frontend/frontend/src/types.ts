export type GateName = "X" | "Y" | "Z" | "H" | "Rx" | "Ry" | "Rz";
export type NoiseName = "amplitude_damping" | "phase_damping" | "depolarizing";

export type CircuitStep =
  | { id: number; type: "gate"; name: GateName; params?: { theta?: number } }
  | { id: number; type: "noise"; name: NoiseName; params: Record<string, number> };

export interface Gate {
  id: number;
  name: string;                  // label for UI, e.g., "Rx(θ)"
  type: "gate" | "noise";
  op: GateName | NoiseName;      // canonical op name for backend
  parameter?: number;            // initial slider value (theta/gamma/etc.)
}
