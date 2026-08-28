import Phaser from 'phaser';
import * as THREE from 'three';
import { getModel, hasModel, modelBaseYawRad, modelNormalizedHeight, pinModel, primeManifest, unpinModel } from './GlbModels';

// ── Starter preview ──────────────────────────────────────────────────────────
// A small self-contained Three.js stage that shows ONE generated creature model
// at a time, floating above the lab desk while the player browses starters.
//
// It is deliberately independent of the main 3D engine: the starter select is a
// menu, not a mirrored world scene, so it owns a tiny renderer sized to a rect
// of the Phaser canvas and simply draws on top. If a starter has no generated
// model yet, `show()` reports false and the scene falls back to its 2D artwork.

export interface PreviewRect {
  /** top-left position and size in SCENE/world pixels (the lab's 800×500 space).
   *  syncRect() puts these through the scene camera, so they mean the same thing
   *  as the coordinates given to any Phaser game object in the same scene. */
  x: number; y: number; w: number; h: number;
}

const PREVIEW_MODEL_HEIGHT = 1.6;

export class StarterPreview3D {
  private scene: Phaser.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private three = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  private canvas: HTMLCanvasElement | null = null;
  private holder = new THREE.Group();
  private current: THREE.Group | null = null;
  private currentKey = '';
  private pinnedModelKey = '';
  private pending = '';
  private rect: PreviewRect;
  private t = 0;
  private entry = 0;              // 0→1 pop-in progress
  private currentScale = PREVIEW_MODEL_HEIGHT;
  private failed = false;

  constructor(scene: Phaser.Scene, rect: PreviewRect) {
    this.scene = scene;
    this.rect = rect;
    primeManifest();
    try {
      this.canvas = document.createElement('canvas');
      // index.html styles `canvas` globally with a rounded border and a drop
      // shadow — meant for the one game canvas. Inherited here it drew a hard
      // rounded plate around the model, which read as a floating info card
      // rather than a creature standing over its ball. Opt out explicitly.
      this.canvas.style.cssText =
        'position:absolute;pointer-events:none;z-index:2;'
        + 'border-radius:0;box-shadow:none;background:transparent;';
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
    } catch {
      this.failed = true;
      return;
    }

    this.three.add(this.holder);
    this.camera.position.set(0, 1.15, 3.5);
    this.camera.lookAt(0, 0.95, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x777766, 1.5);
    const key = new THREE.DirectionalLight(0xfff3dd, 1.5);
    key.position.set(2.5, 4, 3);
    const rim = new THREE.DirectionalLight(0xbcd8ff, 0.8);
    rim.position.set(-3, 2, -2.5);
    this.three.add(hemi, key, rim);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Move the stage. Coordinates are scene/world pixels, as for any game object. */
  setRect(rect: PreviewRect): void {
    this.rect = rect;
  }

  /** Attach over the Phaser canvas and match the requested design-space rect. */
  private syncRect(): void {
    const pc = this.scene.game.canvas;
    if (!pc || !pc.parentElement || !this.canvas || !this.renderer) return;
    if (!this.canvas.parentElement) {
      pc.parentElement.appendChild(this.canvas);
      pc.style.position = pc.style.position || 'relative';
    }
    // Two transforms stack here, and skipping the first is what used to park the
    // preview next to the professor instead of over the desk:
    //   1. WORLD → SCREEN. The lab is authored in an 800×500 space that its camera
    //      zooms and recentres onto the 1280×720 view, so a rect given in scene
    //      coordinates is nowhere near the same number of screen pixels. Go through
    //      the camera exactly as Phaser does for its own game objects.
    //   2. SCREEN → CSS. Phaser then FIT-scales that view onto the displayed canvas.
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const zoom = cam.zoom || 1;
    const cr = pc.getBoundingClientRect();
    const host = pc.parentElement.getBoundingClientRect();
    const sx = cr.width / this.scene.scale.width;
    const sy = cr.height / this.scene.scale.height;
    const screenX = cam.x + (this.rect.x - view.x) * zoom;
    const screenY = cam.y + (this.rect.y - view.y) * zoom;
    const left = cr.left - host.left + screenX * sx;
    const top = cr.top - host.top + screenY * sy;
    const w = Math.max(2, this.rect.w * zoom * sx);
    const h = Math.max(2, this.rect.h * zoom * sy);
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.setSize(Math.round(w), Math.round(h), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** True when a generated model exists for this creature. */
  static available(key: string): boolean {
    primeManifest();
    return hasModel(key);
  }

  /** Request a creature. Loading is async; the model pops in when it arrives. */
  show(key: string): void {
    if (this.failed) return;
    if (key === this.currentKey && this.current) return;
    this.pending = key;
    this.clearCurrent();
    if (this.canvas) this.canvas.style.display = 'block';
  }

  /** True once a model is actually on screen (not merely requested). */
  isShowing(): boolean { return !!this.current; }

  hide(): void {
    if (this.canvas) this.canvas.style.display = 'none';
    this.pending = '';
    this.clearCurrent();
  }

  private clearCurrent(): void {
    if (this.current) {
      this.holder.remove(this.current);
      this.current = null;
    }
    if (this.pinnedModelKey) {
      unpinModel(this.pinnedModelKey);
      this.pinnedModelKey = '';
    }
    this.currentKey = '';
    this.entry = 0;
    this.currentScale = PREVIEW_MODEL_HEIGHT;
  }

  update(dt: number): void {
    if (this.failed || !this.renderer) return;
    this.t += dt;

    // Stream in the requested model once GlbModels has it cached.
    if (this.pending && !this.current) {
      const loaded = getModel(this.pending);
      if (loaded) {
        const g = loaded.group;
        g.rotation.y = modelBaseYawRad(this.pending);
        // Battle/overworld manifest scales remain untouched. The selection
        // stage compensates for them so all three choices share one visual
        // height (Vipour and Onnurian are intentionally 0.6 elsewhere).
        this.currentScale = PREVIEW_MODEL_HEIGHT / modelNormalizedHeight(this.pending);
        g.scale.setScalar(this.currentScale);
        this.holder.add(g);
        this.current = g;
        this.currentKey = this.pending;
        pinModel(this.currentKey);
        this.pinnedModelKey = this.currentKey;
        this.entry = 0;
      }
    }

    if (this.current) {
      // Pop-in, then a slow turntable with a gentle hover.
      this.entry = Math.min(1, this.entry + dt * 3.2);
      const e = 1 - Math.pow(1 - this.entry, 3);
      const pop = 0.86 + 0.14 * e + Math.sin(e * Math.PI) * 0.06;
      this.current.scale.setScalar(this.currentScale * pop);
      this.holder.rotation.y = this.t * 0.6;
      this.holder.position.y = Math.sin(this.t * 1.8) * 0.05;
    }

    this.syncRect();
    this.renderer.render(this.three, this.camera);
  }

  destroy(): void {
    this.clearCurrent();
    this.renderer?.dispose();
    this.canvas?.remove();
    this.canvas = null;
    this.renderer = null;
  }
}
