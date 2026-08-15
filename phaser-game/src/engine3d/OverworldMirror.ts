import Phaser from 'phaser';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { buildBadgeScanner3D, type BadgeScannerModel3D } from './BadgeScanner3D';
import { buildCharacterModel, buildPlayerModel, CharacterProfile, PlayerModel } from './CharacterModel';
import { buildSurfMountModel, type SurfMountModel } from './SurfMountModel';
import { buildFlatCard, buildRelief, reliefMaterials } from './Extruder';
import { drawCommands, hashCommands, measureCommands, rasterizeGraphics } from './GraphicsRaster';
import { generateNabihalmangAppearance, type GeneratedCreatureAnimation } from './GeneratedCreatureAnimation';
import { getModel, hasModel, modelBaseYawRad, primeManifest } from './GlbModels';
import { HatchEffect3D, type HatchEffectProfile3D } from './HatchEffect3D';
import { makeBlobShadow } from './Props';
import { getProp, propFailed, type PropDef } from './PropModels';
import { buildTerrain, PX, TerrainResult } from './TerrainBuilder';
import { disposeDeep, ThreeStage, type EnvProfile } from './ThreeStage';

// ── Overworld mirror ─────────────────────────────────────────────────────────
// Watches a running Phaser scene (which keeps 100% of the game logic) and
// maintains a 3D twin of it: the big map Graphics become the painted terrain,
// every human becomes an animated model, while tagged creatures use only an
// approved local GLB and otherwise retain their authored 2D sprite. Props track
// their 2D counterpart's position, alpha, tint, scale and visibility every frame.
// World-space text becomes floating billboards. UI stays in Phaser on top.

type GO = Phaser.GameObjects.GameObject & {
  x?: number; y?: number; alpha?: number; visible?: boolean;
  scaleX?: number; scaleY?: number; angle?: number; depth?: number;
  scrollFactorX?: number; scrollFactorY?: number;
  width?: number; height?: number; displayWidth?: number; displayHeight?: number;
  flipX?: boolean; tintTopLeft?: number; tintFill?: boolean; isTinted?: boolean;
};

interface Tracked {
  obj: GO;
  mesh: THREE.Object3D;
  /** Raster relief used only for non-creature authored props/Graphics. */
  relief?: THREE.Mesh;
  mats: THREE.MeshBasicMaterial[] | null;
  shadow: THREE.Mesh | null;
  kind: 'graphics' | 'character' | 'image' | 'text' | 'rect' | 'badge-scanner';
  hash: number;
  /** px offset from object origin to art bottom (feet). */
  footY: number;
  halfW: number;
  baseColor: THREE.Color;
  phase: number;
  /** aspect of the last rasterized art (w/h) — wide art = riding pose. */
  aspect: number;
  /** for images: texture signature so runtime setTexture swaps rebuild the mesh */
  texSig?: string;
  /** True low-poly model for an important named character. */
  character?: PlayerModel;
  characterLast?: { x: number; z: number };
  characterPhase?: number;
  /** Optional true-3D creature model for a tagged overworld Image. */
  creatureKey?: string;
  creature?: THREE.Group;
  creatureBaseScale?: number;
  creatureAnimation?: GeneratedCreatureAnimation;
  /** Authored interactive checkpoint that mirrors its Phaser gate state. */
  badgeScanner?: BadgeScannerModel3D;
  fixedWorld?: { x: number; z: number };
}

interface InteriorModel3D {
  id: string;
  url: string;
  /** Target footprint in terrain-local tiles. */
  x: number;
  z: number;
  width: number;
  maxDepth?: number;
  rotation?: number;
  /** Optional authored south/front entrance edge in terrain-local tiles. */
  entranceZ?: number;
  /** The GLB supplies its own floor, walls and fixtures; hide the generated room once loaded. */
  replaceLegacyTerrain?: boolean;
  /** Solid fallback floor kept around a full-room GLB so its open entrance never reveals black. */
  replacementGroundColor?: number;
}

const WORLD_COVER = 0.42;      // graphics covering ≥42% of the world = part of the map painting

/** Natural traversal maps must never grow heuristic city blocks. Their rocks,
 * cliffs and dense foliage can have the same pixel variance as a painted roof. */
function isWildFieldScene(sceneKey: string): boolean {
  return /(?:Route\d*|Road|Pass|Beach|Coast|Valley|Plateau|Highlands|Foothills|Cavern|Cave|Snowfield|Summit|Cliff|Reaches|Ocean|Mine|Gardens|Waterfall)Scene$/.test(sceneKey);
}

/** City scenes that may use the bundled CC0 building pack for otherwise
 * unnamed building footprints. Explicit scene flags still take precedence. */
function isUrbanMapScene(sceneKey: string): boolean {
  return sceneKey === 'SeoulScene' || /(?:City|Town|Plaza|Park)Scene$/.test(sceneKey);
}

export class OverworldMirror {
  readonly scene: Phaser.Scene;
  private stage: ThreeStage;
  private rig: CameraRig;
  private root: THREE.Group;
  private terrain: TerrainResult | null = null;
  private tracked = new Map<GO, Tracked>();
  private groundCanvas: HTMLCanvasElement | null = null;
  private groundTex: THREE.CanvasTexture | null = null;
  private mapGraphics = new Set<GO>();
  private mapImages = new Set<GO>();
  private hiddenFrom2D = new Set<GO>();
  private mapHashes = new Map<GO, number>();
  private mapImgSigs = new Map<GO, number>();
  private static sigCanvas: HTMLCanvasElement | null = null;
  private playerObj: GO | null = null;
  private worldX = 0; private worldY = 0;
  private worldW = 0; private worldH = 0;
  private built = false;
  private time = 0;
  private mapRedrawCooldown = 0;
  private isInterior = false;
  /** set when a map layer arrives after the terrain was built (late-drawn maps) */
  private needsTerrainRebuild = false;
  // Phaser emits addedtoscene before fluent setup (drawing, scale, tags) is
  // complete. Defer new world objects one frame so live quest spawns such as
  // Smeargle are adopted into 3D instead of leaking through as 2D objects.
  private pendingObjects = new Set<GO>();
  private onAdded: (obj: Phaser.GameObjects.GameObject) => void;
  // Full 3D protagonist (replaces the player's flat relief with an animated model).
  private hero: PlayerModel | null = null;
  private surfMount: SurfMountModel | null = null;
  private heroWalkPhase = 0;
  private heroLast: { x: number; z: number } | null = null;
  private hatchEffect: HatchEffect3D | null = null;
  private pendingInteriorModel: {
    holder: THREE.Group;
    def: PropDef;
    spec: InteriorModel3D;
    wait: number;
  } | null = null;
  private readonly playerPosition = new THREE.Vector3();
  private readonly localPlayerPosition = new THREE.Vector3();

  constructor(scene: Phaser.Scene, stage: ThreeStage, rig: CameraRig) {
    this.scene = scene;
    this.stage = stage;
    this.rig = rig;
    this.root = stage.resetWorld();
    primeManifest();
    this.onAdded = (obj) => { if (this.built) this.pendingObjects.add(obj as GO); };
    scene.events.on('addedtoscene', this.onAdded);
  }

  destroy(): void {
    this.scene.events.off('addedtoscene', this.onAdded);
    this.stopHatchEffect();
    for (const t of this.tracked.values()) t.creatureAnimation?.dispose();
    this.tracked.clear();
    this.mapGraphics.clear();
    this.mapImages.clear();
    this.hiddenFrom2D.clear();
    this.pendingObjects.clear();
    this.pendingInteriorModel = null;
    if (this.surfMount) {
      this.surfMount.group.removeFromParent();
      disposeDeep(this.surfMount.group);
      this.surfMount = null;
    }
  }

  /** The player object: the camera-follow target, or the scene's `playerG` field
   *  (interior scenes keep a static camera but still expose the player there). */
  static findPlayer(scene: Phaser.Scene): GO | null {
    const cam = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { _follow?: GO }) | undefined;
    if (cam?._follow) return cam._follow;
    const pg = (scene as unknown as { playerG?: unknown }).playerG;
    if (pg && pg instanceof Phaser.GameObjects.Graphics) return pg as unknown as GO;
    return null;
  }

  /** True once the scene has a detectable player and we could build. */
  tryBuild(): boolean {
    if (this.built) return true;
    const cam = this.scene.cameras?.main as Phaser.Cameras.Scene2D.Camera & { _follow?: GO };
    if (!cam) return false;
    this.playerObj = OverworldMirror.findPlayer(this.scene);
    if (!this.playerObj) return false;

    const b = cam.getBounds();
    let hadBounds = false;
    if (b.width > 0 && b.height > 0) {
      hadBounds = true;
      this.worldX = b.x; this.worldY = b.y;
      this.worldW = b.width; this.worldH = b.height;
    } else {
      // No camera bounds (static-camera interiors): size the world to the room
      // itself — the union of all sizeable drawings — so the decal threshold
      // and the diorama framing match the actual content, not the screen.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of this.scene.children.list) {
        const o = obj as GO;
        if (o.scrollFactorX === 0 && o.scrollFactorY === 0) continue;
        let bx0: number | null = null, by0 = 0, bx1 = 0, by1 = 0;
        if (o instanceof Phaser.GameObjects.Graphics) {
          const buf = (o as unknown as { commandBuffer: unknown[] }).commandBuffer;
          const m = buf?.length ? measureCommands(buf) : null;
          if (m && (m.maxX - m.minX) * (m.maxY - m.minY) >= 40000) {
            bx0 = (o.x ?? 0) + m.minX; by0 = (o.y ?? 0) + m.minY;
            bx1 = (o.x ?? 0) + m.maxX; by1 = (o.y ?? 0) + m.maxY;
          }
        } else if (o instanceof Phaser.GameObjects.Image || o instanceof Phaser.GameObjects.Sprite) {
          const dw = o.displayWidth ?? 0, dh = o.displayHeight ?? 0;
          if (dw * dh >= 40000) {
            bx0 = (o.x ?? 0) - o.displayOriginX * (o.scaleX ?? 1);
            by0 = (o.y ?? 0) - o.displayOriginY * (o.scaleY ?? 1);
            bx1 = bx0 + dw; by1 = by0 + dh;
          }
        }
        if (bx0 !== null) {
          if (bx0 < minX) minX = bx0; if (by0 < minY) minY = by0;
          if (bx1 > maxX) maxX = bx1; if (by1 > maxY) maxY = by1;
        }
      }
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = this.scene.scale.width; maxY = this.scene.scale.height; }
      const pad = 32;
      this.worldX = minX - pad; this.worldY = minY - pad;
      this.worldW = (maxX - minX) + pad * 2; this.worldH = (maxY - minY) + pad * 2;
    }

    // Composite all "map painting" graphics into one ground canvas.
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = Math.min(4096, this.worldW);
    this.groundCanvas.height = Math.min(4096, this.worldH);
    this.redrawGround();

    // Interior = a static-camera room (no scroll bounds). Size alone is NOT a
    // signal: small towns (e.g. 32×24-tile villages) are outdoors and need sky,
    // buildings and daylight — only true rooms skip those.
    // A scene can force interior treatment (indoor lighting, no outdoor props
    // like trees/grass) even if it keeps camera bounds — e.g. a small shrine
    // room whose dark floor would otherwise sprout a forest.
    const forceInterior = !!(this.scene as unknown as { interior3D?: boolean }).interior3D;
    this.isInterior = forceInterior || (!hadBounds && (this.worldW <= 1500 && this.worldH <= 1000));
    const t = this.buildTerrainPass();
    const isInterior = this.isInterior;
    const envOverride = (this.scene as unknown as { environmentProfile3D?: EnvProfile }).environmentProfile3D;
    this.stage.setEnvironment(envOverride ?? (isInterior && t.env !== 'cave' ? 'interior' : t.env));
    const backgroundColor3D = (this.scene as unknown as { backgroundColor3D?: unknown }).backgroundColor3D;
    if (typeof backgroundColor3D === 'number') this.stage.setBackgroundColor(backgroundColor3D);
    this.rig.setMode(isInterior ? 'interior' : 'overworld');
    this.rig.setWorldBounds(
      this.worldX / PX, this.worldY / PX,
      this.worldX / PX + t.cols, this.worldY / PX + t.rows,
    );

    // Adopt every current world object.
    for (const obj of this.scene.children.list) this.adopt(obj as GO);
    this.built = true;
    return true;
  }

  /** Most map scenes keep their tile grid on `scene.map` (rows × cols of tile
   *  ids). Reading it lets the terrain builder identify buildings exactly
   *  instead of guessing from painted pixels. Read-only — never modified. */
  private readTileMap(): number[][] | null {
    const m = (this.scene as unknown as { map?: unknown }).map;
    if (!Array.isArray(m) || m.length === 0) return null;
    const rows = m.length;
    const first = m[0];
    if (!Array.isArray(first) || first.length === 0) return null;
    if (typeof first[0] !== 'number') return null;
    const cols = first.length;
    const expectRows = Math.round(this.worldH / PX), expectCols = Math.round(this.worldW / PX);
    if (Math.abs(rows - expectRows) > 1 || Math.abs(cols - expectCols) > 1) return null;
    return m as number[][];
  }

  /** Build (or rebuild) the 3D terrain from the current ground canvas. */
  private buildTerrainPass(): TerrainResult {
    // Scenes with an authoritative building table (gyms, landmarks) publish it
    // as `buildingPlots` — those become 3D volumes without any detection.
    const sc = this.scene as unknown as {
      buildingPlots?: { x: number; y: number; w: number; h: number; model?: string }[];
      onlyNamedBuildings?: boolean;
      vehiclePlots?: { x: number; y: number; model: string; rot?: number }[];
      caveFloorHint?: boolean;
      noVehicles?: boolean;
      freeBuildings?: boolean;
      propPlots?: import('./TerrainBuilder').PropPlot[];
      clearSight3D?: boolean;
      grass3D?: boolean;
      grassTileIds3D?: number[];
      grassDensity3D?: number;
      grassTone3D?: number;
      flatTileIds3D?: number[];
      interiorTerrain3D?: boolean;
      flatTerrain3D?: boolean;
      treeTileIds3D?: number[];
      mountainTileIds3D?: number[];
      cityTiles3D?: import('./CityDetail3D').CityTileSpec;
      noRocks3D?: boolean;
      sacredPeakNature3D?: boolean;
      preservePaintedGround3D?: boolean;
      crowdPlots?: import('./AmbientCrowd').CrowdPlot[];
      waterStyle3D?: 'default' | 'alpine';
    };
    const known = sc.buildingPlots ?? [];
    const useFreeCityBuildings = sc.freeBuildings ?? (
      !this.isInterior && !sc.onlyNamedBuildings && isUrbanMapScene(this.scene.scene.key)
    );
    // interiorTerrain3D: give a scene interior-style TERRAIN (low visible walls, no
    // outdoor foliage/water) while keeping the outdoor follow-camera + daylight — used
    // by tall stylized scenes like the ice cave that must scroll but shouldn't grow
    // trees, tall black walls or transparent water planes.
    const interiorTerrain = this.isInterior || (sc.interiorTerrain3D ?? false);
    const t = buildTerrain(
      this.groundCanvas!, this.worldW, this.worldH, interiorTerrain,
      this.readTileMap(), known, this.scene.scene.key,
      sc.onlyNamedBuildings ?? isWildFieldScene(this.scene.scene.key), sc.vehiclePlots ?? [],
      sc.caveFloorHint ?? false, sc.noVehicles ?? false, useFreeCityBuildings,
      sc.propPlots ?? [], sc.clearSight3D ?? false, sc.grass3D ?? false,
      sc.grassTileIds3D ?? [], sc.grassDensity3D ?? 1.45, sc.grassTone3D ?? 0x49b23a,
      sc.flatTileIds3D ?? [],
      sc.flatTerrain3D ?? false,
      sc.treeTileIds3D ?? [],
      sc.mountainTileIds3D ?? [],
      sc.cityTiles3D ?? null,
      sc.noRocks3D ?? false,
      sc.sacredPeakNature3D ?? false,
      sc.preservePaintedGround3D ?? false,
      sc.crowdPlots ?? [],
      sc.waterStyle3D ?? 'default',
    );
    this.terrain = t;
    this.groundTex = ((t.group.children[0] as THREE.Mesh).material as THREE.MeshToonMaterial).map as THREE.CanvasTexture;
    t.group.position.set(this.worldX / PX, 0, this.worldY / PX);   // world-space origin
    this.root.add(t.group);
    this.queueInteriorModel(t);
    return t;
  }

  /** Queue a scene-authored room GLB while Phaser remains authoritative for
   * movement, collisions, NPCs, healing, shopping and exits. */
  private queueInteriorModel(terrain: TerrainResult): void {
    this.pendingInteriorModel = null;
    const spec = (this.scene as unknown as { interiorModel3D?: InteriorModel3D }).interiorModel3D;
    if (!spec) return;
    const holder = new THREE.Group();
    holder.name = `interior:${spec.id}`;
    terrain.group.add(holder);
    this.pendingInteriorModel = {
      holder,
      spec,
      def: { id: spec.id, role: 'scenery', url: spec.url },
      wait: 0,
    };
  }

  private updateInteriorModel(dt: number): void {
    const pending = this.pendingInteriorModel;
    if (!pending) return;
    const model = getProp(pending.def);
    if (!model) {
      pending.wait += dt;
      if (propFailed(pending.def) || pending.wait > 8) {
        pending.holder.removeFromParent();
        this.pendingInteriorModel = null;
      }
      return;
    }

    model.rotation.y = pending.spec.rotation ?? 0;
    model.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    initial.getSize(size);
    const fitWidth = pending.spec.width / Math.max(0.001, size.x);
    const fitDepth = pending.spec.maxDepth === undefined
      ? Infinity
      : pending.spec.maxDepth / Math.max(0.001, size.z);
    model.scale.multiplyScalar(Math.min(fitWidth, fitDepth));
    model.updateMatrixWorld(true);

    // Centre on the authored room width. Complete room models can align their
    // open front edge directly to the gameplay doorway; other decorative room
    // shells retain the original north-wall alignment.
    const fitted = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    model.position.x += pending.spec.x + pending.spec.width / 2 - center.x;
    model.position.z += pending.spec.entranceZ === undefined
      ? pending.spec.z - fitted.min.z
      : pending.spec.entranceZ - fitted.max.z;
    model.position.y += 0.035 - fitted.min.y; // avoid floor z-fighting
    pending.holder.add(model);
    this.stage.requestMeshPreparation();

    // Full authored interiors must not sit on top of the legacy room decal,
    // diorama skirt, inferred water or generated wall meshes. Keep those pieces
    // visible only as a loading/failure fallback, then remove them atomically
    // once the GLB is ready so the player sees one entrance and one room.
    if (pending.spec.replaceLegacyTerrain) {
      const terrainGroup = pending.holder.parent;
      terrainGroup?.children.forEach(child => {
        if (child === pending.holder) return;
        const keepSolidBase = pending.spec.replacementGroundColor !== undefined
          && (child.name === 'generated-terrain-ground' || child.name === 'generated-terrain-skirt');
        child.visible = keepSolidBase;
        if (!keepSolidBase) return;

        // Strip the old room decal / soil texture while retaining a plain slab
        // beneath and immediately outside the GLB's open doorway. This fills the
        // camera footprint without reintroducing the duplicated 3D interior.
        child.traverse(obj => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.material) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of mats) {
            const mat = material as THREE.MeshLambertMaterial;
            if (!mat.color) continue;
            mat.map = null;
            if ('emissiveMap' in mat) mat.emissiveMap = null;
            mat.color.set(pending.spec.replacementGroundColor!);
            if (mat.emissive) {
              mat.emissive.set(pending.spec.replacementGroundColor!).multiplyScalar(0.12);
              mat.emissiveIntensity = 0.2;
            }
            mat.needsUpdate = true;
          }
        });
      });
    }
    this.pendingInteriorModel = null;
  }

  /** Some scenes paint their map a beat late (cutscene fades, delayed draws).
   *  When a world-covering layer arrives after the terrain was built, rebuild
   *  it — environment, buildings and props were computed from a blank canvas. */
  private rebuildTerrain(): void {
    if (!this.groundCanvas || !this.terrain) return;
    this.root.remove(this.terrain.group);
    disposeDeep(this.terrain.group);
    const t = this.buildTerrainPass();
    this.stage.setEnvironment(this.isInterior && t.env !== 'cave' ? 'interior' : t.env);
    const backgroundColor3D = (this.scene as unknown as { backgroundColor3D?: unknown }).backgroundColor3D;
    if (typeof backgroundColor3D === 'number') this.stage.setBackgroundColor(backgroundColor3D);
  }

  /** Cheap content signature of a map image's texture (8×8 downsample sum) —
   *  scenes sometimes repaint their baked map after we composited it. */
  private imageSig(im: Phaser.GameObjects.Image): number {
    try {
      if (!OverworldMirror.sigCanvas) {
        OverworldMirror.sigCanvas = document.createElement('canvas');
        OverworldMirror.sigCanvas.width = OverworldMirror.sigCanvas.height = 8;
      }
      const c = OverworldMirror.sigCanvas;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 8, 8);
      ctx.drawImage(im.texture.getSourceImage() as CanvasImageSource, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] + d[i + 2]) | 0;
      return h;
    } catch { return 0; }
  }

  // ── Ground painting ──
  private isMapPainting(obj: GO): boolean {
    if (!(obj instanceof Phaser.GameObjects.Graphics)) return false;
    const buf = (obj as unknown as { commandBuffer: unknown[] }).commandBuffer;
    if (!buf || !buf.length) return false;
    const m = measureCommands(buf);
    if (!m) return false;
    const w = m.maxX - m.minX, h = m.maxY - m.minY;
    return (w * h) >= (this.worldW * this.worldH * WORLD_COVER);
  }

  /** Most scenes bake their tile map into a texture and show it as one big
   *  Image (75 of 113 scenes) — treat any world-covering image as the ground. */
  private isMapImage(obj: GO): boolean {
    if (!(obj instanceof Phaser.GameObjects.Image) && !(obj instanceof Phaser.GameObjects.Sprite)) return false;
    if ((obj as unknown as { getData?: (key: string) => unknown }).getData?.('terrainDecal3D') === true) {
      return true;
    }
    const dw = obj.displayWidth ?? 0, dh = obj.displayHeight ?? 0;
    return (dw * dh) >= (this.worldW * this.worldH * WORLD_COVER);
  }

  private redrawGround(): void {
    if (!this.groundCanvas) return;
    const ctx = this.groundCanvas.getContext('2d')!;
    const sx = this.groundCanvas.width / this.worldW, sy = this.groundCanvas.height / this.worldH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);
    // Fill base with a neutral tone in case maps leave gaps.
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);

    const layers: { obj: GO; depth: number; kind: 'g' | 'i' }[] = [];
    for (const obj of this.scene.children.list) {
      const g = obj as GO;
      if (this.mapGraphics.has(g) || this.isMapPainting(g)) {
        this.mapGraphics.add(g);
        layers.push({ obj: g, depth: g.depth ?? 0, kind: 'g' });
      } else if (this.mapImages.has(g) || this.isMapImage(g)) {
        this.mapImages.add(g);
        layers.push({ obj: g, depth: g.depth ?? 0, kind: 'i' });
      }
    }
    layers.sort((a, b) => a.depth - b.depth);
    for (const { obj, kind } of layers) {
      if (obj.visible === false) continue;
      ctx.globalAlpha = obj.alpha ?? 1;
      if (kind === 'g') {
        const g = obj as unknown as Phaser.GameObjects.Graphics & { commandBuffer: unknown[] };
        ctx.setTransform(sx, 0, 0, sy, ((g.x ?? 0) - this.worldX) * sx, ((g.y ?? 0) - this.worldY) * sy);
        drawCommands(ctx, g.commandBuffer);
        this.mapHashes.set(obj, hashCommands(g.commandBuffer));
      } else {
        const im = obj as unknown as Phaser.GameObjects.Image;
        try {
          const src = im.texture.getSourceImage() as CanvasImageSource;
          const x0 = (im.x ?? 0) - im.displayOriginX * (im.scaleX ?? 1) - this.worldX;
          const y0 = (im.y ?? 0) - im.displayOriginY * (im.scaleY ?? 1) - this.worldY;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(src, x0 * sx, y0 * sy, im.displayWidth * sx, im.displayHeight * sy);
        } catch { /* unreadable source — skip */ }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (this.groundTex) this.groundTex.needsUpdate = true;
  }

  // ── Object adoption ──
  private adopt(obj: GO): void {
    if (this.tracked.has(obj)) return;
    if ((obj.scrollFactorX === 0 && obj.scrollFactorY === 0)) return;      // UI stays 2D
    if (!('x' in obj) || obj.x === undefined) return;
    // Scenes can tag a decorative overlay (e.g. atmospheric mist) no3d so the 3D
    // mirror never lifts it into a stray standing structure — it's simply hidden
    // in 3D (and still drawn in pure-2D mode).
    if ((obj as unknown as { getData?: (k: string) => unknown }).getData?.('no3d')) { this.hideFrom2D(obj); return; }

    if (obj instanceof Phaser.GameObjects.Graphics) {
      const scanner = obj.getData?.('badgeScanner3D') as { x?: number; y?: number } | undefined;
      if (typeof scanner?.x === 'number' && typeof scanner.y === 'number') {
        this.adoptBadgeScanner(obj as GO & Phaser.GameObjects.Graphics, scanner.x, scanner.y);
        return;
      }
      if (this.mapGraphics.has(obj) || this.isMapPainting(obj)) {
        if (!this.mapGraphics.has(obj)) {
          this.mapGraphics.add(obj);
          this.redrawGround();
          if (this.built) this.needsTerrainRebuild = true;
        }
        this.hideFrom2D(obj);
        return;
      }
      // Towns that place their buildings as 3D GLBs (buildingPlots) still draw
      // the flat 2D building shapes as a low-depth graphics layer. Don't mirror
      // that as its own relief — it would stand as a duplicate flat building
      // beside each real model; hide it and let the GLB represent the building.
      if (this.hasBuildingPlots() && ((obj.depth ?? 0) <= 3)) { this.hideFrom2D(obj); return; }
      this.adoptGraphics(obj as GO & Phaser.GameObjects.Graphics);
      return;
    }
    if (obj instanceof Phaser.GameObjects.Image || obj instanceof Phaser.GameObjects.Sprite) {
      if (this.mapImages.has(obj) || this.isMapImage(obj)) {
        if (!this.mapImages.has(obj)) {
          this.mapImages.add(obj);
          this.redrawGround();
          if (this.built) this.needsTerrainRebuild = true;
        }
        this.hideFrom2D(obj);
        return;
      }
      this.adoptImage(obj as GO & Phaser.GameObjects.Image);
      return;
    }
    if (obj instanceof Phaser.GameObjects.Text) {
      // The room GLB already contains its signage and fixtures. Keep NPC labels
      // and UI, but suppress low-depth procedural room labels in 3D mode.
      if (this.hasInteriorModel3D() && (obj.depth ?? 0) <= 10) {
        this.hideFrom2D(obj);
        return;
      }
      this.adoptText(obj as GO & Phaser.GameObjects.Text);
      return;
    }
    if (obj instanceof Phaser.GameObjects.Rectangle) {
      this.adoptRect(obj as GO & Phaser.GameObjects.Rectangle);
      return;
    }
    // Other types (particles, containers, shapes) stay 2D — harmless overlays.
  }

  private hasBuildingPlots(): boolean {
    const sc = this.scene as unknown as {
      buildingPlots?: unknown[];
      onlyNamedBuildings?: boolean;
      freeBuildings?: boolean;
    };
    const useFreeCityBuildings = sc.freeBuildings ?? (
      !this.isInterior && !sc.onlyNamedBuildings && isUrbanMapScene(this.scene.scene.key)
    );
    return (Array.isArray(sc.buildingPlots) && sc.buildingPlots.length > 0) || useFreeCityBuildings;
  }

  private hasInteriorModel3D(): boolean {
    return !!(this.scene as unknown as { interiorModel3D?: InteriorModel3D }).interiorModel3D;
  }

  private hideFrom2D(obj: GO): void {
    this.hiddenFrom2D.add(obj);
    const cam = this.scene.cameras.main;
    cam.ignore(obj as Phaser.GameObjects.GameObject);
  }

  private show2D(obj: GO): void {
    const cam = this.scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { id: number };
    const o = obj as unknown as { cameraFilter: number };
    o.cameraFilter &= ~cam.id;
  }

  private adoptGraphics(g: GO & Phaser.GameObjects.Graphics): void {
    const buf = (g as unknown as { commandBuffer: unknown[] }).commandBuffer;
    if (!buf || buf.length === 0) return;
    const hash = hashCommands(buf);
    const ras = rasterizeGraphics(g, 3);
    if (!ras) return;
    const relief = buildRelief(`gfx:${this.scene.scene.key}:${hash}`, ras.canvas, Math.max(4, ras.width * 0.14) * ras.scale);
    if (!relief) return;

    const mats = reliefMaterials(relief.texture);
    const mesh = new THREE.Mesh(relief.geometry, mats);
    mesh.userData.sharedGeo = true;
    const s = 1 / (PX * ras.scale);
    mesh.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(mesh);
    // Foot line: bottom of drawing in local px (maxY = minY + height).
    const footY = ras.minY + ras.height;
    const halfW = (ras.width / 2) / PX;
    const shadow = makeBlobShadow(Math.min(0.65, halfW * 0.9));
    holder.add(shadow);
    this.root.add(holder);
    const tracked: Tracked = {
      obj: g, mesh: holder, mats, shadow, kind: 'graphics', hash,
      relief: mesh,
      footY, halfW, baseColor: new THREE.Color(0xffffff), phase: Math.random() * Math.PI * 2,
      aspect: ras.width / Math.max(1, ras.height),
    };
    this.tracked.set(g, tracked);
    this.hideFrom2D(g);

    // Every authored human becomes a genuine rotatable humanoid. Shared drawing
    // helpers tag their exact palette; older hand-drawn NPCs are detected from
    // their compact body proportions and skin-tone face, then receive a profile
    // derived from the raster itself. The player is handled by updateHero().
    let modelKey = g.getData?.('characterModel3DKey') as string | undefined;
    let profile = modelKey?.startsWith('generated_')
      ? g.getData?.('characterProfile3D') as Partial<CharacterProfile> | undefined
      : undefined;
    if (!modelKey && g !== this.playerObj) {
      profile = this.inferCharacterProfile(ras.canvas, ras.width, ras.height);
      if (profile) modelKey = 'generated_boy';
    }
    if (modelKey && g !== this.playerObj) {
      const taggedGender = g.getData?.('characterGender3D') as ('boy' | 'girl' | undefined);
      const fallback = taggedGender ?? (modelKey.includes('girl') ? 'girl' : 'boy');
      tracked.character = buildCharacterModel(modelKey, fallback, profile);
      tracked.characterPhase = Math.random() * Math.PI * 2;
      tracked.kind = 'character';
      const foot = Number(g.getData?.('characterFootY3D'));
      if (Number.isFinite(foot)) tracked.footY = foot;
      mesh.visible = false;
      holder.add(tracked.character.group);
    }
  }

  /** Replace the flat checkpoint drawing with a stateful, fully volumetric gate. */
  private adoptBadgeScanner(g: GO & Phaser.GameObjects.Graphics, px: number, py: number): void {
    const badgeScanner = buildBadgeScanner3D();
    this.root.add(badgeScanner.group);
    this.tracked.set(g, {
      obj: g,
      mesh: badgeScanner.group,
      mats: null,
      shadow: null,
      kind: 'badge-scanner',
      hash: 0,
      footY: 0,
      halfW: 2.3,
      baseColor: new THREE.Color(0xffffff),
      phase: 0,
      aspect: 1,
      badgeScanner,
      fixedWorld: { x: px / PX, z: py / PX },
    });
    this.hideFrom2D(g);
  }

  /** Infer a safe procedural palette for legacy hand-drawn human Graphics. */
  private inferCharacterProfile(
    canvas: HTMLCanvasElement,
    localW: number,
    localH: number,
  ): Partial<CharacterProfile> | undefined {
    const aspect = localW / Math.max(1, localH);
    if (localW < 12 || localW > 54 || localH < 28 || localH > 72 || aspect < 0.25 || aspect > 1.25) return;
    let pixels: Uint8ClampedArray;
    try { pixels = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data; }
    catch { return; }

    const quantized = new Map<number, number>();
    let opaque = 0, skin = 0;
    const y0 = Math.floor(canvas.height * 0.34);
    const y1 = Math.floor(canvas.height * 0.78);
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        if (pixels[i + 3] < 80) continue;
        opaque++;
        const r = pixels[i], gg = pixels[i + 1], b = pixels[i + 2];
        const skinLike = r >= 178 && gg >= 105 && gg <= 225 && b >= 65 && b <= 205 && r >= gg && gg >= b * 0.82;
        if (skinLike) skin++;
        if (y >= y0 && y <= y1 && !skinLike && r + gg + b > 85 && r + gg + b < 690) {
          const q = ((r >> 4) << 16) | ((gg >> 4) << 8) | (b >> 4);
          quantized.set(q, (quantized.get(q) ?? 0) + 1);
        }
      }
    }
    // Human sprites consistently expose a face/hands; this rejects signs,
    // stones, flowers and other compact decorative Graphics.
    if (opaque < 30 || skin / opaque < 0.045) return;

    let best = 0x343741, bestCount = -1;
    for (const [q, count] of quantized) {
      if (count > bestCount) {
        bestCount = count;
        best = ((((q >> 16) & 0xf) * 17) << 16) | ((((q >> 8) & 0xf) * 17) << 8) | ((q & 0xf) * 17);
      }
    }
    const shift = (color: number, amount: number) => {
      const c = (bits: number) => Phaser.Math.Clamp(((color >> bits) & 0xff) + amount, 0, 255);
      return (c(16) << 16) | (c(8) << 8) | c(0);
    };
    return {
      hair: 0x251c18,
      outfit: best,
      secondary: shift(best, 45),
      accent: shift(best, 82),
      trousers: shift(best, -38),
      shoes: 0x191a1e,
      outfitStyle: localH > 48 ? 'coat' : 'trainer',
      hairStyle: 'short',
    };
  }

  private refreshGraphics(t: Tracked): void {
    const g = t.obj as GO & Phaser.GameObjects.Graphics;
    const buf = (g as unknown as { commandBuffer: unknown[] }).commandBuffer;
    const hash = hashCommands(buf);
    if (hash === t.hash) return;
    t.hash = hash;
    const ras = rasterizeGraphics(g, 3);
    if (!ras) return;
    const relief = buildRelief(`gfx:${this.scene.scene.key}:${hash}`, ras.canvas, Math.max(4, ras.width * 0.14) * ras.scale);
    if (!relief) return;
    const inner = t.relief;
    if (!inner) return;
    inner.geometry = relief.geometry;
    if (t.mats) { t.mats[0].map = relief.texture; t.mats[0].needsUpdate = true; }
    t.footY = ras.minY + ras.height;
    t.aspect = ras.width / Math.max(1, ras.height);
  }

  private adoptImage(im: GO & Phaser.GameObjects.Image): void {
    const creatureKey = im.getData?.('creatureModel3DKey') as string | undefined;
    // Pokémon and other tagged creatures never receive a generated extrusion.
    // Their authored Phaser sprite stays visible until a production GLB is
    // completely loaded and validated.
    if (creatureKey) {
      const holder = new THREE.Group();
      const halfW = Math.max(0.18, (im.displayWidth ?? im.width ?? 32) / (PX * 2));
      const shadow = makeBlobShadow(Math.min(1.2, halfW * 0.85));
      shadow.visible = false;
      holder.add(shadow);
      holder.visible = false;
      this.root.add(holder);
      this.tracked.set(im, {
        obj: im, mesh: holder, mats: null, shadow, kind: 'image', hash: 0,
        footY: (im.displayOriginY ?? (im.height ?? 0) / 2),
        halfW, baseColor: new THREE.Color(0xffffff), phase: Math.random() * Math.PI * 2,
        aspect: (im.displayWidth ?? im.width ?? 1) / Math.max(1, im.displayHeight ?? im.height ?? 1),
        texSig: `${im.texture.key}:${im.frame?.name ?? 0}`,
        creatureKey,
        creatureBaseScale: Math.max(0.0001, Math.abs(im.scaleX ?? 1)),
      });
      this.show2D(im);
      return;
    }

    const src = this.frameCanvas(im);
    const key = `img:${im.texture.key}:${im.frame?.name ?? 0}`;
    const relief = (src && buildRelief(key, src)) ?? buildFlatCard(
      `flat:${key}`,
      im.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement,
    );
    if (!relief) return;
    const mats = reliefMaterials(relief.texture);
    const mesh = new THREE.Mesh(relief.geometry, mats);
    mesh.userData.sharedGeo = true;
    const s = 1 / PX;
    mesh.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(mesh);
    const halfW = (relief.pxWidth / 2) / PX;
    const shadow = makeBlobShadow(Math.min(1.2, halfW * 0.85));
    holder.add(shadow);
    this.root.add(holder);
    // Image origin is its center by default; feet = origin + displayHeight/2.
    const footY = (im.displayOriginY ?? (im.height ?? 0) / 2);
    this.tracked.set(im, {
      obj: im, mesh: holder, mats, shadow, kind: 'image', hash: 0,
      relief: mesh,
      footY, halfW, baseColor: new THREE.Color(0xffffff), phase: Math.random() * Math.PI * 2,
      aspect: relief.pxWidth / Math.max(1, relief.pxHeight),
      texSig: `${im.texture.key}:${im.frame?.name ?? 0}`,
    });
    this.hideFrom2D(im);
  }

  /** Rebuild an image's relief when the game swaps its texture at runtime. */
  private refreshImage(t: Tracked, im: GO & Phaser.GameObjects.Image): void {
    if (t.creatureKey) {
      t.footY = (im.displayOriginY ?? (im.height ?? 0) / 2);
      t.halfW = Math.max(0.18, (im.displayWidth ?? im.width ?? 32) / (PX * 2));
      t.aspect = (im.displayWidth ?? im.width ?? 1) / Math.max(1, im.displayHeight ?? im.height ?? 1);
      return;
    }
    const src = this.frameCanvas(im);
    const key = `img:${im.texture.key}:${im.frame?.name ?? 0}`;
    const relief = (src && buildRelief(key, src)) ?? buildFlatCard(
      `flat:${key}`,
      im.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement,
    );
    if (!relief) return;
    const inner = t.relief;
    if (!inner) return;
    inner.geometry = relief.geometry;
    if (t.mats) { t.mats[0].map = relief.texture; t.mats[0].needsUpdate = true; }
    t.footY = (im.displayOriginY ?? (im.height ?? 0) / 2);
    t.halfW = (relief.pxWidth / 2) / PX;
    t.aspect = relief.pxWidth / Math.max(1, relief.pxHeight);
  }

  private frameCanvas(im: Phaser.GameObjects.Image): HTMLCanvasElement | null {
    try {
      const frame = im.frame;
      const srcImg = im.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (!srcImg || !frame) return null;
      const c = document.createElement('canvas');
      c.width = frame.cutWidth || srcImg.width;
      c.height = frame.cutHeight || srcImg.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(srcImg as CanvasImageSource, frame.cutX, frame.cutY, c.width, c.height, 0, 0, c.width, c.height);
      return c;
    } catch { return null; }
  }

  private adoptText(txt: GO & Phaser.GameObjects.Text): void {
    const c = this.textCanvas(txt);
    if (!c) return;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(c.width / PX / 2, c.height / PX / 2), mat);
    plane.renderOrder = 5;
    const holder = new THREE.Group();
    holder.add(plane);
    this.root.add(holder);
    this.tracked.set(txt, {
      obj: txt, mesh: holder, mats: null, shadow: null, kind: 'text', hash: 0,
      footY: 0, halfW: 0, baseColor: new THREE.Color(0xffffff), phase: 0, aspect: 1,
    });
    (holder as unknown as { __plane: THREE.Mesh }).__plane = plane;
    this.hideFrom2D(txt);
  }

  private textCanvas(txt: Phaser.GameObjects.Text): HTMLCanvasElement | null {
    // Phaser Text renders into its own canvas — reuse it directly.
    const src = (txt as unknown as { canvas?: HTMLCanvasElement }).canvas;
    if (!src || src.width < 2) return null;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  }

  private adoptRect(rc: GO & Phaser.GameObjects.Rectangle): void {
    const w = (rc.width ?? 32) * (rc.scaleX ?? 1), h = (rc.height ?? 32) * (rc.scaleY ?? 1);
    // Fullscreen tints / overlays stay 2D (they're mood layers, not world objects).
    if (w >= this.worldW * 0.9 || h >= this.worldH * 0.9) return;
    const color = (rc.fillColor ?? 0x888888);
    const mat = new THREE.MeshBasicMaterial({ color });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w / PX, Math.min(w, h) / PX * 0.5, h / PX / 2), mat);
    const holder = new THREE.Group();
    holder.add(box);
    box.position.y = Math.min(w, h) / PX * 0.25;
    this.root.add(holder);
    this.tracked.set(rc, {
      obj: rc, mesh: holder, mats: [mat], shadow: null, kind: 'rect', hash: 0,
      footY: (rc.height ?? 0) / 2, halfW: w / PX / 2, baseColor: new THREE.Color(color), phase: 0, aspect: 1,
    });
    this.hideFrom2D(rc);
  }

  // ── Frame sync ──
  update(dt: number): void {
    if (!this.built) { this.tryBuild(); return; }
    // A Phaser scene restart keeps the Scene instance but replaces its display
    // objects.  Rebind the 3D protagonist when that happens; otherwise the new
    // player Graphics is hidden by the mirror while the actual 3D hero remains
    // attached to the destroyed player from the previous floor.
    const livePlayer = OverworldMirror.findPlayer(this.scene);
    if (livePlayer && livePlayer !== this.playerObj) {
      if (this.hero) {
        this.hero.group.removeFromParent();
        disposeDeep(this.hero.group);
      }
      if (this.surfMount) {
        this.surfMount.group.removeFromParent();
        disposeDeep(this.surfMount.group);
      }
      this.hero = null;
      this.surfMount = null;
      this.heroLast = null;
      this.heroWalkPhase = 0;
      this.playerObj = livePlayer;
      if (!this.tracked.has(livePlayer)) this.adopt(livePlayer);
    }
    if (this.pendingObjects.size) {
      const ready = [...this.pendingObjects];
      this.pendingObjects.clear();
      for (const obj of ready) {
        if (obj.scene) this.adopt(obj);
      }
    }
    this.time += dt;
    if (this.needsTerrainRebuild) {
      this.needsTerrainRebuild = false;
      this.rebuildTerrain();
    }
    this.updateInteriorModel(dt);
    // Map graphics occasionally redraw (doors opening, cut trees): re-composite at most ~2Hz.
    this.mapRedrawCooldown -= dt;
    if (this.mapRedrawCooldown <= 0) {
      this.mapRedrawCooldown = 0.5;
      let dirty = false;
      for (const g of this.mapGraphics) {
        const buf = (g as unknown as { commandBuffer?: unknown[] }).commandBuffer;
        if (!buf) continue;
        const h = hashCommands(buf);
        if (this.mapHashes.get(g) !== h) { dirty = true; break; }
      }
      if (!dirty) {
        // Baked map textures can be repainted after we composited them
        // (detail passes, delayed draws) — watch their pixel content too.
        for (const gi of this.mapImages) {
          const im = gi as unknown as Phaser.GameObjects.Image;
          const sig = this.imageSig(im);
          if (this.mapImgSigs.get(gi) !== sig) {
            this.mapImgSigs.set(gi, sig);
            dirty = true;
            break;
          }
        }
      }
      if (dirty) {
        this.redrawGround();
        this.needsTerrainRebuild = true;
      }
    }

    const cam = this.scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { _follow?: GO };
    const followT = cam._follow ?? this.playerObj;
    let playerPos: THREE.Vector3 | null = null;

    const dead: GO[] = [];
    for (const t of this.tracked.values()) {
      const o = t.obj;
      if (!o.scene) { dead.push(o); continue; }
      if (t.badgeScanner && t.fixedWorld) {
        t.mesh.position.set(t.fixedWorld.x, 0, t.fixedWorld.z);
        t.mesh.visible = (o.visible !== false) && ((o.alpha ?? 1) > 0.02);
        t.badgeScanner.setClosed(Number(o.getData?.('badgeScannerClosed3D') ?? 1));
        t.badgeScanner.setBadgeCount(Number(o.getData?.('badgeScannerBadges3D') ?? 0), Number(o.getData?.('badgeScannerTotal3D') ?? 8));
        if (t.mesh.visible) t.badgeScanner.update(this.time);
        continue;
      }
      const x = (o.x ?? 0) / PX;
      const z = ((o.y ?? 0) + t.footY * ((o.scaleY ?? 1))) / PX;
      t.mesh.position.set(x, 0, z);
      t.mesh.visible = (o.visible !== false) && ((o.alpha ?? 1) > 0.02);

      // Named flat guardians/props can request a live yaw toward the player.
      // This preserves their authored front instead of leaving the relief at a
      // fixed world angle while the player and camera move around it.
      const facePlayer = (o as unknown as { getData?: (key: string) => unknown }).getData?.('facePlayer3D');
      if (facePlayer && this.playerObj) {
        const targetX = (this.playerObj.x ?? 0) / PX;
        const targetZ = (this.playerObj.y ?? 0) / PX;
        const dx = targetX - x, dz = targetZ - z;
        // Once the GLB is attached, its manifest rotY is baked into the inner model,
        // so subtract it here — otherwise the baked offset (e.g. daejangseung's 140°)
        // stacks on the yaw and the model's front never actually meets the player.
        const yawOffset = t.creature ? modelBaseYawRad(t.creatureKey ?? '') : 0;
        if (Math.hypot(dx, dz) > 0.05) t.mesh.rotation.y = Math.atan2(dx, dz) - yawOffset;
      }

      const inner = t.relief;

      // Tagged legendary/creature Images use only their local production GLB.
      // Keep the real authored 2D sprite visible while the manifest/model loads
      // (or forever if unavailable), then swap without changing the Phaser
      // object that still owns cutscene position, alpha, scale and lifetime.
      if (t.kind === 'image' && t.creatureKey && !t.creature && hasModel(t.creatureKey)) {
        const loaded = getModel(t.creatureKey);
        if (loaded) {
          t.creature = loaded.group;
          t.mesh.add(t.creature);
          this.stage.requestMeshPreparation();
          if (o.getData?.('creatureAnimation3D') === 'nabihalmang-appearance') {
            t.creatureAnimation = generateNabihalmangAppearance(t.creature);
          }
          this.hideFrom2D(o);
        }
      }
      if (t.creature) {
        t.mesh.visible = (o.visible !== false) && ((o.alpha ?? 1) > 0.02);
        if (t.shadow) t.shadow.visible = t.mesh.visible;
        const authoredHeight = Number(o.getData?.('creatureHeight3D'));
        const height = Number.isFinite(authoredHeight) && authoredHeight > 0 ? authoredHeight : 1.8;
        const scaleRatio = Math.abs(o.scaleX ?? 1) / Math.max(0.0001, t.creatureBaseScale ?? 1);
        const breathe = 1 + Math.sin(this.time * 2.0 + t.phase) * 0.018;
        t.creature.scale.setScalar(height * scaleRatio * breathe);
        // A cutscene may create the actor hidden before its entrance cue. Do
        // not consume the generated intro while the owning Phaser image is
        // still at alpha 0.
        if (t.mesh.visible) t.creatureAnimation?.update(dt);
      } else if (t.creatureKey) {
        t.mesh.visible = false;
        if (t.shadow) t.shadow.visible = false;
        this.show2D(o);
      }
      if (inner) {
        const sx = Math.abs(o.scaleX ?? 1), sy = Math.abs(o.scaleY ?? 1);
        if (t.kind === 'image') inner.scale.set(sx / PX, sy / PX, ((sx + sy) / 2) / PX);
        if (t.kind === 'graphics') { const s = 1 / (PX * 3); inner.scale.set(sx * s, sy * s, s); }
        if (o.flipX) inner.scale.x = -Math.abs(inner.scale.x);
        // Idle life: characters/creatures gently breathe.
        if (t.kind === 'graphics' || t.kind === 'image') {
          const breathe = 1 + Math.sin(this.time * 2.2 + t.phase) * 0.012;
          inner.scale.y *= breathe;
        }
        inner.rotation.z = -((o.angle ?? 0) * Math.PI / 180);
      }
      if (t.mats) {
        const tint = (o as { tintTopLeft?: number; isTinted?: boolean });
        for (const m of t.mats) {
          m.opacity = o.alpha ?? 1;
          m.transparent = true;
          if (tint.isTinted && tint.tintTopLeft !== undefined) m.color.set(tint.tintTopLeft);
          else m.color.set(t.kind === 'rect' ? t.baseColor.getHex() : 0xffffff);
        }
      }
      if (t.kind === 'character' && t.character) {
        const last = t.characterLast;
        const dx = last ? x - last.x : 0, dz = last ? z - last.z : 0;
        if (last) { last.x = x; last.z = z; }
        else t.characterLast = { x, z };
        const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
        const moving = speed > 0.35;
        t.characterPhase = (t.characterPhase ?? 0) + (moving ? Math.min(15, 6 + speed * 1.5) : 2.1) * dt;
        t.character.setRiding?.(o.getData?.('characterVehicle3D') === 'bike');
        t.character.setWalk(t.characterPhase, moving, dt);
        const lookAt = o.getData?.('characterLookAt3D') as { x?: number; y?: number } | undefined;
        if (!moving && typeof lookAt?.x === 'number' && typeof lookAt.y === 'number'
          && Number.isFinite(lookAt.x) && Number.isFinite(lookAt.y)) {
          // Story-scene characters can hold eye contact with a fixed Phaser
          // world position. Phaser y maps to Three.js z in the overworld.
          t.character.face((lookAt.x / PX) - x, (lookAt.y / PX) - z, dt);
        } else {
          t.character.face(dx, dz, dt);
        }
        t.character.group.scale.x = Math.abs(t.character.group.scale.x) * (o.flipX ? -1 : 1);
      }
      if (t.kind === 'graphics') this.refreshGraphics(t);
      if (t.kind === 'image') {
        const im = o as GO & Phaser.GameObjects.Image;
        const sig = `${im.texture.key}:${im.frame?.name ?? 0}`;
        if (sig !== t.texSig) { t.texSig = sig; this.refreshImage(t, im); }
      }
      if (t.kind === 'text') {
        // Character nameplates share the actor's world point and hover above
        // the head. Generic signs retain their authored ground anchor.
        const labelTarget = o.getData?.('characterLabelTarget3D') as GO | undefined;
        if (labelTarget?.scene) {
          t.mesh.position.set((labelTarget.x ?? 0) / PX, 2.25, (labelTarget.y ?? 0) / PX);
        } else {
          t.mesh.position.set((o.x ?? 0) / PX, 1.6, (o.y ?? 0) / PX);
        }
        t.mesh.quaternion.copy(this.stage.camera.quaternion);
      }
      if (o === followT) {
        playerPos = this.playerPosition.copy(t.mesh.position);
        this.updateHero(t, dt);
      }
    }
    for (const d of dead) {
      const t = this.tracked.get(d);
      if (t) {
        t.creatureAnimation?.dispose();
        this.root.remove(t.mesh);
        this.tracked.delete(d);
      }
    }

    // The follow target might be untracked (e.g. a Container player) — derive from raw coords.
    if (!playerPos && followT && followT.x !== undefined) {
      playerPos = this.playerPosition.set((followT.x ?? 0) / PX, 0, ((followT.y ?? 0) + 14) / PX);
    }

    // Terrain props are authored in group-local tile coordinates. Passing the
    // live hero position lets nearby tall-grass instances react to footsteps.
    if (this.terrain) {
      const localPlayer = playerPos ? this.localPlayerPosition.copy(playerPos).sub(this.terrain.group.position) : null;
      this.terrain.update(this.time, localPlayer);
    }

    // 2D camera shake → 3D shake.
    const fx = (cam as unknown as { shakeEffect?: { isRunning?: boolean } }).shakeEffect;
    if (fx?.isRunning) this.rig.addShake(0.25);

    this.rig.update(dt, playerPos);
    if (playerPos) this.fadeOccluders(playerPos, dt);
    // The hatch stage follows the final camera pose, so camera smoothing and
    // interior/overworld rigs cannot make the Egg drift across the screen.
    this.hatchEffect?.update(dt);
  }

  // ── See-through buildings ──
  // Any building standing between the camera and the player fades to a ghost
  // so tall city blocks never hide the hero (the classic third-person fix).
  private tmpA = new THREE.Vector3();
  private fadeOccluders(playerPos: THREE.Vector3, dt: number): void {
    const t = this.terrain;
    if (!t || !t.blockers.length) return;
    const cam = this.stage.camera.position;
    const cx = cam.x, cz = cam.z;
    const px = playerPos.x, pz = playerPos.z;
    const dx = px - cx, dz = pz - cz;
    const segLen2 = dx * dx + dz * dz || 1;

    for (const b of t.blockers) {
      b.node.getWorldPosition(this.tmpA);
      const bx = this.tmpA.x, bz = this.tmpA.z;
      // closest point on the camera→player segment (XZ)
      const k = Math.max(0, Math.min(1, ((bx - cx) * dx + (bz - cz) * dz) / segLen2));
      const qx = cx + dx * k, qz = cz + dz * k;
      const dist = Math.hypot(bx - qx, bz - qz);
      const blocking = k > 0.04 && k < 0.985 && dist < b.r;
      const target = blocking ? 1 : 0;
      if (Math.abs(b.fade - target) < 0.01 && target === 0 && b.fade === 0) continue;
      b.fade += (target - b.fade) * Math.min(1, dt * 8);
      if (b.fade < 0.01 && target === 0) { b.fade = 0; this.applyFade(b.node, 0); continue; }
      this.applyFade(b.node, b.fade);
    }
  }

  private applyFade(node: THREE.Object3D, fade: number): void {
    node.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const ud = mesh.userData as { fadeMats?: THREE.Material[] };
      // Clone materials once per mesh so shared (GLB prop) materials elsewhere
      // in the city aren't ghosted along with this one building.
      if (!ud.fadeMats) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clones = mats.map(m => m.clone());
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
        ud.fadeMats = clones;
        mesh.userData.sharedMat = false;
      }
      for (const m of ud.fadeMats) {
        const mm = m as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
        mm.transparent = fade > 0.01;
        // Occluders are decorative geometry, while the map/collision remains
        // underneath. Make a blocking object almost fully transparent so the
        // player, doors and interaction markers always remain readable.
        mm.opacity = 1 - fade * 0.94;
        mm.depthWrite = fade < 0.5;
      }
    });
  }

  /** Swap the protagonist's fallback Graphics for the animated 3D model and
   *  drive its walk/cycling cycle plus facing from position deltas. */
  private updateHero(t: Tracked, dt: number): void {
    const riding = t.obj.getData?.('characterVehicle3D') === 'bike';
    const surfing = t.obj.getData?.('characterSurfing3D') === true;
    if (!this.hero) {
      const design = this.scene.registry.get('playerGender') === 'girl' ? 'girl' : 'boy';
      this.hero = buildPlayerModel(design);
      t.mesh.add(this.hero.group);
    }
    if (surfing && !this.surfMount) {
      this.surfMount = buildSurfMountModel();
      t.mesh.add(this.surfMount.group);
    } else if (!surfing && this.surfMount) {
      this.surfMount.group.removeFromParent();
      disposeDeep(this.surfMount.group);
      this.surfMount = null;
    }
    const inner = t.relief;
    this.hero.group.visible = true;
    this.hero.setRiding?.(riding && !surfing);
    this.hero.setSurfing?.(surfing);
    if (inner) inner.visible = false;

    const p = t.mesh.position;
    const last = this.heroLast;
    const dx = last ? p.x - last.x : 0, dz = last ? p.z - last.z : 0;
    if (last) { last.x = p.x; last.z = p.z; }
    else this.heroLast = { x: p.x, z: p.z };
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    const moving = speed > 0.4;
    this.heroWalkPhase += (moving ? Math.min(16, 6 + speed * 1.6) : 2.2) * dt;
    this.hero.setWalk(this.heroWalkPhase, moving, dt);
    if (this.surfMount) {
      this.surfMount.group.visible = surfing;
      this.surfMount.update(this.time, moving, dt);
    }
    const lookAt = t.obj.getData?.('characterLookAt3D') as { x?: number; y?: number } | undefined;
    if (!moving && typeof lookAt?.x === 'number' && typeof lookAt.y === 'number'
      && Number.isFinite(lookAt.x) && Number.isFinite(lookAt.y)) {
      this.hero.face((lookAt.x / PX) - p.x, (lookAt.y / PX) - p.z, dt);
    } else {
      this.hero.face(dx, dz, dt);
    }
  }

  /** Play the nursery hatch cutscene inside this mirror's existing renderer. */
  startHatchEffect(profile: HatchEffectProfile3D): boolean {
    if (!this.built) return false;
    this.stopHatchEffect();
    const loaded = getModel(profile.key);
    // The Phaser hatch scene already owns the real species artwork. If its GLB
    // is not ready, use that 2D path instead of inventing a generic 3D creature.
    if (!loaded) return false;
    this.hatchEffect = new HatchEffect3D(this.stage, loaded, profile.type1);
    return true;
  }

  stopHatchEffect(): void {
    this.hatchEffect?.dispose();
    this.hatchEffect = null;
  }

  /** Restore all Phaser-side visibility (leaving 3D mode). */
  restore2D(): void {
    for (const o of this.hiddenFrom2D) this.show2D(o);
    for (const t of this.tracked.values()) this.show2D(t.obj);
    for (const g of this.mapGraphics) this.show2D(g);
    for (const i of this.mapImages) this.show2D(i);
  }

  /** Re-apply 2D hiding (entering 3D mode). */
  apply3D(): void {
    for (const o of this.hiddenFrom2D) this.hideFrom2D(o);
    for (const t of this.tracked.values()) {
      if (t.creatureKey && !t.creature) this.show2D(t.obj);
      else this.hideFrom2D(t.obj);
    }
    for (const g of this.mapGraphics) this.hideFrom2D(g);
    for (const i of this.mapImages) this.hideFrom2D(i);
  }
}
