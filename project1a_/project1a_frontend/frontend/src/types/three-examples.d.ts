// Minimal type shims for three.js example modules
// Lets TS compile even though @types/three doesn't ship /examples types.

declare module "three/examples/jsm/controls/OrbitControls" {
  import * as THREE from "three";
  export class OrbitControls extends THREE.EventDispatcher {
    constructor(object: THREE.Camera, domElement?: HTMLElement);
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    minDistance: number;
    maxDistance: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    target: THREE.Vector3;
    update(): void;
    dispose(): void;
    saveState(): void;
    reset(): void;
  }
}
