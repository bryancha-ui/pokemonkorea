import * as THREE from 'three';

// Soft round flake sprite, built once and shared by every SnowFX instance.
let flakeTexture: THREE.CanvasTexture | null = null;
function getFlakeTexture(): THREE.CanvasTexture {
  if (flakeTexture) return flakeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(16, 16, 16, 0, Math.PI * 2); g.fill();
  flakeTexture = new THREE.CanvasTexture(c);
  flakeTexture.colorSpace = THREE.SRGBColorSpace;
  return flakeTexture;
}

/**
 * A drifting 3D snowfall for battles under a Snow Warning / hail weather. Flakes
 * fall inside a tall box centred on the arena origin (which is where the battle
 * camera looks), wrapping back to the top so the fall never runs out. Purely
 * decorative — no lights, no shadows, additive-free so it never blows out the
 * scene. Call update(dt) every frame and dispose() when the weather clears.
 */
export class SnowFX {
  readonly object: THREE.Points;
  private readonly count: number;
  private readonly speed: Float32Array;
  private readonly driftPhase: Float32Array;
  private readonly halfX = 11;
  private readonly halfZ = 11;
  private readonly height = 16;
  private time = 0;

  constructor(count = 420) {
    this.count = count;
    const positions = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.driftPhase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * this.halfX;
      positions[i * 3 + 1] = Math.random() * this.height;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * this.halfZ;
      this.speed[i] = 1.6 + Math.random() * 2.4;          // tiles/sec fall speed
      this.driftPhase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: getFlakeTexture(),
      size: 0.16,
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.object = new THREE.Points(geo, mat);
    this.object.frustumCulled = false;   // the box is always near the camera
    this.object.renderOrder = 4;
    this.object.name = 'battle-snow';
  }

  update(dt: number): void {
    this.time += dt;
    const attr = this.object.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      let y = arr[i * 3 + 1] - this.speed[i] * dt;
      // Gentle horizontal sway so flakes don't fall in straight lines.
      const x = arr[i * 3] + Math.sin(this.time * 0.9 + this.driftPhase[i]) * 0.4 * dt;
      if (y < 0) {
        y += this.height;                                   // recycle to the top
        arr[i * 3] = (Math.random() * 2 - 1) * this.halfX;
        arr[i * 3 + 2] = (Math.random() * 2 - 1) * this.halfZ;
        arr[i * 3 + 1] = y;
        continue;
      }
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
  }
}
