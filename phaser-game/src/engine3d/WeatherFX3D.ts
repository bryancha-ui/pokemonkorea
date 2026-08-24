import * as THREE from 'three';

/** Common contract used by BattleMirror so only one field-weather system can
 * own particles at a time.  Every effect is world-space Three.js geometry;
 * there is no fullscreen Phaser overlay obscuring the battlers or battle UI. */
export interface WeatherFX3D {
  readonly object: THREE.Object3D;
  update(dt: number): void;
  dispose(): void;
}

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
export class SnowFX implements WeatherFX3D {
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

// Shared radial sun texture. The actual clear-sky colour and light strength are
// handled by ThreeStage; this sprite gives Sunny Day a readable in-world source.
let sunTexture: THREE.CanvasTexture | null = null;
function getSunTexture(): THREE.CanvasTexture {
  if (sunTexture) return sunTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(64, 64, 3, 64, 64, 63);
  glow.addColorStop(0, 'rgba(255,255,232,1)');
  glow.addColorStop(0.2, 'rgba(255,226,105,0.98)');
  glow.addColorStop(0.52, 'rgba(255,176,55,0.52)');
  glow.addColorStop(1, 'rgba(255,144,32,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  sunTexture = new THREE.CanvasTexture(c);
  sunTexture.colorSpace = THREE.SRGBColorSpace;
  return sunTexture;
}

/** Bright, animated sunlight used by Drought / Sunny Day. The disc and rays are
 * camera-facing sprites, while the drifting gold motes give the whole arena a
 * visible heat shimmer without an expensive full-screen post-process pass. */
export class SunFX implements WeatherFX3D {
  readonly object = new THREE.Group();
  private readonly rays = new THREE.Group();
  private readonly motes: THREE.Points;
  private time = 0;

  constructor(count = 90) {
    this.object.name = 'battle-harsh-sunlight';
    const discMat = new THREE.SpriteMaterial({
      map: getSunTexture(), color: 0xfff0a0, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const disc = new THREE.Sprite(discMat);
    disc.name = 'sun-disc';
    disc.position.set(-4.8, 7.5, -6.5);
    disc.scale.set(4.2, 4.2, 1);
    this.object.add(disc);

    for (let i = 0; i < 8; i++) {
      const ray = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getSunTexture(), color: i % 2 ? 0xffd35b : 0xffefad,
        transparent: true, opacity: 0.2, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      }));
      const a = i * Math.PI / 4;
      ray.position.set(-4.8 + Math.cos(a) * 1.75, 7.5 + Math.sin(a) * 1.75, -6.55);
      ray.scale.set(i % 2 ? 1.6 : 2.1, 0.44, 1);
      ray.material.rotation = a;
      this.rays.add(ray);
    }
    this.object.add(this.rays);

    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 9;
      positions[i * 3 + 1] = Math.random() * 6.5;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: getSunTexture(), color: 0xffd56a, size: 0.09, transparent: true,
      opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.object.add(this.motes);
    this.object.renderOrder = 3;
  }

  update(dt: number): void {
    this.time += dt;
    this.rays.rotation.z = this.time * 0.055;
    const disc = this.object.getObjectByName('sun-disc') as THREE.Sprite | undefined;
    if (disc) {
      const pulse = 1 + Math.sin(this.time * 1.35) * 0.045;
      disc.scale.set(4.2 * pulse, 4.2 * pulse, 1);
    }
    const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += dt * (0.08 + (i % 7) * 0.008);
      positions[i] += Math.sin(this.time * 0.6 + i) * dt * 0.025;
      if (positions[i + 1] > 6.5) positions[i + 1] = 0;
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.motes.geometry.dispose();
    (this.motes.material as THREE.Material).dispose();
    this.object.traverse((node) => {
      if (node instanceof THREE.Sprite) node.material.dispose();
    });
  }
}

// A narrow soft streak keeps rain readable against both bright snow arenas and
// dark indoor battle themes. LineSegments alone alias badly on mobile; the
// transparent canvas texture lets every drop retain a tapered highlight.
let rainTexture: THREE.CanvasTexture | null = null;
function getRainTexture(): THREE.CanvasTexture {
  if (rainTexture) return rainTexture;
  const c = document.createElement('canvas');
  c.width = 16; c.height = 96;
  const g = c.getContext('2d')!;
  const gradient = g.createLinearGradient(8, 0, 8, 96);
  gradient.addColorStop(0, 'rgba(196,229,255,0)');
  gradient.addColorStop(0.2, 'rgba(205,235,255,0.72)');
  gradient.addColorStop(0.82, 'rgba(132,194,239,0.92)');
  gradient.addColorStop(1, 'rgba(113,177,226,0)');
  g.fillStyle = gradient;
  g.beginPath();
  g.ellipse(8, 48, 2.7, 45, 0, 0, Math.PI * 2);
  g.fill();
  rainTexture = new THREE.CanvasTexture(c);
  rainTexture.colorSpace = THREE.SRGBColorSpace;
  return rainTexture;
}

/** Slanted volumetric rainfall used by Drizzle / Rain Dance. Drops occupy the
 * full arena volume and recycle above the field. A second low layer creates
 * small impact glints at ground level without using an expensive post-process. */
export class RainFX implements WeatherFX3D {
  readonly object = new THREE.Group();
  private readonly drops: THREE.Points;
  private readonly splashes: THREE.Points;
  private readonly count: number;
  private readonly speeds: Float32Array;
  private readonly splashLife: Float32Array;
  private readonly halfX = 12;
  private readonly halfZ = 12;
  private readonly height = 15;
  private time = 0;

  constructor(count = 520) {
    this.count = count;
    this.object.name = 'battle-rain';
    const positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * this.halfX;
      positions[i * 3 + 1] = 0.25 + Math.random() * this.height;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * this.halfZ;
      this.speeds[i] = 12 + Math.random() * 9;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getRainTexture(), color: 0xc3e7ff, size: 0.42, transparent: true,
      opacity: 0.78, depthWrite: false, sizeAttenuation: true, fog: false,
    });
    this.drops = new THREE.Points(geometry, material);
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 5;
    // A slight world-space lean makes the downpour feel wind-driven. The point
    // texture itself is vertical, so rotate the whole volume around the camera
    // axis instead of paying for individually oriented planes.
    this.drops.rotation.z = -0.11;
    this.object.add(this.drops);

    const splashCount = Math.max(36, Math.floor(count * 0.14));
    const splashPositions = new Float32Array(splashCount * 3);
    this.splashLife = new Float32Array(splashCount);
    for (let i = 0; i < splashCount; i++) {
      splashPositions[i * 3] = (Math.random() * 2 - 1) * 8.5;
      splashPositions[i * 3 + 1] = 0.04 + Math.random() * 0.05;
      splashPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 8.5;
      this.splashLife[i] = Math.random();
    }
    const splashGeometry = new THREE.BufferGeometry();
    splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    const splashMaterial = new THREE.PointsMaterial({
      map: getFlakeTexture(), color: 0xaedcff, size: 0.11, transparent: true,
      opacity: 0.48, depthWrite: false, sizeAttenuation: true,
    });
    this.splashes = new THREE.Points(splashGeometry, splashMaterial);
    this.splashes.frustumCulled = false;
    this.splashes.renderOrder = 4;
    this.object.add(this.splashes);
  }

  update(dt: number): void {
    this.time += dt;
    const attr = this.drops.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const at = i * 3;
      positions[at + 1] -= this.speeds[i] * dt;
      positions[at] += dt * 1.35;
      if (positions[at + 1] < 0) {
        positions[at] = (Math.random() * 2 - 1) * this.halfX;
        positions[at + 1] += this.height;
        positions[at + 2] = (Math.random() * 2 - 1) * this.halfZ;
      } else if (positions[at] > this.halfX) {
        positions[at] -= this.halfX * 2;
      }
    }
    attr.needsUpdate = true;

    const splashAttr = this.splashes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const splashPositions = splashAttr.array as Float32Array;
    for (let i = 0; i < this.splashLife.length; i++) {
      this.splashLife[i] += dt * (1.8 + (i % 5) * 0.12);
      if (this.splashLife[i] >= 1) {
        this.splashLife[i] -= 1;
        splashPositions[i * 3] = (Math.random() * 2 - 1) * 8.5;
        splashPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 8.5;
      }
      splashPositions[i * 3 + 1] = 0.04 + Math.sin(this.splashLife[i] * Math.PI) * 0.16;
    }
    splashAttr.needsUpdate = true;
    (this.splashes.material as THREE.PointsMaterial).opacity = 0.38 + Math.sin(this.time * 8) * 0.08;
  }

  dispose(): void {
    this.drops.geometry.dispose();
    (this.drops.material as THREE.Material).dispose();
    this.splashes.geometry.dispose();
    (this.splashes.material as THREE.Material).dispose();
  }
}

let sandTexture: THREE.CanvasTexture | null = null;
function getSandTexture(): THREE.CanvasTexture {
  if (sandTexture) return sandTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  glow.addColorStop(0, 'rgba(255,225,151,0.96)');
  glow.addColorStop(0.34, 'rgba(223,170,84,0.78)');
  glow.addColorStop(1, 'rgba(174,112,47,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  // Irregular grains keep the cloud from reading as identical round sparks.
  g.fillStyle = 'rgba(103,65,29,0.5)';
  for (let i = 0; i < 18; i++) {
    const s = 0.7 + Math.random() * 1.5;
    g.fillRect(10 + Math.random() * 44, 10 + Math.random() * 44, s, s);
  }
  sandTexture = new THREE.CanvasTexture(c);
  sandTexture.colorSpace = THREE.SRGBColorSpace;
  return sandTexture;
}

/** Dense cross-field sand used by Sand Stream / Sandstorm. Particles travel in
 * layered gusts with vertical curl, producing depth as they pass in front of
 * and behind both combatants while the stage supplies the ochre fog grade. */
export class SandstormFX implements WeatherFX3D {
  readonly object = new THREE.Group();
  private readonly dust: THREE.Points;
  private readonly count: number;
  private readonly speed: Float32Array;
  private readonly phase: Float32Array;
  private readonly baseY: Float32Array;
  private readonly halfX = 13;
  private readonly halfZ = 11;
  private time = 0;

  constructor(count = 420) {
    this.count = count;
    this.object.name = 'battle-sandstorm';
    const positions = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.baseY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * this.halfX;
      this.baseY[i] = 0.12 + Math.pow(Math.random(), 1.55) * 7.8;
      positions[i * 3 + 1] = this.baseY[i];
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * this.halfZ;
      this.speed[i] = 4.2 + Math.random() * 7.8;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getSandTexture(), color: 0xd8a24f, size: 0.22, transparent: true,
      opacity: 0.72, depthWrite: false, sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 5;
    this.object.add(this.dust);
  }

  update(dt: number): void {
    this.time += dt;
    const attr = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const at = i * 3;
      positions[at] += this.speed[i] * dt;
      positions[at + 1] = this.baseY[i]
        + Math.sin(this.time * 2.1 + this.phase[i]) * (0.16 + (i % 7) * 0.035);
      positions[at + 2] += Math.cos(this.time * 1.3 + this.phase[i]) * dt * 0.42;
      if (positions[at] > this.halfX) {
        positions[at] -= this.halfX * 2;
        positions[at + 2] = (Math.random() * 2 - 1) * this.halfZ;
        this.baseY[i] = 0.12 + Math.pow(Math.random(), 1.55) * 7.8;
      }
      if (positions[at + 2] > this.halfZ) positions[at + 2] -= this.halfZ * 2;
      else if (positions[at + 2] < -this.halfZ) positions[at + 2] += this.halfZ * 2;
    }
    attr.needsUpdate = true;
    // Slow breathing in the whole dust layer makes gusts arrive in waves rather
    // than looking like a fixed-speed particle conveyor.
    (this.dust.material as THREE.PointsMaterial).opacity = 0.62 + Math.sin(this.time * 1.7) * 0.1;
  }

  dispose(): void {
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
  }
}
