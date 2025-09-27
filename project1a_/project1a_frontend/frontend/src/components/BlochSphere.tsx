"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface BlochSphereProps {
  /** Bloch vector in canonical Bloch coords (X,Y,Z). Defaults to |0⟩ = (0,0,1). */
  blochVector?: { x: number; y: number; z: number };
}

/** Canonical view mapping:
 * Z_bloch -> up (Y_three), X_bloch -> toward camera (Z_three), Y_bloch -> right (X_three).
 * So: (X_three, Y_three, Z_three) = (Y, Z, X)
 */
function mapBlochToThree(v: THREE.Vector3) {
  return new THREE.Vector3(v.y, v.z, v.x);
}

function makeLabelSprite(text: string, color = "#ffffff", scale = 0.22) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  ctx.font = "bold 72px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.strokeText(text, size / 2, size / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, scale);
  return sprite;
}

function buildAxis(dir: THREE.Vector3, length = 1.6, color = 0xffffff) {
  const group = new THREE.Group();
  const matLine = new THREE.LineBasicMaterial({ color });
  const start = dir.clone().multiplyScalar(-length);
  const end = dir.clone().multiplyScalar(length);
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  group.add(new THREE.Line(geo, matLine));

  const headLen = 0.12;
  const headRad = 0.05;

  function arrow(at: THREE.Vector3, axis: THREE.Vector3) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(headRad, headLen, 20),
      new THREE.MeshBasicMaterial({ color })
    );
    cone.position.copy(at);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    cone.quaternion.copy(quat);
    return cone;
  }
  group.add(arrow(end, dir));
  group.add(arrow(start, dir.clone().multiplyScalar(-1)));
  return group;
}

const BlochSphere: React.FC<BlochSphereProps> = ({ blochVector }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const lineRef = useRef<THREE.Line | null>(null);
  const tipRef = useRef<THREE.Mesh | null>(null);

  // Keep latest Bloch vector (avoid scene re-init)
  const blochRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 1));
  if (blochVector) blochRef.current.set(blochVector.x, blochVector.y, blochVector.z);
  else blochRef.current.set(0, 0, 1);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.8;
    controlsRef.current = controls;

    // Sphere: translucent blue wireframe
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x5e7bff, wireframe: true, opacity: 0.45, transparent: true })
    );
    scene.add(sphere);

    // Canonical Bloch axes in Three space
    const dirX_three = new THREE.Vector3(0, 0, 1); // X_bloch
    const dirY_three = new THREE.Vector3(1, 0, 0); // Y_bloch
    const dirZ_three = new THREE.Vector3(0, 1, 0); // Z_bloch
    scene.add(buildAxis(dirX_three, 1.6, 0xff6666));
    scene.add(buildAxis(dirY_three, 1.6, 0x66ff66));
    scene.add(buildAxis(dirZ_three, 1.6, 0x66a3ff));

    // Axis labels farther out
    const lblX = makeLabelSprite("X", "#ff6666", 0.22);
    const lblY = makeLabelSprite("Y", "#66ff66", 0.22);
    const lblZ = makeLabelSprite("Z", "#66a3ff", 0.22);
    lblX.position.copy(dirX_three.clone().multiplyScalar(1.75));
    lblY.position.copy(dirY_three.clone().multiplyScalar(1.75));
    lblZ.position.copy(dirZ_three.clone().multiplyScalar(1.75));
    scene.add(lblX, lblY, lblZ);

    // Basis labels (positions defined in Bloch coords, then mapped)
    const placeBlochLabel = (text: string, color: string, bpos: THREE.Vector3) => {
      const s = makeLabelSprite(text, color, 0.22);
      s.position.copy(mapBlochToThree(bpos));
      scene.add(s);
    };
    // Z: |0>, |1>
    placeBlochLabel("|0⟩", "#cfe3ff", new THREE.Vector3(0, 0, 1.2));
    placeBlochLabel("|1⟩", "#cfe3ff", new THREE.Vector3(0, 0, -1.2));
    // X: |+>, |−>
    placeBlochLabel("|+⟩", "#ffe6b3", new THREE.Vector3(1.2, 0, 0));
    placeBlochLabel("|−⟩", "#ffe6b3", new THREE.Vector3(-1.2, 0, 0));
    // Y: |+i>, |−i>
    placeBlochLabel("|+i⟩", "#d6ffd6", new THREE.Vector3(0, 1.2, 0));
    placeBlochLabel("|−i⟩", "#d6ffd6", new THREE.Vector3(0, -1.2, 0));

    // Bloch vector line + tip
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)]);
    const line = new THREE.Line(lineGeo, lineMat);
    lineRef.current = line;
    scene.add(line);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    tip.position.set(0, 0, 1);
    tipRef.current = tip;
    scene.add(tip);

    // Resize
    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
      const { clientWidth, clientHeight } = mountRef.current;
      cameraRef.current.aspect = clientWidth / clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", onResize);

    // Render loop
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // NEW: if vector length == 0, stay at origin (no snap to |0⟩)
      const b = blochRef.current.clone();
      const L = b.length();
      const bClamped = L > 0 ? b.multiplyScalar(Math.min(L, 1) / L) : new THREE.Vector3(0, 0, 0);
      const tipPos = mapBlochToThree(bClamped);

      const lg = lineRef.current?.geometry as THREE.BufferGeometry | undefined;
      if (lg) lg.setFromPoints([new THREE.Vector3(0, 0, 0), tipPos]);
      if (tipRef.current) tipRef.current.position.copy(tipPos);

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  function handleResetView() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 0, 3);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  return (
    <div className="relative w-full h-[420px] md:h-[520px]">
      <button
        onClick={handleResetView}
        className="absolute right-2 top-2 z-10 text-xs px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600"
        title="Reset orientation"
      >
        Reset View
      </button>
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};

export default BlochSphere;
