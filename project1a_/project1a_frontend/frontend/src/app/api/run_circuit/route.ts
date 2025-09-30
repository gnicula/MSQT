import { NextResponse } from "next/server";

/** -------- Types (match your frontend) -------- */
type CircuitStep =
  | { id: number; type: "gate"; name: string; params?: { theta?: number } }
  | {
      id: number;
      type: "noise";
      name: "amplitude_damping" | "phase_damping" | "depolarizing";
      params?: Record<string, number>;
    };

type Bloch = { x: number; y: number; z: number };

type StepResult = {
  bloch_vector: Bloch;
  // [[ [re,im],[re,im] ], [ [re,im],[re,im] ]]
  density_matrix: number[][][];
};

type RunResponse = { steps: StepResult[] };

/** -------- Math helpers (Bloch-space) -------- */
function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function clampBall(r: Bloch): Bloch {
  const L = Math.hypot(r.x, r.y, r.z);
  if (L <= 1 + 1e-9) return r;
  return { x: r.x / L, y: r.y / L, z: r.z / L };
}
function rotX(theta: number, r: Bloch): Bloch {
  const c = Math.cos(theta), s = Math.sin(theta);
  return { x: r.x, y: c * r.y - s * r.z, z: s * r.y + c * r.z };
}
function rotY(theta: number, r: Bloch): Bloch {
  const c = Math.cos(theta), s = Math.sin(theta);
  return { x: c * r.x + s * r.z, y: r.y, z: -s * r.x + c * r.z };
}
function rotZ(theta: number, r: Bloch): Bloch {
  const c = Math.cos(theta), s = Math.sin(theta);
  return { x: c * r.x - s * r.y, y: s * r.x + c * r.y, z: r.z };
}

/** Gates on Bloch vector.
 *  X = Rx(pi),  Y = Ry(pi),  Z = Rz(pi)
 *  H maps axes: (rx, ry, rz) -> (rz, -ry, rx)  (since H X H = Z, H Z H = X, H Y H = -Y)
 */
function applyGate(nameRaw: string, r: Bloch, theta?: number): Bloch {
  const name = nameRaw.trim();
  switch (name) {
    case "H":
      return { x: r.z, y: -r.y, z: r.x };
    case "X":
      return rotX(Math.PI, r);
    case "Y":
      return rotY(Math.PI, r);
    case "Z":
      return rotZ(Math.PI, r);
    case "Rx":
      return rotX(theta ?? 0, r);
    case "Ry":
      return rotY(theta ?? 0, r);
    case "Rz":
      return rotZ(theta ?? 0, r);
    default:
      // Unknown gate name => no-op (keeps flow resilient)
      return r;
  }
}

/** Noise channels (Bloch affine maps) */
function applyNoise(name: string, r: Bloch, params: Record<string, number> = {}): Bloch {
  if (name === "amplitude_damping") {
    // gamma in [0,1]: shrinks x,y by sqrt(1-g), moves z toward +1
    const g = clamp01(params.gamma ?? params["γ"] ?? 0);
    const s = Math.sqrt(Math.max(0, 1 - g));
    return clampBall({ x: s * r.x, y: s * r.y, z: (1 - g) * r.z + g });
  }
  if (name === "phase_damping") {
    // lambda in [0,1]: dephasing shrinks x,y by (1-l), leaves z
    const l = clamp01(params.lambda ?? params["λ"] ?? 0);
    const f = Math.max(0, 1 - l);
    return clampBall({ x: f * r.x, y: f * r.y, z: r.z });
  }
  if (name === "depolarizing") {
    // p in [0,1]: shrinks uniformly toward origin
    const p = clamp01(params.p ?? 0);
    const f = Math.max(0, 1 - p);
    return clampBall({ x: f * r.x, y: f * r.y, z: f * r.z });
  }
  return r;
}

/** Density matrix from Bloch vector:
 *  ρ = 1/2 ( I + rx X + ry Y + rz Z )
 *  Return as array of [re, im] pairs to keep the shape your UI expects.
 */
function densityFromBloch(r: Bloch): number[][][] {
  const a = 0.5 * (1 + r.z);
  const d = 0.5 * (1 - r.z);
  const re01 = 0.5 * r.x;
  const im01 = -0.5 * r.y; // ρ01 = (rx - i ry)/2
  // [[a, re01 + i im01], [re01 - i im01, d]]
  return [
    [
      [a, 0],
      [re01, im01],
    ],
    [
      [re01, -im01],
      [d, 0],
    ],
  ];
}

/** --------- API: POST /api/run_circuit --------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const steps: CircuitStep[] = Array.isArray(body?.steps) ? body.steps : [];

    // Start in |0> => Bloch (0,0,1)
    let r: Bloch = { x: 0, y: 0, z: 1 };
    const out: StepResult[] = [];

    // Include initial state as step 0 so the scrubber shows it.
    out.push({ bloch_vector: { ...r }, density_matrix: densityFromBloch(r) });

    for (const s of steps) {
      if (s.type === "gate") {
        const theta = s.params?.theta ?? s.params?.Theta ?? s.params?.angle ?? undefined;
        r = applyGate(s.name, r, theta);
      } else if (s.type === "noise") {
        r = applyNoise(s.name, r, s.params || {});
      }
      r = clampBall(r);
      out.push({ bloch_vector: { ...r }, density_matrix: densityFromBloch(r) });
    }

    const resp: RunResponse = { steps: out };
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: String(e?.message ?? e) },
      { status: 400 },
    );
  }
}
