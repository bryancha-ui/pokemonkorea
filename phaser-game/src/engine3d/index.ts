import Phaser from 'phaser';
import { BattleMirror } from './BattleMirror';
import { CameraRig } from './CameraRig';
import type { HatchEffectProfile3D } from './HatchEffect3D';
import { primeManifest } from './GlbModels';
import { OverworldMirror } from './OverworldMirror';
import { performanceProfile, type PerformanceProfile } from './PerformanceProfile';
import { primeProps } from './PropModels';
import { ThreeStage } from './ThreeStage';

// ── engine3d bootstrap ───────────────────────────────────────────────────────
// Drop-in 3D rendering layer. The Phaser game keeps running every byte of its
// logic, dialogue, events and music untouched; this module watches whichever
// scene is active and renders a 3D twin of it underneath the (now transparent)
// Phaser canvas, which continues to draw all UI on top.
//
//   • Overworld / interior scenes (anything that camera-follows the player)
//     get painted 3D terrain, characters and a third-person camera. Tagged
//     creatures registered in the model manifest remain exclusively 3D.
//   • Battle scenes get a cinematic arena with approved local GLBs; only
//     unregistered species and trainers without a model retain authored 2D art.
//   • Menu / Pokédex / title screens intentionally stay crisp 2D.
//
// World maps are 3D-only. Title/menu UI remains Phaser-authored, but a map can
// no longer fall back to its flat 2D background or be disabled with F3.

type AnyMirror = OverworldMirror | BattleMirror;

class Engine3D {
  private game: Phaser.Game;
  private stage: ThreeStage | null = null;
  private rig: CameraRig | null = null;
  private mirror: AnyMirror | null = null;
  private mirrorScene: Phaser.Scene | null = null;
  private readonly enabled = true;
  private recoveringUntil = 0;
  private mirrorApplied = false;
  private camPatched = new WeakSet<Phaser.Cameras.Scene2D.Camera>();
  /** Objects hidden only for the loading frame, released once a mirror owns the scene. */
  private loadingSuppressed = new Set<Phaser.GameObjects.GameObject>();
  private watchedScenes = new WeakSet<Phaser.Scene>();
  private readonly performance: PerformanceProfile;
  private renderAccumulator = 1;
  private frameMsEma = 1000 / 60;
  private qualityCheckTimer = 0;
  private qualityRecoveryTimer = 0;
  private telemetryTimer = 0;
  private telemetryStartedAt = performance.now();
  private telemetryFrames = 0;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.performance = performanceProfile();
    // Load the approved local-asset registries up front so the first scene already
    // knows which creature models and city props exist.
    primeManifest();
    primeProps();

    game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, dms: number) => this.step(dms / 1000));
    // Watch every scene's shutdown to drop its mirror. LazyScenes replaces its
    // lightweight placeholders with new Scene instances at runtime, so active
    // scenes are also registered in stepSafe() when they first appear.
    for (const sc of game.scene.scenes) this.watchScene(sc);
  }

  /** Visual systems use this to suppress their 2D fallback particles only
   *  while this exact scene is actively being mirrored in 3D. */
  isRendering(scene: Phaser.Scene): boolean {
    return this.enabled && this.mirrorApplied && !!this.mirror && this.mirrorScene === scene;
  }

  /** Start/stop the camera-relative nursery sequence without allocating a
   * second WebGL renderer (important on iPhone and lower-memory Android). */
  playHatch(scene: Phaser.Scene, profile: HatchEffectProfile3D): boolean {
    if (!this.isRendering(scene) || !(this.mirror instanceof OverworldMirror)) return false;
    return this.mirror.startHatchEffect(profile);
  }

  stopHatch(scene: Phaser.Scene): void {
    if (this.mirrorScene === scene && this.mirror instanceof OverworldMirror) {
      this.mirror.stopHatchEffect();
    }
  }

  private ensureStage(): boolean {
    if (this.stage) return true;
    try {
      this.stage = new ThreeStage(this.game);
      this.rig = new CameraRig(this.stage.camera);
      return true;
    } catch (err) {
      throw new Error(`3D renderer initialization failed: ${String(err)}`);
    }
  }

  /** Pick the scene that should drive 3D: battle first, else any scene with a
   *  detectable player (camera-follow overworld or static-camera interior). */
  private pickScene(): { scene: Phaser.Scene; kind: 'battle' | 'overworld' } | null {
    const active = this.game.scene.getScenes(true);
    // A scene can opt out of 3D entirely (e.g. the multi-floor department store,
    // whose flat interior + elevator UI must stay pure 2D) by setting disable3D.
    const opted = (sc: Phaser.Scene) => !!(sc as unknown as { disable3D?: boolean }).disable3D;
    for (let i = active.length - 1; i >= 0; i--) {
      const sc = active[i];
      if (opted(sc)) continue;
      if (/Battle/i.test(sc.scene.key)) return { scene: sc, kind: 'battle' };
    }
    // Authored 3D interiors opt in explicitly. Select them even during the
    // brief setup frame before their player object exists; OverworldMirror will
    // finish building as soon as the playable character is placed.
    for (let i = active.length - 1; i >= 0; i--) {
      const sc = active[i];
      if (opted(sc)) continue;
      if ((sc as unknown as { interior3D?: boolean }).interior3D && sc.cameras?.main) {
        return { scene: sc, kind: 'overworld' };
      }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const sc = active[i];
      if (opted(sc)) continue;
      if (sc.cameras?.main && OverworldMirror.findPlayer(sc)) return { scene: sc, kind: 'overworld' };
    }
    return null;
  }

  private onSceneDown(sc: Phaser.Scene): void {
    if (this.mirrorScene === sc) {
      // Phaser can remove CameraManager.main before DESTROY is observed on
      // slower mobile transitions. Visual recovery is best-effort here; the
      // important part is always releasing the old mirror and its WebGL data.
      try { this.mirror?.restore2D(); } catch (error) {
        console.warn('[engine3d] could not restore a shutting-down scene:', error);
      }
      try { this.setCamTransparent(sc, false); } catch { /* camera already gone */ }
      try { this.mirror?.destroy(); } catch { /* mirror already released */ }
      this.mirror = null;
      this.mirrorScene = null;
      this.mirrorApplied = false;
      this.stage?.setVisible(false);
    }
  }

  private watchScene(sc: Phaser.Scene): void {
    if (this.watchedScenes.has(sc)) return;
    this.watchedScenes.add(sc);
    sc.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.onSceneDown(sc));
    sc.events.on(Phaser.Scenes.Events.DESTROY, () => this.onSceneDown(sc));
  }

  private setCamTransparent(scene: Phaser.Scene, on: boolean): void {
    const cam = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { transparent: boolean }) | undefined;
    if (!cam) return;
    if (on) {
      if (this.camPatched.has(cam)) return;
      cam.transparent = true;
      this.camPatched.add(cam);
    } else {
      if (!this.camPatched.has(cam) && !cam.transparent) return;
      cam.transparent = false;
      this.camPatched.delete(cam);
    }
  }

  /** Hide every world-space Phaser object immediately while retaining the
   *  scroll-factor-zero dialogue/HUD layer. This closes the old startup/error
   *  window where a flat map could appear before the 3D mirror was ready. */
  //
  // This is a LOADING-FRAME guard only. It used to run on every frame, after
  // the mirror had already decided what stays 2D, and re-hid all of it: battle
  // HUDs (name, level, HP bar), trainer portraits and overworld emote/
  // container overlays all use scroll factor 1, so every battle could lose its
  // whole UI layer (first reported on the snow pass after the Dolmoe mine).
  private suppressWorld2D(scene: Phaser.Scene): void {
    const cam = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { id: number }) | undefined;
    if (!cam) return;
    for (const child of scene.children?.list ?? []) {
      const obj = child as Phaser.GameObjects.GameObject & {
        scrollFactorX?: number; scrollFactorY?: number; cameraFilter?: number;
        getData?: (key: string) => unknown;
      };
      // Battle HUDs and retained trainer portraits are authored screen-space
      // overlays. They must survive both the first 3D frame and renderer recovery.
      if (obj.getData?.('battleUi2D')) continue;
      if (obj.scrollFactorX === 0 && obj.scrollFactorY === 0) continue;
      // Leave objects someone else already hid alone, so releasing this
      // guard can never reveal them.
      if (typeof obj.cameraFilter === 'number' && (obj.cameraFilter & cam.id)) continue;
      cam.ignore(obj);
      this.loadingSuppressed.add(obj);
    }
  }

  /** Undo the loading-frame guard right before a mirror applies its own
   *  per-object 2D/3D decisions (which re-hide everything it replaces). */
  private releaseWorld2D(): void {
    for (const obj of this.loadingSuppressed) {
      const o = obj as Phaser.GameObjects.GameObject & { cameraFilter?: number };
      const cam = obj.scene?.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { id: number }) | undefined;
      if (cam && typeof o.cameraFilter === 'number') o.cameraFilter &= ~cam.id;
    }
    this.loadingSuppressed.clear();
  }

  private step(dt: number): void {
    try {
      const safeDt = Math.max(0, Math.min(dt, 0.1));
      this.sampleFrameBudget(safeDt);
      if (!this.enabled) return;

      // Keep the authoritative Phaser loop at 60 Hz for input, movement, UI and
      // battle rules. On constrained devices the mirrored Three.js underlay is
      // updated/rendered less often with accumulated delta, so animation speed
      // remains correct while GPU work drops substantially.
      this.renderAccumulator += safeDt;
      const heldPaused = !!this.mirrorScene?.scene.isPaused();
      const targetFps = heldPaused ? this.performance.paused3DFps : this.performance.target3DFps;
      const interval = 1 / targetFps;
      if (this.renderAccumulator + 0.0005 < interval) return;
      const renderDt = Math.min(this.renderAccumulator, 0.1);
      this.renderAccumulator = Math.max(0, this.renderAccumulator - interval);
      if (this.renderAccumulator > interval * 2) this.renderAccumulator = 0;
      this.stepSafe(renderDt);
    } catch (err) {
      this.recover3DOnly(this.mirrorScene, err);
    }
  }

  /** Observe Phaser's real frame cadence and lower only the 3D drawing-buffer
   * density when a constrained browser remains below budget. Recovery is slow
   * and hysteretic so resolution never pulses during a short battle effect. */
  private sampleFrameBudget(dt: number): void {
    if (dt <= 0 || dt >= 0.1) return;
    const frameMs = dt * 1000;
    this.frameMsEma += (frameMs - this.frameMsEma) * 0.06;
    this.qualityCheckTimer += dt;
    this.telemetryTimer += dt;

    if (this.performance.constrained && this.stage && this.qualityCheckTimer >= 2) {
      const actualFps = Number(this.game.loop.actualFps) || (1000 / this.frameMsEma);
      const overloaded = this.frameMsEma > 24 || actualFps < 43;
      const hasHeadroom = this.frameMsEma < 18.8 && actualFps > 53;
      this.qualityCheckTimer = 0;
      if (overloaded) {
        this.qualityRecoveryTimer = 0;
        this.stage.setQualityScale(this.stage.getQualityScale() - 0.1);
      } else if (hasHeadroom && this.stage.getQualityScale() < 1) {
        this.qualityRecoveryTimer += 2;
        if (this.qualityRecoveryTimer >= 8) {
          this.stage.setQualityScale(this.stage.getQualityScale() + 0.05);
          this.qualityRecoveryTimer = 0;
        }
      } else {
        this.qualityRecoveryTimer = Math.max(0, this.qualityRecoveryTimer - 1);
      }
    }

    if (this.stage && this.telemetryTimer >= 1) {
      const now = performance.now();
      const seconds = Math.max(0.001, (now - this.telemetryStartedAt) / 1000);
      const stats = this.stage.getRenderStats();
      const data = this.stage.canvas.dataset;
      data.pk3dProfile = this.performance.mobile ? 'mobile' : this.performance.constrained ? 'constrained' : 'desktop';
      data.pk3dTargetFps = String(this.performance.target3DFps);
      data.pk3dPhaserFps = (Number(this.game.loop.actualFps) || (1000 / this.frameMsEma)).toFixed(1);
      data.pk3dRenderFps = (this.telemetryFrames / seconds).toFixed(1);
      data.pk3dQuality = this.stage.getQualityScale().toFixed(2);
      data.pk3dPixelRatio = stats.pixelRatio.toFixed(2);
      data.pk3dCalls = String(stats.calls);
      data.pk3dTriangles = String(stats.triangles);
      data.pk3dScene = this.mirrorScene?.scene.key ?? '';
      this.telemetryTimer = 0;
      this.telemetryStartedAt = now;
      this.telemetryFrames = 0;
    }
  }

  private noteRenderedFrame(): void { this.telemetryFrames++; }

  private stepSafe(dt: number): void {
    if (!this.enabled) return;
    const pick = this.pickScene();
    if (pick) this.watchScene(pick.scene);
    if (performance.now() < this.recoveringUntil) {
      if (pick) {
        this.suppressWorld2D(pick.scene);
        this.setCamTransparent(pick.scene, true);
      }
      return;
    }

    if (!pick) {
      // The mirrored scene may only be PAUSED (evolution overlay, menu, move
      // learning launched over a battle) — it left the active list but still
      // renders. Keep the 3D view up and frozen underneath the overlay;
      // destroying it here is what snapped gym battles back to 2D mid-fight.
      const held = this.mirrorScene;
      const heldOptedOut = !!(held as unknown as { disable3D?: boolean } | null)?.disable3D;
      if (this.mirror && this.stage && held && !heldOptedOut && (held.scene.isPaused() || held.scene.isVisible())) {
        if (!this.stage.isHealthy()) throw new Error('Three.js WebGL context was lost');
        this.mirror.update(Math.min(dt, 0.1));   // idle animations keep breathing
        if (!this.stage.render()) throw new Error('Three.js frame could not be rendered');
        this.noteRenderedFrame();
        if (!this.mirrorApplied) {
          this.releaseWorld2D();
          this.mirror.apply3D();
          this.mirrorApplied = true;
        }
        this.setCamTransparent(held, true);
        this.stage.setVisible(true);
        return;
      }
      // Truly no 3D-able scene (title, menus…): hide the 3D canvas, full 2D.
      if (this.mirror) {
        this.mirror.restore2D();
        if (this.mirrorScene) this.setCamTransparent(this.mirrorScene, false);
        this.mirror.destroy();
        this.mirror = null;
        this.mirrorScene = null;
        this.mirrorApplied = false;
      }
      this.stage?.setVisible(false);
      return;
    }

    if (!this.ensureStage()) return;
    const stage = this.stage!;
    stage.attachDom();
    if (!stage.isHealthy()) throw new Error('Three.js WebGL context was lost');

    // From this point onward the map is 3D-only, including its loading frame.
    // Phaser keeps simulating collisions and UI, but its world/background can
    // never become a visible substitute for the volumetric terrain.
    // Only until this scene's mirror has applied: afterwards the mirror owns
    // every object's 2D/3D visibility.
    // Objects of a departing scene must not stay in the loading set.
    if (this.mirrorScene !== pick.scene) this.loadingSuppressed.clear();
    if (this.mirrorScene !== pick.scene || !this.mirrorApplied) this.suppressWorld2D(pick.scene);
    this.setCamTransparent(pick.scene, true);

    if (this.mirrorScene !== pick.scene) {
      if (this.mirror && this.mirrorScene) {
        this.mirror.restore2D();
        this.setCamTransparent(this.mirrorScene, false);
        this.mirror.destroy();
      }
      this.mirror = null;
      this.mirrorScene = pick.scene;
      this.mirrorApplied = false;
      this.mirror = pick.kind === 'battle'
        ? new BattleMirror(pick.scene, stage, this.rig!)
        : new OverworldMirror(pick.scene, stage, this.rig!);
    }

    // Overworld mirrors only "arm" once the camera-follow exists.
    if (this.mirror instanceof OverworldMirror && !this.mirror.tryBuild()) {
      // Show the 3D sky/loading world rather than revealing the flat map while
      // the player/camera object is completing scene construction.
      if (!stage.render()) throw new Error('Three.js loading frame could not be rendered');
      this.noteRenderedFrame();
      stage.setVisible(true);
      return;
    }

    // Render off-screen first. Only after that succeeds may we hide Phaser's
    // field/battlers and expose the Three canvas.
    this.mirror!.update(Math.min(dt, 0.1));
    if (!stage.render()) throw new Error('Three.js frame could not be rendered');
    this.noteRenderedFrame();
    if (!this.mirrorApplied) {
      this.releaseWorld2D();
      this.mirror!.apply3D();
      this.mirrorApplied = true;
    }
    this.setCamTransparent(pick.scene, true);
    stage.setVisible(true);
  }

  private recover3DOnly(scene: Phaser.Scene | null, reason: unknown): void {
    console.warn('[engine3d] 3D frame failed; rebuilding the 3D renderer:', reason);
    const affected = scene ?? this.mirrorScene;
    if (affected) {
      this.suppressWorld2D(affected);
      this.setCamTransparent(affected, true);
    }
    try { this.mirror?.destroy(); } catch { /* already recovering */ }
    this.mirror = null;
    this.mirrorScene = null;
    this.mirrorApplied = false;
    try { this.stage?.destroy(); } catch { /* context already lost */ }
    this.stage = null;
    this.rig = null;
    // A short backoff avoids a tight allocation loop after mobile context loss.
    // The same scene is retried automatically; there is no per-scene 2D escape.
    this.recoveringUntil = performance.now() + 500;
  }
}

export function bootstrap3D(game: Phaser.Game): void {
  const start = () => {
    try {
      const eng = new Engine3D(game);
      (window as unknown as { __pk3d?: Engine3D }).__pk3d = eng;
    } catch (err) {
      console.error('[engine3d] failed to start the required 3D renderer:', err);
      throw err;
    }
  };
  if (game.isBooted) start();
  else game.events.once(Phaser.Core.Events.READY, start);
}
