import * as THREE from 'three';
import { CreatureAnimator } from './CreatureAnimator';
import type { LoadedModel } from './GlbModels';
import { disposeDeep, ThreeStage } from './ThreeStage';

/** The small, camera-anchored 3D stage used while a nursery Egg hatches. */
export interface HatchEffectProfile3D {
  key: string;
  type1?: string;
  type2?: string;
}

const TYPE_COLORS: Record<string, number> = {
  normal: 0xd5c8ad, fire: 0xff7043, water: 0x4f9fe8, electric: 0xffd643,
  grass: 0x6fc35a, ice: 0x8ddbea, fighting: 0xc65a45, poison: 0x9c63c7,
  ground: 0xc69b5d, flying: 0x91b9e8, psychic: 0xe96899, bug: 0x9caf46,
  rock: 0xa99163, ghost: 0x7568a5, dragon: 0x6758c7, dark: 0x5f5360,
  steel: 0x9caeba, fairy: 0xf39abb,
};

interface BurstPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  drag: number;
}

const BREAK_AT = 2.55;

function smoothstep(a: number, b: number, value: number): number {
  const k = THREE.MathUtils.clamp((value - a) / Math.max(0.0001, b - a), 0, 1);
  return k * k * (3 - 2 * k);
}

/**
 * A real Three.js hatch effect rendered inside the existing game renderer.
 * It is camera-relative, so it stays framed correctly in outdoor maps and GLB
 * interiors without opening another WebGL context on mobile.
 */
export class HatchEffect3D {
  private readonly stage: ThreeStage;
  private readonly root = new THREE.Group();
  private readonly egg = new THREE.Group();
  private readonly cracks = new THREE.Group();
  private readonly child = new THREE.Group();
  private readonly halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly flash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly burst: BurstPiece[] = [];
  private actualModel: THREE.Group | null = null;
  private animator: CreatureAnimator | null = null;
  private time = 0;
  private burstStarted = false;
  private disposed = false;

  constructor(stage: ThreeStage, loaded: LoadedModel, primaryType?: string) {
    this.stage = stage;
    this.root.name = 'egg-hatch-effect-3d';
    this.root.renderOrder = 9000;
    stage.scene.add(this.root);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffae8, roughness: 0.36, metalness: 0.02, clearcoat: 0.42,
      clearcoatRoughness: 0.34,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), shellMat);
    shell.scale.set(0.84, 1.12, 0.84);
    shell.castShadow = true;
    this.egg.add(shell);

    // Raised spots give the Egg an unmistakably volumetric, toy-like surface.
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x67b6e8, roughness: 0.48 });
    const spotLayout: Array<[number, number, number, number]> = [
      [-0.28, 0.34, 0.23, -0.2], [0.31, 0.04, 0.19, 0.4], [-0.16, -0.42, 0.16, 0.1],
    ];
    for (const [x, y, s, r] of spotLayout) {
      const spot = new THREE.Mesh(new THREE.CircleGeometry(s, 20), spotMat);
      spot.position.set(x, y, 0.615 + Math.max(0, 0.09 - Math.abs(x) * 0.08));
      spot.rotation.z = r;
      this.egg.add(spot);
    }

    const crackMat = new THREE.LineBasicMaterial({ color: 0x5f5260, transparent: true, opacity: 0.9 });
    const crackPaths: Array<Array<[number, number]>> = [
      [[0.02, 0.55], [-0.08, 0.36], [0.05, 0.2], [-0.1, 0.02]],
      [[-0.08, 0.36], [-0.3, 0.25], [-0.36, 0.08]],
      [[0.05, 0.2], [0.28, 0.09], [0.35, -0.1]],
      [[-0.1, 0.02], [0.04, -0.18], [-0.05, -0.43]],
    ];
    crackPaths.forEach((path, index) => {
      const points = path.map(([x, y]) => new THREE.Vector3(x, y, 0.69));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), crackMat.clone());
      line.visible = false;
      line.userData.crackIndex = index;
      this.cracks.add(line);
    });
    this.egg.add(this.cracks);
    this.root.add(this.egg);

    const typeColor = TYPE_COLORS[(primaryType ?? '').toLowerCase()] ?? 0x78c8ff;
    this.actualModel = loaded.group;
    this.actualModel.visible = true;
    this.child.add(this.actualModel);
    this.animator = new CreatureAnimator(this.actualModel, loaded.animations);
    this.animator.setBase(0);
    this.animator.setFacing(0);
    this.child.position.y = -0.98;
    this.child.scale.setScalar(0.001);
    this.child.visible = false;
    this.root.add(this.child);

    const haloMat = new THREE.MeshBasicMaterial({
      color: typeColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 48), haloMat);
    this.halo.position.set(0, -0.12, -0.12);
    this.root.add(this.halo);

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), flashMat);
    this.root.add(this.flash);

    this.anchorToCamera();
  }

  private anchorToCamera(): void {
    const camera = this.stage.camera;
    camera.updateMatrixWorld(true);
    // Keep a stable cinematic composition without touching the map camera rig.
    this.root.position.set(0, -0.22, -4.6).applyMatrix4(camera.matrixWorld);
    this.root.quaternion.copy(camera.quaternion);
    this.root.scale.setScalar(1.12);
  }

  private beginBurst(): void {
    if (this.burstStarted) return;
    this.burstStarted = true;
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xfff8df, roughness: 0.4, metalness: 0.02, side: THREE.DoubleSide,
    });
    const sparkleColors = [0xffef93, 0xffffff, 0x8edbff];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.13;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12 + (i % 4) * 0.025), shellMat.clone());
      shard.position.set(Math.cos(a) * 0.16, -0.02 + (i % 5) * 0.09, Math.sin(a) * 0.1);
      this.root.add(shard);
      this.burst.push({
        mesh: shard,
        velocity: new THREE.Vector3(Math.cos(a) * (0.85 + (i % 3) * 0.2), 0.55 + (i % 4) * 0.2, Math.sin(a) * 0.38),
        spin: new THREE.Vector3(2 + i * 0.11, 2.7 + i * 0.08, 3.3 - i * 0.06),
        drag: 0.5,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const sparkleMat = new THREE.MeshBasicMaterial({
        color: sparkleColors[i % sparkleColors.length], transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.055 + (i % 3) * 0.018), sparkleMat);
      sparkle.position.set(0, 0.05, 0.12);
      this.root.add(sparkle);
      this.burst.push({
        mesh: sparkle,
        velocity: new THREE.Vector3(Math.cos(a) * (0.7 + (i % 4) * 0.17), Math.sin(a) * 0.65 + 0.42, 0.15),
        spin: new THREE.Vector3(0, 0, 5.5), drag: 0.76,
      });
    }
  }

  update(dt: number): void {
    if (this.disposed) return;
    dt = Math.min(0.1, Math.max(0, dt));
    this.time += dt;
    this.anchorToCamera();

    if (this.time < BREAK_AT) {
      const strength = smoothstep(0.35, BREAK_AT, this.time);
      const pulse = Math.sin(this.time * (7 + strength * 9));
      this.egg.rotation.z = pulse * (0.035 + strength * 0.13);
      this.egg.position.y = Math.abs(Math.sin(this.time * 5.2)) * 0.035;
      const squash = 1 + Math.sin(this.time * 9) * 0.018 * strength;
      this.egg.scale.set(1 / squash, squash, 1 / squash);
      this.cracks.children.forEach((line, index) => {
        line.visible = this.time > 0.82 + index * 0.34;
      });
    } else {
      this.beginBurst();
      this.egg.visible = false;
      this.child.visible = true;
      const reveal = smoothstep(BREAK_AT, BREAK_AT + 0.72, this.time);
      const overshoot = 1 + Math.sin(reveal * Math.PI) * 0.18;
      this.child.scale.setScalar(Math.max(0.001, reveal * overshoot));
      this.child.position.y = -0.98 + Math.sin((this.time - BREAK_AT) * 2.4) * 0.035 * reveal;
      this.child.rotation.y = Math.sin((this.time - BREAK_AT) * 1.1) * 0.09;
      this.animator?.update(dt, 1.72);

      const burstAge = this.time - BREAK_AT;
      this.flash.material.opacity = Math.max(0, 0.92 - burstAge * 1.3);
      this.flash.scale.setScalar(0.6 + burstAge * 3.4);
      this.halo.material.opacity = Math.max(0.12, 0.74 - burstAge * 0.13);
      this.halo.scale.setScalar(1 + Math.sin(burstAge * 2.6) * 0.08 + Math.min(0.55, burstAge * 0.1));
      this.halo.rotation.z += dt * 0.24;
    }

    for (const p of this.burst) {
      p.velocity.y -= dt * 0.62;
      p.velocity.multiplyScalar(Math.pow(p.drag, dt));
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const mat = p.mesh.material as THREE.Material & { opacity?: number; transparent?: boolean };
      if (this.time > BREAK_AT + 0.9 && typeof mat.opacity === 'number') {
        mat.transparent = true;
        mat.opacity = Math.max(0, 1 - (this.time - BREAK_AT - 0.9) * 0.72);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    // GLB clones mark shared geometry/materials; disposeDeep therefore releases
    // only the temporary Egg, glow and particle resources created here.
    disposeDeep(this.root);
    this.actualModel = null;
    this.animator = null;
    this.burst.length = 0;
  }
}
