import type Phaser from 'phaser';
import * as THREE from 'three';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { PartySystem, type PartyEntry } from '../systems/PartySystem';
import { buildFlatCard, reliefMaterials } from './Extruder';
import { appendFollowerPoint, followerPointBehind, type FollowPoint } from './FollowerPath';
import {
  getModel, hasModel, isBorrowedApiModel, manifestReady, modelBaseYawRad, pinModel, unpinModel,
  type LoadedModel,
} from './GlbModels';
import { makeBlobShadow } from './Props';

interface CompanionVisual {
  model?: THREE.Group;
  relief?: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
  current?: THREE.AnimationAction;
  baseYaw: number;
}

/** How long to wait for the GLB manifest before falling back to artwork. */
const MANIFEST_GRACE_S = 2.5;

/** Follower size for PokeAPI-sourced rigs, relative to the authored scale. */
const API_COMPANION_SCALE = 0.5;

const IDLE_CLIP = /idle|breath|stand|rest|loop/i;
const WALK_CLIP = /walk|run|move|trot|crawl|fly|swim/i;

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te|api|gym|owned)-/, '');
}

/**
 * Key a flat studio background out of artwork that ships without alpha.
 *
 * The custom species' art is JPG — no transparency — so the follower card drew
 * the whole rectangle: a white slab with a blurry creature inside, easily
 * mistaken for a corrupt 3D model. Only images whose BORDER is dominantly
 * near-white are keyed (a photo-style background); anything else, and any
 * canvas we cannot read (cross-origin), is used untouched.
 */
function withoutStudioBackground(
  source: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement | null {
  try {
    const w = (source as HTMLImageElement).naturalWidth || source.width;
    const h = (source as HTMLImageElement).naturalHeight || source.height;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let border = 0, light = 0;
    const probe = (x: number, y: number): void => {
      const i = (y * w + x) * 4;
      border++;
      if (d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 230 && d[i + 3] > 250) light++;
    };
    const step = Math.max(1, w >> 5);
    for (let x = 0; x < w; x += step) { probe(x, 0); probe(x, h - 1); }
    for (let y = 0; y < h; y += step) { probe(0, y); probe(w - 1, y); }
    if (!border || light < border * 0.8) return null;   // not a white-backed card
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) continue;                     // already transparent art
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      // Near-white AND near-grey (low chroma) — the creature's own whites are
      // shaded, so a soft ramp keeps highlights while the flat backdrop drops out.
      if (mn > 224 && mx - mn < 24) d[i + 3] = Math.max(0, Math.min(255, (246 - mn) * 11));
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return null;                                        // tainted canvas — keep the original
  }
}

/** Companion-scale curve. It preserves authored small/large species differences
 * but compresses battle-scale extremes so a Wailord never covers a city street. */
export function companionHeightFor(key: string): number {
  const canonical = canonicalKey(key);
  const authored = battle2DSpriteScale(canonical);
  // Roughly 0.5–1.3 world units: first forms stay near the trainer's ankles,
  // ordinary partners sit around knee/waist height, and giants retain their
  // presence without covering streets, doors, or the player camera.
  const height = Math.max(0.46, Math.min(1.28, 0.68 * authored));
  // Borrowed 3D-API rigs are modelled at true creature proportions rather than
  // to this game's partner scale, so beside the trainer they walk far larger
  // than the authored roster. Halve them for the FOLLOWER only — battle sizing
  // goes through targetH in BattleMirror and is untouched by this.
  return isBorrowedApiModel(canonical) ? height * API_COMPANION_SCALE : height;
}

/** A single scene-local lead Pokémon. Phaser remains authoritative for player
 * movement; this object only reads that position and renders a Three.js friend
 * on the exact breadcrumb path the player already traversed. */
export class OverworldCompanion {
  private readonly scene: Phaser.Scene;
  private readonly root: THREE.Group;
  private readonly holder = new THREE.Group();
  private readonly visualRoot = new THREE.Group();
  private readonly shadow = makeBlobShadow(1);
  private readonly requestMeshPreparation: () => void;
  private readonly baseFollowDistance: number;
  private readonly trail: FollowPoint[] = [];
  private readonly pathTarget: FollowPoint = { x: 0, z: 0 };
  private readonly position = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly lastPlayer = new THREE.Vector3();

  private lead: PartyEntry | null = null;
  private signature = '';
  private visual: CompanionVisual = { baseYaw: 0 };
  private pollClock = 0;
  private requestToken = 0;
  private fallbackRequested = false;
  /** Seconds spent waiting for the local GLB manifest before committing to artwork. */
  private manifestWait = 0;
  private lastDt = 0;
  private pinnedModelKey = '';
  private initialized = false;
  private wasMoving = false;
  private desiredYaw = 0;
  private walkPhase = 0;
  private appear = 0;
  private companionHeight = 0.72;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    root: THREE.Group,
    requestMeshPreparation: () => void,
    interior: boolean,
  ) {
    this.scene = scene;
    this.root = root;
    this.requestMeshPreparation = requestMeshPreparation;
    this.baseFollowDistance = interior ? 0.82 : 1.16;
    this.holder.name = 'lead-pokemon-companion';
    this.visualRoot.name = 'lead-pokemon-visual';
    this.holder.add(this.shadow, this.visualRoot);
    this.holder.visible = false;
    this.root.add(this.holder);
  }

  destroy(): void {
    this.destroyed = true;
    this.requestToken++;
    this.clearVisual();
    this.holder.removeFromParent();
    this.trail.length = 0;
  }

  resetAt(player: THREE.Vector3): void {
    const followDistance = this.currentFollowDistance();
    this.trail.length = 0;
    appendFollowerPoint(this.trail, { x: player.x, z: player.z + followDistance }, 0);
    appendFollowerPoint(this.trail, player, 0);
    this.lastPlayer.copy(player);
    this.position.set(player.x, 0, player.z + followDistance);
    this.previousPosition.copy(this.position);
    this.holder.position.copy(this.position);
    this.initialized = true;
  }

  update(dt: number, player: THREE.Vector3, playerVisible: boolean, surfing: boolean): void {
    this.lastDt = Math.min(0.1, Math.max(0, dt));
    this.pollClock -= dt;
    if (this.pollClock <= 0) {
      this.pollClock = 0.2;
      this.syncLead(player);
    }

    if (!this.lead || !playerVisible) {
      this.holder.visible = false;
      return;
    }

    if (!this.initialized || player.distanceToSquared(this.lastPlayer) > 36) this.resetAt(player);
    appendFollowerPoint(this.trail, player);
    this.lastPlayer.copy(player);
    followerPointBehind(this.trail, this.currentFollowDistance(), this.pathTarget);

    this.previousPosition.copy(this.position);
    const targetX = this.pathTarget.x;
    const targetZ = this.pathTarget.z;
    const targetDistance = Math.hypot(targetX - this.position.x, targetZ - this.position.z);
    if (targetDistance > 5) {
      this.position.set(targetX, 0, targetZ);
    } else {
      const catchUp = targetDistance > 2.2 ? 12 : targetDistance > 1.1 ? 9 : 6.5;
      const blend = 1 - Math.exp(-catchUp * Math.max(0, dt));
      this.position.x += (targetX - this.position.x) * blend;
      this.position.z += (targetZ - this.position.z) * blend;
    }
    this.holder.position.set(this.position.x, 0, this.position.z);

    const dx = this.position.x - this.previousPosition.x;
    const dz = this.position.z - this.previousPosition.z;
    const speed = Math.hypot(dx, dz) / Math.max(0.001, dt);
    // Hysteresis: a single threshold flickered between walk and idle for frames
    // on end while the damped follower crept across it, and every flicker both
    // crossfaded the walk/idle clips and toggled the procedural gait — reading
    // as trembling whenever the player slowed down.
    const moving = speed > (this.wasMoving ? 0.08 : 0.24);
    this.wasMoving = moving;
    // Damped shortest-arc turning. Snapping yaw to the per-frame atan2 of a
    // damped path amplified its numeric noise into visible body shake.
    if (moving && speed > 0.05) this.desiredYaw = Math.atan2(dx, dz) - this.visual.baseYaw;
    const arc = this.desiredYaw - this.holder.rotation.y;
    this.holder.rotation.y += Math.atan2(Math.sin(arc), Math.cos(arc)) * (1 - Math.exp(-9 * dt));

    // Land-bound partners wait in their Ball while the trainer is surfing.
    // Water, Flying and Ghost partners can visibly accompany the mount.
    const types = [this.lead.type1, this.lead.type2].filter(Boolean).map(type => type!.toLowerCase());
    const canTravelOverWater = types.some(type => type === 'water' || type === 'flying' || type === 'ghost');
    this.holder.visible = !surfing || canTravelOverWater;
    if (!this.holder.visible) return;

    this.tryAttachProductionModel();
    const hasVisual = !!(this.visual.model || this.visual.relief);
    this.shadow.visible = hasVisual;
    if (!hasVisual) return;
    this.updateAnimation(dt, moving, types);
  }

  private syncLead(player: THREE.Vector3): void {
    const entry = PartySystem.get(this.scene.registry)[0] ?? null;
    const alive = !!entry && entry.hp > 0;
    const signature = alive ? `${entry!.storageId ?? ''}|${entry!.spriteKey}|${entry!.spriteUrl}` : '';
    if (signature === this.signature) return;
    this.signature = signature;
    this.lead = alive ? { ...entry! } : null;
    this.companionHeight = this.lead ? companionHeightFor(this.lead.spriteKey) : 0.72;
    this.requestToken++;
    this.fallbackRequested = false;
    this.manifestWait = 0;
    this.clearVisual();
    this.appear = 0;
    this.initialized = false;

    if (!this.lead) {
      this.holder.visible = false;
      return;
    }
    this.resetAt(player);
    this.tryAttachProductionModel();
  }

  private tryAttachProductionModel(): void {
    if (!this.lead || this.visual.model) return;
    const key = canonicalKey(this.lead.spriteKey);
    // Every registered model may walk beside the player — including the rough
    // artwork-relief GLBs generated for species without a hand-authored model
    // (those are companionOnly: battles show their 2D sprite instead). The 2D
    // card below remains the fallback when no model exists at all.
    if (!hasModel(key)) {
      // Do not flash an artwork follower while the local manifest is still
      // resolving — but do not wait on it forever either. If the manifest never
      // becomes authoritative (offline, a failed fetch, a cold cache) the old
      // code left the player with NO companion at all, which is worse than a
      // slightly early fallback. Give it a grace period, then commit.
      this.manifestWait += this.lastDt;
      const settled = manifestReady() || this.manifestWait > MANIFEST_GRACE_S;
      if (settled && !this.fallbackRequested && !this.visual.relief) {
        this.fallbackRequested = true;
        if (import.meta.env.DEV) {
          console.info(`[engine3d] follower "${key}" -> 2D artwork (no model registered)`);
        }
        this.loadArtworkCompanion(this.lead, this.requestToken);
      }
      return;
    }
    const loaded = getModel(key);
    if (loaded) this.attachModel(key, loaded);
  }

  private attachModel(key: string, loaded: LoadedModel): void {
    const previousBaseYaw = this.visual.baseYaw;
    // Re-evaluate the height here rather than trusting syncLead's value. syncLead
    // runs the moment the lead changes, which can be BEFORE the manifest has
    // loaded — and the API-scale rule needs the manifest to know a model's
    // source. getModel has just resolved through it, so it is authoritative now.
    if (this.lead) this.companionHeight = companionHeightFor(this.lead.spriteKey);
    this.removeRelief();
    const model = loaded.group;
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const baseHeight = Math.max(0.001, size.y);
    model.scale.multiplyScalar(this.companionHeight / baseHeight);
    model.updateMatrixWorld(true);
    this.visualRoot.add(model);
    pinModel(key);
    this.pinnedModelKey = key;

    const mixer = loaded.animations.length ? new THREE.AnimationMixer(model) : undefined;
    // Never guess that an unnamed first clip is an idle. Several generated
    // creature rigs contain calibration/scale clips whose playback stretches
    // the mesh into an accordion. Static procedural motion is safer when no
    // explicitly named idle exists.
    const idleClip = loaded.animations.find(clip => IDLE_CLIP.test(clip.name));
    const walkClip = loaded.animations.find(clip => WALK_CLIP.test(clip.name));
    const idle = mixer && idleClip ? mixer.clipAction(idleClip) : undefined;
    const walk = mixer && walkClip ? mixer.clipAction(walkClip) : undefined;
    idle?.play();
    const baseYaw = modelBaseYawRad(key);
    this.visual = { model, mixer, idle, walk, current: idle, baseYaw };
    this.shadow.visible = true;
    // The relief may have been facing the correct travel direction while the
    // GLB streamed in. Preserve that world-facing direction even if the player
    // is standing still when the model swap completes.
    this.holder.rotation.y += previousBaseYaw - baseYaw;
    this.desiredYaw += previousBaseYaw - baseYaw;
    this.appear = Math.max(this.appear, 0.35);
    this.requestMeshPreparation();
  }

  /**
   * Build a companion for a species with no authored GLB — which is most of the
   * PokéDex, so this is the path that decides whether "any Pokémon can walk with
   * you" is true.
   */
  private loadArtworkCompanion(entry: PartyEntry, token: number): void {
    const attach = (source: HTMLImageElement | HTMLCanvasElement) => {
      if (this.destroyed || token !== this.requestToken || this.visual.model || this.visual.relief) return;
      const keyed = withoutStudioBackground(source);
      if (keyed) source = keyed;
      const key = `lead:${canonicalKey(entry.spriteKey)}:${entry.spriteUrl}${keyed ? ':keyed' : ''}`;
      // Present the Pokémon's own 2D artwork, unaltered.
      //
      // This used to extrude the sprite into a 3D shell by sampling its alpha
      // silhouette. On hand-drawn original artwork — soft edges, layered wings,
      // shading that the alpha test reads as surface — that produced a lumpy
      // pixel-stepped blob rather than the creature. Generated geometry can never
      // beat the drawing it was derived from, so the rule is now simply: a real
      // GLB if the species has one, otherwise the flat artwork.
      //
      // A card is a billboard, so it is kept facing the camera in applyVisualMotion
      // instead of turning with the direction of travel — otherwise the partner
      // becomes a paper cutout edge-on when it rounds a corner.
      const relief = buildFlatCard(`flat:${key}`, source);
      if (!relief) return;
      const materials = reliefMaterials(relief.texture);
      materials[0].side = THREE.DoubleSide;
      materials[1].side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(relief.geometry, materials);
      mesh.userData.sharedGeo = true;
      mesh.scale.setScalar(this.companionHeight / Math.max(1, relief.pxHeight));
      this.visualRoot.add(mesh);
      this.visual.relief = mesh;
      this.shadow.visible = true;
      this.requestMeshPreparation();
    };

    // Any failure here must stay contained: this runs inside the render loop's
    // update, and an exception would take the whole 3D layer down with it.
    const safely = (source: HTMLImageElement | HTMLCanvasElement) => {
      try { attach(source); } catch (error) {
        console.warn('[engine3d] companion artwork could not be prepared:', error);
      }
    };

    if (this.scene.textures.exists(entry.spriteKey)) {
      const source = this.scene.textures.get(entry.spriteKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (source) { safely(source); return; }
    }
    if (!entry.spriteUrl) return;
    const src = new URL(entry.spriteUrl, document.baseURI).toString();
    // Two attempts, in this order:
    //   1. WITH CORS — the artwork's pixels become readable, so the partner gets
    //      the extruded 3D shell. PokéAPI's sprite host allows this.
    //   2. WITHOUT CORS — for any host that refuses the CORS request. The image
    //      still displays; it simply falls back to the flat card above.
    // Requesting CORS alone would have been a regression: a refusing host fails
    // the load outright and the player would get NO companion at all.
    const load = (useCors: boolean) => {
      const image = new Image();
      if (useCors) image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => safely(image);
      image.onerror = () => { if (useCors) load(false); };
      image.src = src;
    };
    load(true);
  }

  private updateAnimation(dt: number, moving: boolean, types: string[]): void {
    this.walkPhase += dt * (moving ? 8.5 : 2.0);
    this.appear = Math.min(1, this.appear + dt * 3.6);
    const reveal = 1 - Math.pow(1 - this.appear, 3);
    // A rigged clip owns the body: stacking the procedural gait on top of a
    // playing walk/idle animation doubled every bounce, and the constant
    // scale-pulse "breathing" made even standing partners look like they were
    // vibrating. Clip-driven models get no procedural layer at all, and
    // procedural models breathe with a tiny positional bob instead of scaling,
    // with amplitudes proportional to the creature's own height.
    const clipDriven = !!this.visual.current;
    this.visualRoot.scale.setScalar(reveal);

    const hover = types.includes('flying')
      ? THREE.MathUtils.clamp(0.16 + this.companionHeight * 0.13, 0.22, 0.34)
      : types.includes('ghost') ? THREE.MathUtils.clamp(this.companionHeight * 0.14, 0.09, 0.18) : 0;
    const stepBob = clipDriven ? 0
      : moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.companionHeight
      : Math.sin(this.walkPhase * 0.72) * 0.012 * this.companionHeight;
    this.visualRoot.position.y = hover + stepBob;
    this.visualRoot.rotation.z = (clipDriven || !moving) ? 0 : Math.sin(this.walkPhase * 0.5) * 0.018;
    // A flat artwork card has no back, so it must not turn with the direction of
    // travel the way a GLB does. The overworld camera never yaws — it always sits
    // at target + (0, up, back) looking down -Z — so cancelling the holder's yaw
    // holds the card square to the lens from every approach.
    if (this.visual.relief) this.visual.relief.rotation.y = -this.holder.rotation.y;
    const shadowScale = Math.max(0.72, 1 - (hover + Math.max(0, stepBob)) * 0.18);
    const footprint = THREE.MathUtils.clamp(0.34 + this.companionHeight * 0.32, 0.46, 0.76);
    this.shadow.scale.set(footprint * shadowScale, footprint * shadowScale, footprint * shadowScale);

    const desired = moving && this.visual.walk ? this.visual.walk : this.visual.idle;
    if (desired && desired !== this.visual.current) {
      this.visual.current?.fadeOut(0.16);
      desired.reset().fadeIn(0.16).play();
      this.visual.current = desired;
    }
    this.visual.mixer?.update(dt);
  }

  /** Larger partners trail slightly farther back so their body does not overlap
   * the trainer; small Pokémon remain close enough to feel companionable. */
  private currentFollowDistance(): number {
    return this.baseFollowDistance + Math.max(0, this.companionHeight - 0.72) * 0.62;
  }

  private removeRelief(): void {
    const relief = this.visual.relief;
    if (!relief) return;
    relief.removeFromParent();
    const materials = Array.isArray(relief.material) ? relief.material : [relief.material];
    // Geometry and artwork texture live in Extruder's shared cache. Only the
    // per-companion material wrappers belong to this scene.
    materials.forEach(material => material.dispose());
    this.visual.relief = undefined;
  }

  private clearVisual(): void {
    this.visual.mixer?.stopAllAction();
    this.removeRelief();
    this.visual.model?.removeFromParent();
    if (this.pinnedModelKey) {
      unpinModel(this.pinnedModelKey);
      this.pinnedModelKey = '';
    }
    this.visualRoot.clear();
    this.visualRoot.scale.setScalar(1);
    this.visualRoot.position.set(0, 0, 0);
    this.visualRoot.rotation.set(0, 0, 0);
    this.visual = { baseYaw: 0 };
    this.shadow.visible = false;
  }
}
