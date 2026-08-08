import Phaser from 'phaser';
import { BattleMirror } from './BattleMirror';
import { CameraRig } from './CameraRig';
import type { HatchEffectProfile3D } from './HatchEffect3D';
import { primeManifest } from './GlbModels';
import { OverworldMirror } from './OverworldMirror';
import { primeProps } from './PropModels';
import { ThreeStage } from './ThreeStage';

// ── engine3d bootstrap ───────────────────────────────────────────────────────
// Drop-in 3D rendering layer. The Phaser game keeps running every byte of its
// logic, dialogue, events and music untouched; this module watches whichever
// scene is active and renders a 3D twin of it underneath the (now transparent)
// Phaser canvas, which continues to draw all UI on top.
//
//   • Overworld / interior scenes (anything that camera-follows the player)
//     get painted 3D terrain, extruded characters and a third-person camera.
//   • Battle scenes get a cinematic arena with 3D creatures and a drifting
//     battle camera.
//   • Menu / Pokédex / title screens intentionally stay crisp 2D.
//
//   F3 toggles 2D ↔ 3D at any time (saved to localStorage).

const STORE_KEY = 'pk3d.enabled';

type AnyMirror = OverworldMirror | BattleMirror;

class Engine3D {
  private game: Phaser.Game;
  private stage: ThreeStage | null = null;
  private rig: CameraRig | null = null;
  private mirror: AnyMirror | null = null;
  private mirrorScene: Phaser.Scene | null = null;
  private enabled: boolean;
  private failed = false;
  private blockedScene: Phaser.Scene | null = null;
  private mirrorApplied = false;
  private camPatched = new WeakSet<Phaser.Cameras.Scene2D.Camera>();

  constructor(game: Phaser.Game) {
    this.game = game;
    this.enabled = (localStorage.getItem(STORE_KEY) ?? '1') === '1';
    // Load the generated-asset registries up front so the first scene already
    // knows which creature models and city props exist.
    primeManifest();
    primeProps();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') { e.preventDefault(); this.toggle(); }
    });

    game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, dms: number) => this.step(dms / 1000));
    // Watch every scene's shutdown to drop its mirror.
    for (const sc of game.scene.scenes) {
      sc.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.onSceneDown(sc));
      sc.events.on(Phaser.Scenes.Events.DESTROY, () => this.onSceneDown(sc));
    }
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

  toggle(): void {
    this.enabled = !this.enabled;
    localStorage.setItem(STORE_KEY, this.enabled ? '1' : '0');
    if (!this.enabled) {
      this.mirror?.restore2D();
      this.mirrorApplied = false;
      if (this.mirrorScene) this.setCamTransparent(this.mirrorScene, false);
      this.stage?.setVisible(false);
    } else {
      // Activation happens in step() only after one successful Three.js frame.
      // This prevents a black flash when the context was evicted while hidden.
      this.blockedScene = null;
    }
  }

  private ensureStage(): boolean {
    if (this.failed) return false;
    if (this.stage) return true;
    try {
      this.stage = new ThreeStage(this.game);
      this.rig = new CameraRig(this.stage.camera);
      return true;
    } catch (err) {
      console.warn('[engine3d] WebGL unavailable, staying 2D:', err);
      this.failed = true;
      return false;
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
      this.mirror?.restore2D();
      this.setCamTransparent(sc, false);
      this.mirror?.destroy();
      this.mirror = null;
      this.mirrorScene = null;
      this.mirrorApplied = false;
      this.stage?.setVisible(false);
    }
    if (this.blockedScene === sc) this.blockedScene = null;
  }

  private setCamTransparent(scene: Phaser.Scene, on: boolean): void {
    const cam = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { transparent: boolean }) | undefined;
    if (cam) cam.transparent = on;
  }

  private step(dt: number): void {
    try {
      this.stepSafe(dt);
    } catch (err) {
      this.fallbackTo2D(this.mirrorScene, err);
    }
  }

  private stepSafe(dt: number): void {
    if (!this.enabled || this.failed) return;
    const pick = this.pickScene();

    // A renderer/mirror failure disables 3D only for the affected scene. The
    // complete Phaser view remains playable, and the next map/battle gets a
    // fresh world instead of repeatedly throwing every animation frame.
    if (pick?.scene === this.blockedScene) {
      this.setCamTransparent(pick.scene, false);
      this.stage?.setVisible(false);
      return;
    }
    if (pick && this.blockedScene && pick.scene !== this.blockedScene) this.blockedScene = null;

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
        if (!this.mirrorApplied) {
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
      this.setCamTransparent(pick.scene, false);
      stage.setVisible(false);
      return;
    }

    // Render off-screen first. Only after that succeeds may we hide Phaser's
    // field/battlers and expose the Three canvas.
    this.mirror!.update(Math.min(dt, 0.1));
    if (!stage.render()) throw new Error('Three.js frame could not be rendered');
    if (!this.mirrorApplied) {
      this.mirror!.apply3D();
      this.mirrorApplied = true;
    }
    this.setCamTransparent(pick.scene, true);
    stage.setVisible(true);
  }

  private fallbackTo2D(scene: Phaser.Scene | null, reason: unknown): void {
    console.warn('[engine3d] 3D frame failed; keeping the scene playable in 2D:', reason);
    const affected = scene ?? this.mirrorScene;
    try { this.mirror?.restore2D(); } catch { /* best-effort visual recovery */ }
    if (affected) {
      this.setCamTransparent(affected, false);
      // If a mirror constructor failed after camera.ignore(), it may not have
      // reached this.mirror. Clear this camera's ignore bit for every display
      // object so both Pokémon and the field are guaranteed to return.
      const cam = affected.cameras?.main;
      if (cam) {
        for (const child of affected.children?.list ?? []) {
          const obj = child as Phaser.GameObjects.GameObject & { cameraFilter?: number };
          if (typeof obj.cameraFilter === 'number') obj.cameraFilter &= ~cam.id;
        }
      }
      this.blockedScene = affected;
    }
    try { this.mirror?.destroy(); } catch { /* already falling back */ }
    this.mirror = null;
    this.mirrorScene = null;
    this.mirrorApplied = false;
    this.stage?.setVisible(false);
  }
}

export function bootstrap3D(game: Phaser.Game): void {
  const start = () => {
    try {
      const eng = new Engine3D(game);
      (window as unknown as { __pk3d?: Engine3D }).__pk3d = eng;
    } catch (err) {
      console.warn('[engine3d] failed to start, game remains 2D:', err);
    }
  };
  if (game.isBooted) start();
  else game.events.once(Phaser.Core.Events.READY, start);
}
