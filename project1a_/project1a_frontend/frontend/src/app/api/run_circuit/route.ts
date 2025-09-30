// Hybrid route: proxy to Python if BACKEND_URL is set; otherwise run TS simulator.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CircuitStep =
  | { id: number; type: "gate"; name: string; params?: { theta?: number; angle?: number; Theta?: number } }
  | {
      id: number;
      type: "noise";
      name: "amplitude_damping" | "phase_damping" | "depolarizing";
      params?: Record<string, number>;
    };

type Bloch = { x: number; y: number; z: number };
type StepResult = { bloch_vector: Bloch; density_matrix: number[][][] };
type RunResponse = { steps: StepResult[] };

const BACKEND_URL = process.env.BACKEND_URL?.trim(); // e.g. http://127.0.0.1:8000

/** ---------------- Proxy mode ---------------- */
async function proxyToPython(reqBody: any) {
  const url = `${BACKEND_URL!.replace(/\/+$/, "")}/run_circuit`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(reqBody)
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/** ---------------- TS Simulator ---------------- */
function clamp01(x: number) { return Math.min(1, Math.max(0, x)); }
function clampBall(r: Bloch): Bloch {
  const L = Math.hypot(r.x, r.y, r.z);
  return L <= 1 + 1e-9 ? r : { x: r.x / L, y: r.y / L, z: r.z / L };
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
// H: (x,y,z) -> (z,-y,x)
function applyGate(nameRaw: string, r: Bloch, theta?: number): Bloch {
  const name = nameRaw.trim();
  switch (name) {
    case "H":  return { x: r.z, y: -r.y, z: r.x };
    case "X":  return rotX(Math.PI, r);
    case "Y":  return rotY(Math.PI, r);
    case "Z":  return rotZ(Math.PI, r);
    case "Rx": return rotX(theta ?? 0, r);
    case "Ry": return rotY(theta ?? 0, r);
    case "Rz": return rotZ(theta ?? 0, r);
    default:   return r;
  }
}
function applyNoise(name: string, r: Bloch, params: Record<string, number> = {}): Bloch {
  if (name === "amplitude_damping") {
    const g = clamp01(params.gamma ?? (params as any)["γ"] ?? 0);
    const s = Math.sqrt(Math.max(0, 1 - g));
    return clampBall({ x: s * r.x, y: s * r.y, z: (1 - g) * r.z + g });
  }
  if (name === "phase_damping") {
    const l = clamp01(params.lambda ?? (params as any)["λ"] ?? 0);
    const f = Math.max(0, 1 - l);
    return clampBall({ x: f * r.x, y: f * r.y, z: r.z });
  }
  if (name === "depolarizing") {
    const p = clamp01(params.p ?? 0);
    const f = Math.max(0, 1 - p);
    return clampBall({ x: f * r.x, y: f * r.y, z: f * r.z });
  }
  return r;
}
// ρ = 1/2 ( I + rx X + ry Y + rz Z ); encode entries as [re, im]
function densityFromBloch(r: Bloch): number[][][] {
  const a = 0.5 * (1 + r.z);
  const d = 0.5 * (1 - r.z);
  const re01 = 0.5 * r.x;
  const im01 = -0.5 * r.y;
  return [
    [ [a, 0], [re01, im01] ],
    [ [re01, -im01], [d, 0] ]
  ];
}
function runSim(steps: CircuitStep[]): RunResponse {
  let r: Bloch = { x: 0, y: 0, z: 1 };
  const out: StepResult[] = [];
  out.push({ bloch_vector: { ...r }, density_matrix: densityFromBloch(r) });
  for (const s of steps) {
    if (s.type === "gate") {
      const theta = s.params?.theta ?? s.params?.angle ?? s.params?.Theta ?? undefined;
      r = applyGate(s.name, r, theta);
    } else if (s.type === "noise") {
      r = applyNoise(s.name, r, s.params || {});
    }
    r = clampBall(r);
    out.push({ bloch_vector: { ...r }, density_matrix: densityFromBloch(r) });
  }
  return { steps: out };
}

/** --------- POST /api/run_circuit --------- */
export async function POST(req: Request) {
  const body = await req.json();
  const steps: CircuitStep[] = Array.isArray(body?.steps) ? body.steps : [];

  if (BACKEND_URL) {
    try { return await proxyToPython({ steps }); }
    catch {
      const resp = runSim(steps);
      return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
    }
  } else {
    const resp = runSim(steps);
    return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
  }
}
