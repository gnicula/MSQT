"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface BlochSphereProps {
  blochVector: { x: number; y: number; z: number };
}

const BlochSphere: React.FC<BlochSphereProps> = ({ blochVector }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true; // Allow zoom
    controls.enablePan = false;
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;

    // Bloch Sphere
    const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x8888ff,
      wireframe: true,
      opacity: 0.3,
      transparent: true,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1.5);
    scene.add(axesHelper);

    // Bloch vector line
    const vector = new THREE.Vector3(
      blochVector?.x ?? 0,
      blochVector?.y ?? 0,
      blochVector?.z ?? 1
    ).normalize();

    const points = [new THREE.Vector3(0, 0, 0), vector];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const blochLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(blochLine);

    // Tooltip for angles
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.background = "rgba(0,0,0,0.7)";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "4px 8px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.pointerEvents = "none";
    tooltip.style.display = "none";
    mount.appendChild(tooltip);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseMove(event: MouseEvent) {
      mouse.x = (event.clientX / mount.clientWidth) * 2 - 1;
      mouse.y = -(event.clientY / mount.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(sphere);
      if (intersects.length > 0) {
        const theta = Math.acos(vector.z).toFixed(2);
        const phi = Math.atan2(vector.y, vector.x).toFixed(2);
        tooltip.innerHTML = `θ: ${theta} rad<br>φ: ${phi} rad`;
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.style.display = "block";
      } else {
        tooltip.style.display = "none";
      }
    }
    window.addEventListener("mousemove", onMouseMove);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      mount.removeChild(renderer.domElement);
      mount.removeChild(tooltip);
    };
  }, [blochVector]);

  return <div ref={mountRef} className="w-full h-[500px]"></div>;
};

export default BlochSphere;
