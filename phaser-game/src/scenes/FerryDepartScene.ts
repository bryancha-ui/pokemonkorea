import Phaser from 'phaser';
import * as THREE from 'three';
import { makeFerry, makeWater } from '../engine3d/Props';
import { DialogBox } from '../ui/DialogBox';
import { playBgm } from '../systems/Music';
import { tr } from '../systems/i18n';

// ── Ferry departure cinematic ────────────────────────────────────────────────
// A short, non-interactive 3D cutscene: the overnight 남해 연락선 casts off from
// Haean Harbour at dusk and stands out to sea, then fades into the walkable deck
// (FerryScene). Rendered by a self-contained Three.js canvas layered *behind* the
// transparent Phaser canvas (same trick the engine3d ThreeStage uses), so Phaser
// still draws the letterbox + dialogue on top. The scene opts out of the shared
// 3D mirror (disable3D) so the two never fight over the stage.
export class FerryDepartScene extends Phaser.Scene {
  public disable3D = true;

  private gl?: THREE.WebGLRenderer;
  private canvas?: HTMLCanvasElement;
  private tscene?: THREE.Scene;
  private cam?: THREE.PerspectiveCamera;
  private ferry?: THREE.Group;
  private water?: { mesh: THREE.Mesh; update(t: number): void };
  private wake?: THREE.Mesh;
  private dialog!: DialogBox;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private elapsed = 0;
  private leaving = false;

  constructor() { super('FerryDepartScene'); }

  create() {
    this.elapsed = 0; this.leaving = false;
    this.input.keyboard?.resetKeys();
    (this.cameras.main as unknown as { transparent: boolean }).transparent = true;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    try {
      this.buildThree();
    } catch (err) {
      // No WebGL / context lost → don't strand the player mid-voyage.
      console.warn('[FerryDepart] 3D unavailable, skipping cinematic:', err);
      this.time.delayedCall(60, () => this.scene.start('FerryScene'));
      return;
    }

    this.buildOverlay();
    this.cameras.main.fadeIn(700, 0, 0, 0);
    playBgm(this, 'ferrydusk');

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dialog.show([
      tr('🌅 The overnight ferry casts off from Haean Harbour, bound across the dark strait for Jeju.'),
      tr("Rival: A whole ocean between us and the mainland now. No turning back from here."),
      tr("Rival: The old Grandmother's shrine, the vents, all of it — out there in the dark. Let's go meet it."),
    ], () => this.finish());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  // ── Three.js world ─────────────────────────────────────────────────────────
  private buildThree() {
    const pc = this.game.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;pointer-events:none;';
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    pc.parentElement!.insertBefore(this.canvas, pc);
    this.canvas.style.zIndex = '0';
    pc.style.position = 'relative';
    (pc.style as CSSStyleDeclaration).zIndex = '1';

    this.tscene = new THREE.Scene();
    this.tscene.fog = new THREE.Fog(0xf1b06a, 34, 150);
    this.cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 500);
    this.cam.position.set(9.5, 5.2, -15);
    this.syncCanvas();

    // Sunset sky dome — teal zenith → orange band → pale gold at the waterline.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x27407a) },
        mid: { value: new THREE.Color(0xef9a54) },
        bot: { value: new THREE.Color(0xf7d488) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){ float h = normalize(vP).y;
          vec3 c = h > 0.12 ? mix(mid, top, clamp((h-0.12)/0.88, 0.0, 1.0))
                            : mix(bot, mid, clamp((h+0.08)/0.20, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), skyMat);
    sky.frustumCulled = false;
    this.tscene.add(sky);

    // Low warm sun with a soft glow, sitting on the horizon behind the ferry.
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.makeGlowTexture(), color: 0xffdca0, transparent: true, opacity: 0.95, depthWrite: false, fog: false,
    }));
    sunSprite.position.set(2, 6, 130);
    sunSprite.scale.set(38, 38, 1);
    this.tscene.add(sunSprite);

    const hemi = new THREE.HemisphereLight(0xffd8a2, 0x21384f, 1.15);
    this.tscene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb268, 2.1);
    sun.position.set(3, 9, 60);
    this.tscene.add(sun);

    // Sea.
    this.water = makeWater(500, 500);
    this.water.mesh.position.y = 0;
    this.tscene.add(this.water.mesh);

    // Harbour dock the ferry pulls away from (port side, toward the camera).
    this.tscene.add(this.buildDock());

    // The ferry, bow pointing out to sea (+Z).
    this.ferry = makeFerry(10, 3.4);
    this.ferry.position.set(0, 0.15, -2);
    this.tscene.add(this.ferry);

    // A foamy wake trailing off the stern.
    const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false });
    this.wake = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 10), wakeMat);
    this.wake.rotation.x = -Math.PI / 2;
    this.wake.position.set(0, 0.06, -9);
    this.tscene.add(this.wake);
  }

  private buildDock(): THREE.Group {
    const g = new THREE.Group();
    const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6238 });
    const pileMat = new THREE.MeshLambertMaterial({ color: 0x5c3f22 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 12), plankMat);
    deck.position.set(-4.4, 0.35, -8);
    g.add(deck);
    for (let i = 0; i < 5; i++) {
      for (const sx of [-5.7, -3.1]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 6), pileMat);
        pile.position.set(sx, -0.2, -13 + i * 2.6);
        g.add(pile);
      }
    }
    // A couple of lamp posts glowing at dusk.
    for (const z of [-12, -5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), pileMat);
      post.position.set(-3.2, 1.05, z); g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      lamp.position.set(-3.2, 1.95, z); g.add(lamp);
    }
    return g;
  }

  private makeGlowTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,224,160,0.9)');
    grd.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ── Phaser overlay (letterbox + title + dialogue) ──────────────────────────
  private buildOverlay() {
    const w = this.scale.width, h = this.scale.height;
    this.add.rectangle(w / 2, 34, w, 68, 0x000000, 0.85).setScrollFactor(0).setDepth(40);
    this.add.rectangle(w / 2, h - 34, w, 68, 0x000000, 0.85).setScrollFactor(0).setDepth(40);
    this.add.text(w / 2, 34, tr('⛴️ Casting off — Haean Harbour → Jeju'), {
      fontSize: '16px', color: '#ffe9c0', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
    this.add.text(w - 12, h - 12, tr('SPACE: continue'), {
      fontSize: '11px', color: '#cccccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(41);
    this.dialog = new DialogBox(this, w, h);
  }

  private finish() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.time.delayedCall(850, () => this.scene.start('FerryScene'));
  }

  // ── Per-frame animation ────────────────────────────────────────────────────
  update(_: number, deltaMs: number) {
    if (!this.gl || !this.tscene || !this.cam) return;
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    const t = this.elapsed;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();

    if (this.ferry) {
      // Accelerate away from the dock (quadratic ease so it eases into motion),
      // riding a gentle swell with a slow roll.
      this.ferry.position.z = -2 + 0.55 * t * t;
      this.ferry.position.y = 0.15 + Math.sin(t * 1.05) * 0.07;
      this.ferry.rotation.z = Math.sin(t * 0.7) * 0.02;
      this.ferry.rotation.x = Math.sin(t * 0.9 + 1) * 0.015;
    }
    if (this.wake && this.ferry) {
      const speed = Math.min(1, t / 3);
      this.wake.position.z = this.ferry.position.z - 6;
      this.wake.scale.set(1, 0.6 + speed * 1.4, 1);
      (this.wake.material as THREE.MeshBasicMaterial).opacity = 0.5 * speed;
    }
    this.water?.update(t);

    // Camera drifts along the quay and pans to keep the receding ferry framed.
    this.cam.position.x = 9.5 + Math.sin(t * 0.18) * 0.7;
    this.cam.position.y = 5.2 + Math.sin(t * 0.25) * 0.2;
    const look = this.ferry ? Math.min(this.ferry.position.z * 0.28, 10) : 0;
    this.cam.lookAt(0, 1.4, look);

    this.syncCanvas();
    this.gl.render(this.tscene, this.cam);
  }

  private syncCanvas() {
    const pc = this.game.canvas;
    if (!pc || !pc.parentElement || !this.gl || !this.cam || !this.canvas) return;
    const rect = pc.getBoundingClientRect();
    const host = pc.parentElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    this.canvas.style.left = `${rect.left - host.left}px`;
    this.canvas.style.top = `${rect.top - host.top}px`;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    const w = Math.max(2, Math.round(rect.width)), h = Math.max(2, Math.round(rect.height));
    this.gl.setSize(w, h, false);
    this.cam.aspect = rect.width / Math.max(1, rect.height);
    this.cam.updateProjectionMatrix();
  }

  private cleanup() {
    const pc = this.game.canvas;
    if (pc) (pc.style as CSSStyleDeclaration).zIndex = '';
    this.tscene?.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose?.());
      else mat?.dispose?.();
    });
    this.gl?.dispose();
    this.canvas?.parentElement?.removeChild(this.canvas);
    this.gl = undefined; this.canvas = undefined; this.tscene = undefined;
    this.cam = undefined; this.ferry = undefined; this.water = undefined; this.wake = undefined;
  }
}
