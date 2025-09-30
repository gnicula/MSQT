// Minimal type shims for three.js example modules used directly.
// Extends OrbitControls with the props we use in BlochSphere.

declare module "three/examples/jsm/controls/OrbitControls" {
  import * as THREE from "three";

  export class OrbitControls extends THREE.EventDispatcher {
    constructor(object: THREE.Camera, domElement?: HTMLElement);

    // toggles
    enabled: boolean;
    enableDamping: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;

    // speeds & factors
    dampingFactor: number;
    rotateSpeed: number;
    zoomSpeed: number;        // <-- added to match your BlochSphere usage
    panSpeed: number;

    // distances / angles
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;

    // target
    target: THREE.Vector3;

    // methods
    update(): void;
    dispose(): void;
    saveState(): void;
    reset(): void;
  }
}
