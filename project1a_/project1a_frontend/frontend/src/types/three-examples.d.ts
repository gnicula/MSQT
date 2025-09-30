// Minimal type shims for three.js example modules used directly.
// We only declare the subset of OrbitControls that the app touches.
// This keeps TypeScript happy without pulling in broader example typings.
//
// Notes:
// - Runtime behavior is provided by the real JS module from three/examples.
// - This .d.ts file is compile-time only; it does not affect runtime.
// - If you start using more OrbitControls features, extend this shim accordingly.

declare module "three/examples/jsm/controls/OrbitControls" {
  import * as THREE from "three";

  /**
   * Thin declaration of OrbitControls as used in BlochSphere.
   * Extends THREE.EventDispatcher to match the upstream typings model.
   */
  export class OrbitControls extends THREE.EventDispatcher {
    /**
     * Create controls bound to a camera and a DOM element.
     * @param object The camera being controlled.
     * @param domElement The canvas/element receiving input (optional).
     */
    constructor(object: THREE.Camera, domElement?: HTMLElement);

    // ---------- Toggles ----------
    /** Master on/off switch for the controls. */
    enabled: boolean;

    /** Enable inertial "damped" motion when orbiting. */
    enableDamping: boolean;

    /** Allow zoom in/out (wheel/pinch). */
    enableZoom: boolean;

    /** Allow rotation/orbit around the target. */
    enableRotate: boolean;

    /** Allow panning the target (usually disabled for BlochSphere). */
    enablePan: boolean;

    // ---------- Speeds & factors ----------
    /** Damping factor applied per-frame when enableDamping is true (0..1). */
    dampingFactor: number;

    /** Sensitivity multiplier for rotation/orbit interactions. */
    rotateSpeed: number;

    /** Sensitivity multiplier for zoom interactions. (Used by BlochSphere) */
    zoomSpeed: number;

    /** Sensitivity multiplier for panning interactions. */
    panSpeed: number;

    // ---------- Distances / angles (constraints) ----------
    /** Minimum camera distance from the target. */
    minDistance: number;

    /** Maximum camera distance from the target. */
    maxDistance: number;

    /** Minimum polar angle (vertical) in radians. */
    minPolarAngle: number;

    /** Maximum polar angle (vertical) in radians. */
    maxPolarAngle: number;

    /** Minimum azimuth angle (horizontal) in radians. */
    minAzimuthAngle: number;

    /** Maximum azimuth angle (horizontal) in radians. */
    maxAzimuthAngle: number;

    // ---------- Target ----------
    /** The point in world space to orbit around / look at. */
    target: THREE.Vector3;

    // ---------- Methods ----------
    /**
     * Recompute internal state—call once per frame when using damping.
     * Safe to call each render loop tick.
     */
    update(): void;

    /** Remove event listeners and free resources. */
    dispose(): void;

    /** Save the current camera + target state (used by reset). */
    saveState(): void;

    /** Restore the last saved state (camera position/zoom/target). */
    reset(): void;
  }
}
