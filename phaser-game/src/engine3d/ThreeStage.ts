import Phaser from 'phaser';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clearReliefCache } from './Extruder';
import { allowsHeavy3DAssets, releaseModelGpuResources } from './GlbModels';
import { tuneModelTextures } from './ModelMaterials';
import { performanceProfile, type PerformanceProfile } from './PerformanceProfile';
import { releasePropGpuResources } from './PropModels';

// ── Three.js stage ───────────────────────────────────────────────────────────
// Owns the WebGL canvas (kept exactly underneath the Phaser canvas, which
// renders UI on top with a transparent background while 3D mode is active),
// the scene graph, lights, sky dome and fog. Environment presets recolor the
// world per biome (day / snow / cave / interior / battle).

export type EnvProfile = 'day' | 'snow' | 'cave' | 'interior' | 'battle';

interface EnvColors {
  skyTop: number; skyBottom: number; fog: number; fogNear: number; fogFar: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  sun: number; sunIntensity: number; showSky: boolean; cloudOpacity: number;
}

const ENVS: Record<EnvProfile, EnvColors> = {
  day:      { skyTop: 0x3f9ee8, skyBottom: 0xe4f4ff, fog: 0xd4e9f5, fogNear: 36, fogFar: 96,
              hemiSky: 0xe1f2ff, hemiGround: 0x8fa66f, hemiIntensity: 1.28, sun: 0xfff0d1, sunIntensity: 2.05, showSky: true, cloudOpacity: 0.72 },
  snow:     { skyTop: 0x80acd8, skyBottom: 0xf5f9ff, fog: 0xedf3f8, fogNear: 22, fogFar: 58,
              hemiSky: 0xf0f6ff, hemiGround: 0xc8d4df, hemiIntensity: 1.3, sun: 0xfff8ed, sunIntensity: 1.55, showSky: true, cloudOpacity: 0.82 },
  cave:     { skyTop: 0x10101d, skyBottom: 0x28243a, fog: 0x171523, fogNear: 9, fogFar: 32,
              hemiSky: 0x575176, hemiGround: 0x211d2b, hemiIntensity: 0.92, sun: 0x9d91cb, sunIntensity: 0.72, showSky: true, cloudOpacity: 0 },
  interior: { skyTop: 0x2a2634, skyBottom: 0x3c3648, fog: 0x302b39, fogNear: 20, fogFar: 48,
              hemiSky: 0xfff4df, hemiGround: 0x7b6e5c, hemiIntensity: 1.32, sun: 0xffe5ba, sunIntensity: 1.25, showSky: false, cloudOpacity: 0 },
  battle:   { skyTop: 0x398fdf, skyBottom: 0xe5f4ff, fog: 0xd5e9f8, fogNear: 32, fogFar: 96,
              hemiSky: 0xe3f1ff, hemiGround: 0x91a875, hemiIntensity: 0.9, sun: 0xffefd1, sunIntensity: 1.5, showSky: true, cloudOpacity: 0.62 },
};

export class ThreeStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  /** Root for per-Phaser-scene content; cleared on scene change. */
  worldRoot: THREE.Group;

  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private clouds = new THREE.Group();
  private cloudMaterial: THREE.SpriteMaterial;
  private preparedMeshes = new WeakSet<THREE.Mesh>();
  private viewDir = new THREE.Vector3();
  private lightFocus = new THREE.Vector3();
  private readonly sunOffset = new THREE.Vector3(-11, 18, 10);
  private readonly rimOffset = new THREE.Vector3(11, 8, -12);
  private readonly fillOffset = new THREE.Vector3(8, 5, 10);
  private readonly maxAnisotropy: number;
  readonly performance: PerformanceProfile;
  private game: Phaser.Game;
  private rectTimer = 0;
  private contextLost = false;
  private visible = false;
  private qualityScale = 1;
  private currentPixelRatio = 1;
  private lastRect = { left: NaN, top: NaN, width: 0, height: 0 };
  private nextMeshPreparationAt = 0;
  private meshWarmUntil = 0;
  private lastShadowAt = -Infinity;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;pointer-events:none;display:none;';
    const highGpuBudget = allowsHeavy3DAssets();
    this.performance = performanceProfile();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    // Three r185 aliases the removed PCFSoft mode to PCF and emits a warning;
    // selecting the effective mode directly keeps the same result without log churn.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadow maps are expensive render passes of the entire scene. They remain
    // enabled at the same resolution, but are refreshed at a bounded cadence;
    // static terrain no longer pays for an identical shadow map 60 times/sec.
    this.renderer.shadowMap.autoUpdate = false;
    this.currentPixelRatio = this.performance.maxPixelRatio;
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.maxAnisotropy = Math.min(
      this.performance.textureAnisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );

    // A mobile browser is allowed to evict a WebGL context when GPU memory is
    // tight.  Previously the transparent Phaser canvas remained enabled after
    // that happened, so the user saw the page's black background and no
    // battlers.  Keep an explicit health flag so Engine3D can atomically fall
    // back to the complete 2D scene instead.
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.renderer.resetState();
      this.preparedMeshes = new WeakSet<THREE.Mesh>();
    }, false);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);

    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x8a9a6a, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.sun.position.set(-6, 12, 5);
    this.sun.castShadow = true;
    const shadowSize = highGpuBudget ? 2048 : 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.035;
    // Half-strength shadows: a building's cast shadow on an adjacent road read as
    // hard black tiles (e.g. beside the So-ol Poké Mart). Softening keeps the 3D
    // depth cue while the shadow blends to grey instead of near-black.
    this.sun.shadow.intensity = 0.5;
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = shadowCam.bottom = -18;
    shadowCam.right = shadowCam.top = 18;
    shadowCam.near = 0.5;
    shadowCam.far = 55;
    shadowCam.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.rim = new THREE.DirectionalLight(0x8ed8ff, 0);
    this.fill = new THREE.DirectionalLight(0xffb56b, 0);
    this.scene.add(this.rim, this.rim.target, this.fill, this.fill.target);

    // Gradient sky dome.
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x4f9be8) },
        bottom: { value: new THREE.Color(0xcfe8ff) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
        void main(){ float h = clamp(normalize(vP).y*1.4+0.35, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), this.skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // Soft illustrated cloud banks add the spacious, toy-like horizon that the
    // handheld games use to keep low-detail scenery from reading as voxel art.
    this.cloudMaterial = new THREE.SpriteMaterial({
      map: this.makeCloudTexture(), color: 0xffffff, transparent: true,
      opacity: 0.72, depthWrite: false, fog: false,
    });
    const cloudLayout: [number, number, number, number, number][] = [
      [-30, 11, -52, 18, 7], [25, 14, -60, 23, 8], [-44, 18, -76, 27, 9],
      [46, 10, -44, 16, 6], [3, 22, -82, 31, 10], [-16, 16, -68, 20, 7],
    ];
    for (const [x, y, z, w, h] of cloudLayout) {
      const cloud = new THREE.Sprite(this.cloudMaterial);
      cloud.position.set(x, y, z);
      cloud.scale.set(w, h, 1);
      this.clouds.add(cloud);
    }
    this.scene.add(this.clouds);

    this.setEnvironment('day');
    this.meshWarmUntil = performance.now() + 10_000;

    // Keep our canvas glued to the Phaser canvas through FIT-scale changes.
    this.game.scale.on(Phaser.Scale.Events.RESIZE, () => this.syncRect());
    window.addEventListener('resize', () => this.syncRect());
  }

  attachDom(): void {
    const pc = this.game.canvas;
    if (pc && pc.parentElement && !this.canvas.parentElement) {
      pc.parentElement.insertBefore(this.canvas, pc);
      // Explicit stacking: the Phaser canvas (UI) must paint ABOVE this one.
      // Without this, an absolutely-positioned canvas paints over the static
      // Phaser canvas regardless of DOM order — hiding all dialogue/menus.
      this.canvas.style.zIndex = '0';
      pc.style.position = 'relative';
      pc.style.zIndex = '1';
      this.syncRect();
    }
  }

  /** Match the Phaser canvas position/size exactly (it is FIT-scaled + centered). */
  syncRect(): void {
    const pc = this.game.canvas;
    if (!pc || !pc.parentElement) return;
    const rect = pc.getBoundingClientRect();
    // iOS briefly reports a 0×0 canvas while rotating, restoring a tab or
    // dismissing an overlay. Retain the last valid projection instead of
    // replacing it with aspect=0, which renders a technically successful but
    // completely black Three.js frame.
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width < 2 || rect.height < 2) {
      this.rectTimer = 89; // retry on the next rendered frame
      return;
    }
    const host = pc.parentElement.getBoundingClientRect();
    const left = rect.left - host.left + pc.parentElement.scrollLeft;
    const top = rect.top - host.top + pc.parentElement.scrollTop;
    if (!Number.isFinite(this.lastRect.left) || Math.abs(left - this.lastRect.left) > 0.1) this.canvas.style.left = `${left}px`;
    if (!Number.isFinite(this.lastRect.top) || Math.abs(top - this.lastRect.top) > 0.1) this.canvas.style.top = `${top}px`;
    if (Math.abs(rect.width - this.lastRect.width) > 0.1) this.canvas.style.width = `${rect.width}px`;
    if (Math.abs(rect.height - this.lastRect.height) > 0.1) this.canvas.style.height = `${rect.height}px`;
    const w = Math.max(2, Math.round(rect.width)), h = Math.max(2, Math.round(rect.height));
    if (Math.round(this.lastRect.width) !== w || Math.round(this.lastRect.height) !== h) {
      this.renderer.setSize(w, h, false);
    }
    const aspect = rect.width / Math.max(1, rect.height);
    if (Math.abs(this.camera.aspect - aspect) > 0.0001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.lastRect = { left, top, width: rect.width, height: rect.height };
  }

  setEnvironment(profile: EnvProfile): void {
    const e = ENVS[profile];
    (this.skyMat.uniforms.top.value as THREE.Color).set(e.skyTop);
    (this.skyMat.uniforms.bottom.value as THREE.Color).set(e.skyBottom);
    this.sky.visible = e.showSky;
    this.scene.fog = new THREE.Fog(e.fog, e.fogNear, e.fogFar);
    this.scene.background = new THREE.Color(e.showSky ? e.skyBottom : e.fog);
    this.hemi.color.set(e.hemiSky);
    this.hemi.groundColor.set(e.hemiGround);
    this.hemi.intensity = e.hemiIntensity;
    this.sun.color.set(e.sun);
    this.sun.intensity = e.sunIntensity;
    this.clouds.visible = e.cloudOpacity > 0;
    this.cloudMaterial.opacity = e.cloudOpacity;
    const battle = profile === 'battle';
    this.rim.color.set(battle ? 0x79cfff : 0xa8cfff);
    this.rim.intensity = battle ? 1.0 : profile === 'interior' ? 0.34 : 0.18;
    this.fill.color.set(battle ? 0xffa55f : 0xffd6a4);
    this.fill.intensity = battle ? 0.36 : profile === 'interior' ? 0.34 : 0.12;
    this.scene.environmentIntensity = battle ? 0.42 : profile === 'interior' ? 0.46 : 0.38;
  }

  /** Scene-specific clear/fog colour used by bright authored interiors. */
  setBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(color);
  }

  setVisible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    this.canvas.style.display = v ? 'block' : 'none';
  }

  /** Dynamically tune only the 3D render-buffer density. Scene geometry, PBR
   * materials, shadows, effects and the full-resolution Phaser UI are unchanged. */
  setQualityScale(scale: number): boolean {
    const nextScale = Math.max(0.67, Math.min(1, scale));
    const nextRatio = Math.max(
      this.performance.minPixelRatio,
      this.performance.maxPixelRatio * nextScale,
    );
    if (Math.abs(nextRatio - this.currentPixelRatio) < 0.04) return false;
    this.qualityScale = nextScale;
    this.currentPixelRatio = nextRatio;
    this.renderer.setPixelRatio(nextRatio);
    // setPixelRatio resizes the drawing buffer; reassert the FIT-aligned CSS
    // rectangle and projection while preserving the logical viewport.
    this.lastRect.width = 0;
    this.lastRect.height = 0;
    this.syncRect();
    return true;
  }

  getQualityScale(): number { return this.qualityScale; }

  getRenderStats(): { calls: number; triangles: number; pixelRatio: number } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pixelRatio: this.currentPixelRatio,
    };
  }

  /** Async GLBs can arrive long after the first world scan. Mirrors call this
   * when one is attached so texture/shadow preparation happens on the next frame. */
  requestMeshPreparation(): void { this.nextMeshPreparationAt = 0; }

  /** Whether it is safe to make the Phaser canvas transparent this frame. */
  isHealthy(): boolean {
    if (this.contextLost) return false;
    try { return !this.renderer.getContext().isContextLost(); }
    catch { return false; }
  }

  /** Replace the world root with a fresh empty group (disposing the old content). */
  resetWorld(): THREE.Group {
    this.scene.remove(this.worldRoot);
    disposeDeep(this.worldRoot);
    // Relief geometry/texture entries otherwise live for the entire browser
    // session. Clearing only after the old root is detached is safe and keeps
    // repeated route/battle transitions from exhausting mobile GPU memory.
    clearReliefCache();
    releaseModelGpuResources();
    releasePropGpuResources();
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    this.preparedMeshes = new WeakSet<THREE.Mesh>();
    this.nextMeshPreparationAt = 0;
    this.meshWarmUntil = performance.now() + 10_000;
    this.lastShadowAt = -Infinity;
    return this.worldRoot;
  }

  render(): boolean {
    if (!this.isHealthy()) return false;
    const p = this.camera.position, q = this.camera.quaternion;
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
      && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)
      && Number.isFinite(this.camera.aspect) && Number.isFinite(this.camera.near) && Number.isFinite(this.camera.far))
      || this.camera.aspect <= 0 || this.camera.near <= 0 || this.camera.far <= this.camera.near) {
      return false;
    }
    // Periodic safety re-sync (layout can shift without a resize event, e.g. fonts).
    if (++this.rectTimer >= 180) { this.rectTimer = 0; this.syncRect(); }
    this.sky.position.copy(this.camera.position);
    this.clouds.position.copy(this.camera.position);
    // Keep the sun and its compact shadow camera centred on the visible action.
    // The fixed direction preserves the painted look while avoiding low-res
    // shadows spread across an entire route.
    this.camera.getWorldDirection(this.viewDir);
    this.lightFocus.copy(this.camera.position).addScaledVector(this.viewDir, 8);
    this.sun.target.position.copy(this.lightFocus);
    this.sun.position.copy(this.lightFocus).add(this.sunOffset);
    this.rim.target.position.copy(this.lightFocus);
    this.rim.position.copy(this.lightFocus).add(this.rimOffset);
    this.fill.target.position.copy(this.lightFocus);
    this.fill.position.copy(this.lightFocus).add(this.fillOffset);
    this.sun.target.updateMatrixWorld();
    this.rim.target.updateMatrixWorld();
    this.fill.target.updateMatrixWorld();
    const now = performance.now();
    if (now >= this.nextMeshPreparationAt) {
      const prepared = this.prepareWorldMeshes();
      this.nextMeshPreparationAt = now + (prepared > 0 ? 700 : now < this.meshWarmUntil ? 1_500 : 6_000);
    }
    if (now - this.lastShadowAt >= 1000 / this.performance.shadowFps) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowAt = now;
    }
    this.renderer.render(this.scene, this.camera);
    return this.isHealthy();
  }

  private prepareWorldMeshes(): number {
    let prepared = 0;
    this.worldRoot.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || this.preparedMeshes.has(mesh)) return;
      this.preparedMeshes.add(mesh);
      prepared++;
      tuneModelTextures(mesh, this.maxAnisotropy);
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      const translucent = mats.some(m => m.transparent || m.opacity < 0.98);
      mesh.castShadow = !translucent;
      mesh.receiveShadow = !translucent;
    });
    return prepared;
  }

  private makeCloudTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d')!;
    const glow = ctx.createRadialGradient(128, 70, 8, 128, 70, 105);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.62, 'rgba(255,255,255,0.92)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(128, 74, 108, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rx, ry] of [[70, 70, 36, 28], [108, 52, 48, 38], [151, 47, 42, 34], [188, 69, 38, 28]] as const) {
      const p = ctx.createRadialGradient(x, y - 5, 2, x, y, rx);
      p.addColorStop(0, 'rgba(255,255,255,0.98)');
      p.addColorStop(0.72, 'rgba(255,255,255,0.88)');
      p.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = p;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }
}

/** Dispose geometries, materials and their private textures created per scene. */
export function disposeDeep(root: THREE.Object3D): void {
  const disposedTextures = new Set<THREE.Texture>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposeMaterial = (material: THREE.Material): void => {
    if (disposedMaterials.has(material)) return;
    disposedMaterials.add(material);
    // Textures are separate GPU resources; Material.dispose() does not release
    // them. gradientMap is the process-wide toon ramp and must remain shared.
    for (const [key, value] of Object.entries(material)) {
      if (key === 'gradientMap' || !(value instanceof THREE.Texture) || value.userData.pkSharedDetailTexture || disposedTextures.has(value)) continue;
      disposedTextures.add(value);
      value.dispose();
    }
    material.dispose();
  };
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !(mesh.userData.sharedGeo)) mesh.geometry.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (mat && !mesh.userData.sharedMat) {
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else disposeMaterial(mat);
    }
  });
}
