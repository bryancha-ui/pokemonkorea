import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm, TRACKS } from '../systems/Music';
import { ENDING_BGM_VOLUME, playEndingCreditsVideo } from '../systems/EndingCreditsVideo';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { dexEntry } from '../data/Pokedex';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';

// The mythological pantheon shown drifting through the ending credits.
const PANTHEON = ['hwanwoong', 'nabihalmang', 'poongbaek', 'woosa', 'woonsa'];

/**
 * CHAPTER 7 — Return to Sudo City: Professor Song's Revelation + Rival Battle #3.
 * A cutscene scene: Prof. Song explains the Team Suri vs. 노스단 plot and 나비할망,
 * then the Rival challenges you to one last battle with his fully-evolved starter.
 */
export class SudoLabScene extends Phaser.Scene {
  public interior3D = true;
  public clearSight3D = true;
  public disable3D = false;
  private playerG!: Phaser.GameObjects.Graphics;
  private dialog!: DialogBox;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private px = 0; private py = 0; private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private busy = false;
  private ending = false;
  private endingVideoAction?: () => void;

  constructor() { super('SudoLabScene'); }

  preload() {
    // Load the pantheon + the player's own party so the credits can parade them.
    const keys = new Set<string>(PANTHEON);
    for (const e of PartySystem.get(this.registry)) if (e.spriteKey) keys.add(e.spriteKey);
    for (const k of keys) {
      if (this.textures.exists(k)) continue;
      const url = dexEntry(k)?.spriteUrl;
      if (url) this.load.image(k, url);
    }
    // Decode only the small looping mix track here. The 195 MB movie itself is
    // streamed on demand so entering the final Sudo scene never waits for the
    // whole five-minute file to download, especially on mobile.
    if (this.registry.get('finalePartyPending') && !this.cache.audio.exists('endingcredits')) {
      this.load.audio('endingcredits', TRACKS.endingcredits);
    }
  }

  create() {
    this.disable3D = false;
    this.ending = false;
    this.endingVideoAction = undefined;
    playBgm(this, 'sudo');
    this.input.keyboard?.resetKeys();
    this.cameras.main.fadeIn(400);
    this.drawLab();
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'),
      left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D'),
    };
    this.px = this.scale.width * 0.5; this.py = this.scale.height * 0.82;

    const rivalDone = !!this.registry.get('trainerDefeated_rival-3');
    const partyPending = !!this.registry.get('sudoPartyPending');
    const finalePending = !!this.registry.get('finalePartyPending');

    if (finalePending) {
      // THE ENDING — one last celebration in Sudo City after catching 환웅, then credits.
      this.busy = true;
      this.registry.remove('finalePartyPending');
      SaveManager.save(this.registry, 0, 0, 'SudoLabScene');
      this.dialog.show([
        'You beat 노스단 to the summit, defeated Sovereign Clemont, and 환웅 itself descended to your side. The threat is over.',
        'You come home to a hero\'s welcome — and the party the alarm cut short picks up right where it left off, louder than ever.',
        'The whole region floods the streets. Lanterns, music, confetti; north and south celebrating as one people for the first time in living memory.',
        'Prof. Song: 노스단 is finished. 환웅, 풍백, 우사, 운사, 나비할망 — the entire pantheon, at peace and in your care.',
        'Prof. Song: Whatever legend they tell of this region a thousand years from now, it starts with you. Thank you, Champion.',
        '🎉 The city celebrates deep into the night in your honour.',
        '— Later, when the lanterns have burned low, the Rival finds you alone. —',
        'Rival: ...We really did it. Every gym, both leagues, a whole syndicate, and a god at the end of it.',
        'Rival: So — what now? Are you going to keep adventuring from here?',
        '(You look out over the sleeping region — north and south, whole at last. Wherever the road goes next... it\'s yours to walk.)',
      ], () => { this.busy = false; this.rollCredits(); });
      return;
    }

    if (partyPending) {
      // Northern League victory celebration party
      this.busy = true;
      this.registry.remove('sudoPartyPending');
      this.registry.set('sudoPartyDone', true);
      // This IS the post-league celebration — skip the alternate Capitol reunion party
      // so the player heads straight for the Ancient Altar shortcut to the Sacred Peak.
      this.registry.set('northReunionSeen', true);
      SaveManager.save(this.registry, 0, 0, 'SudoLabScene');
      this.dialog.show([
        'The Northern League throws a party in your honour — the whole city out in the streets, cheering the Champion who united north and south.',
        'Rival: I never thought anyone would beat Taewang. But it\'s you — so of course you did.',
        '📟 Then, mid-celebration, your Pokédex screams an alarm. Prof. Song\'s face drains of colour.',
        'Prof. Song: It\'s 노스단. They\'re moving on the Onseong Mountains — RIGHT NOW — racing to reach 환웅 (Hwanung), the Sovereign Who Descended, before anyone can stop them.',
        'Prof. Song: They\'ve sealed the whole range behind their lines. But there is another way in — the 고대 제단 (Ancient Altar) opens a hidden stair straight to the Sacred Peak.',
        'Rival: The party can wait. Go — we\'ll hold things here. Beat them to the top, Champion!',
        '🎉 The music fades behind you as you race for the Onseong Mountains...',
      ], () => {
        this.busy = false;
        this.cameras.main.fadeOut(500, 0, 0, 0, () => {
          this.registry.set('capitalReturnX', 24 * 32 + 16);
          this.registry.set('capitalReturnY', 31 * 32 + 16);
          this.scene.start('CapitolCityScene');
        });
      });
      return;
    }

    if (rivalDone && !this.registry.get('sudoRivalAftermathSeen')) {
      // Returned from Rival Battle #3 → closing beat, then head onward.
      this.busy = true;
      this.registry.set('chapter7Done', true);
      this.registry.set('sudoRivalAftermathSeen', true);
      SaveManager.save(this.registry, 3 * 32, 12 * 32, 'HaeanCityScene');
      this.dialog.show([
        "Rival: ...You really are something. Okay. Let's go save a giant moth grandmother.",
        "Rival: A sentence I never thought I'd say.",
        "Prof. Song: 노스단 has already moved south, toward the Jeju vents. There's no time to lose.",
        "Prof. Song: Protect 나비할망 — and through her, the whole south. Go. Now.",
        "▶ Chapter 8 — Route 5 & the Ancient Forest — continues your journey south.",
      ], () => this.leaveLab('HaeanCityScene'));
      return;
    }

    // The lab is now a normal, revisitable Capitol building. Do not start the
    // Chapter 7 rival battle before the Ancient Keeper Badge (the 5th), or repeat it later.
    if (!this.registry.get('forestGymDefeated') || this.registry.get('chapter7Done')) {
      this.busy = true;
      this.dialog.show([
        'Prof. Song: Welcome back. The lab is always open when you need a place to review your journey.',
        'Prof. Song: Keep your team healthy, and come see me whenever the Pokédex turns up something unusual.',
      ], () => { this.busy = false; });
      return;
    }

    // First arrival → the revelation.
    this.busy = true;
    this.dialog.show([
      'You hurry across 소올 to Professor Song\'s lab.',
      '(Two maps cover the wall: red pins mark Team Suri digs, black pins mark 노스단 installations.)',
      "Prof. Song: Thank you for coming so fast. I finally understand what we're facing.",
      "Prof. Song: Team Suri wants to wake the Spirit of Cheonji and control it — to heal the region. Misguided, dangerous.",
      "Prof. Song: But 노스단 doesn't care about the Spirit. They want to be PRESENT when it wakes —",
      "Prof. Song: — to harvest the catastrophic awakening energy and weaponize it against the south.",
      "Prof. Song: Team Suri is unknowingly doing 노스단's work for them.",
      "(She unrolls a faded scroll painting of a vast, moth-like Pokémon.)",
      "Prof. Song: 나비할망 — the Grandmother Moth. Fairy/Steel. She sleeps near the Jeju volcanic vents.",
      "Prof. Song: Her metallic wings can ABSORB and neutralize enormous energy. 노스단 knows this.",
      "Prof. Song: If they can't harvest Cheonji directly, they'll use HER as a living battery instead.",
      "Rival: Then we protect her too. ...But first —",
      "Rival: Before we split up to cover ground, one more battle. I told you my starter would evolve.",
    ], () => this.startRivalBattle());
  }

  private startRivalBattle() {
    // This battle follows immediately after a gym and a long cutscene. Restore
    // the full party here so story progression never punishes skipped healing.
    PartySystem.healAll(this.registry);
    // Rival's team is built around his OWN fully-evolved starter (the opposite type
    // the rival chose at the lab). Use rivalKey — starterKey can be changed by setLead.
    const rivalKey = (this.registry.get('rivalKey') as string) ?? 'vipour';
    const rivalFinal = rivalKey === 'munkain' ? 'banderado'    // rival Grass → Banderado
      : rivalKey === 'vipour' ? 'feldaconda'                    // rival Fire  → Feldaconda
      : 'thanatoat';                                            // rival Water → Thanatoat

    this.registry.set('trainerName', 'Rival');
    this.registry.set('trainerKey', 'rival-3');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 0, level: 35, custom: 'martbadger' },   // Dark/Steel (evolved)
      { id: 0, level: 36, custom: 'squirrel2' },     // Soarrel — Normal/Flying (evolved)
      { id: 0, level: 37, custom: 'tokkigongju' },   // Dark/Fairy ace support
      { id: 0, level: 39, custom: rivalFinal },       // Starter FINAL evo (opposite type)
    ]));
    this.registry.set('trainerExpPool', 1500);
    this.registry.set('trainerReturnScene', 'SudoLabScene');
    SaveManager.save(this.registry, 0, 0, 'SudoLabScene');
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private drawLab() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    // Bright research-lab walls / floor
    g.fillStyle(0xdfe6f2, 1); g.fillRect(0, 0, W, H);                  // pale walls
    g.fillStyle(0xf3f7fc, 0.55); g.fillRect(0, 0, W, H * 0.14);        // ceiling light glow
    g.fillStyle(0xb8c2d4, 1); g.fillRect(0, H * 0.62, W, H * 0.38);    // light tiled floor
    g.lineStyle(1, 0xa4afc2, 0.6);
    for (let fx = 64; fx < W; fx += 64) g.lineBetween(fx, H * 0.62, fx, H);
    // Map boards with red + black pins
    g.fillStyle(0x0e1626, 1); g.fillRect(W * 0.10, H * 0.12, W * 0.34, H * 0.34);
    g.fillStyle(0x0e1626, 1); g.fillRect(W * 0.56, H * 0.12, W * 0.34, H * 0.34);
    g.fillStyle(0xdd3333, 1);
    for (let i = 0; i < 9; i++) g.fillCircle(W * 0.12 + Math.random() * W * 0.30, H * 0.14 + Math.random() * H * 0.30, 4);
    g.fillStyle(0x111111, 1);
    for (let i = 0; i < 9; i++) g.fillCircle(W * 0.58 + Math.random() * W * 0.30, H * 0.14 + Math.random() * H * 0.30, 4);
    // Lab bench + equipment
    g.fillStyle(0x9aa6ba, 1); g.fillRect(0, H * 0.58, W, 14);
    // Healing machine (right)
    g.fillStyle(0xeef2f8, 1); g.fillRect(W * 0.80, H * 0.47, W * 0.12, H * 0.13);
    g.fillStyle(0xcc3344, 1); g.fillRect(W * 0.855, H * 0.505, 18, 6); g.fillRect(W * 0.855 + 6, H * 0.505 - 6, 6, 18);
    // Bookshelves (far left)
    g.fillStyle(0x8a6a44, 1); g.fillRect(W * 0.015, H * 0.22, W * 0.055, H * 0.36);
    g.fillStyle(0x5f4630, 1); for (let by = 1; by < 6; by++) g.fillRect(W * 0.015, H * 0.22 + by * (H * 0.06), W * 0.055, 3);
    // Research terminal on the bench (between the map boards)
    g.fillStyle(0x14202e, 1); g.fillRect(W * 0.46, H * 0.50, W * 0.08, H * 0.08);
    g.fillStyle(0x55ddcc, 0.9); g.fillRect(W * 0.47, H * 0.51, W * 0.06, H * 0.05);
    // Potted plant
    g.fillStyle(0x6a4a2a, 1); g.fillRect(W * 0.15, H * 0.53, 22, 20);
    g.fillStyle(0x3a8a4a, 1); g.fillCircle(W * 0.15 + 11, H * 0.51, 15);

    this.add.text(W / 2, 28, tr("🔬 Professor Song's Lab — Sudo City (수도 시티)"), {
      fontSize: '15px', color: '#12325a', fontStyle: 'bold', backgroundColor: '#ffffffaa', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(5);

    // Professor Song (white-coat figure)
    const k = this.add.graphics().setDepth(6);
    k.setPosition(W * 0.36, H * 0.6);
    k.fillStyle(0x000000, 0.2); k.fillEllipse(0, 30, 40, 12);
    k.fillStyle(0xf0f0f0); k.fillRect(-18, -20, 36, 50);   // lab coat
    k.fillStyle(0xffcc99); k.fillRect(-14, -54, 28, 30);   // head
    k.fillStyle(0x553311); k.fillRect(-14, -54, 28, 12);   // hair
    k.fillStyle(0x000000); k.fillRect(-8, -42, 5, 5); k.fillRect(3, -42, 5, 5);
    markTrainerPortrait(k, 'prof-song');
    this.add.text(W * 0.36, H * 0.6 - 76, speakerName('Prof. Song'), {
      fontSize: '11px', color: '#cfe3ff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(7);

    // Rival
    const r = this.add.graphics().setDepth(6);
    r.setPosition(W * 0.6, H * 0.62);
    r.fillStyle(0x000000, 0.2); r.fillEllipse(0, 28, 36, 11);
    r.fillStyle(0x2255cc); r.fillRect(-16, -18, 32, 46);
    r.fillStyle(0xffcc99); r.fillRect(-12, -48, 24, 28);
    r.fillStyle(0x221100); r.fillRect(-12, -48, 24, 10);
    r.fillStyle(0x000000); r.fillRect(-7, -38, 4, 4); r.fillRect(3, -38, 4, 4);
    markRivalPortrait(r, this.registry);
    this.add.text(W * 0.6, H * 0.62 - 70, speakerName('Rival'), {
      fontSize: '11px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(7);

    this.add.text(W / 2, H - 12, tr('Arrows / WASD: move   ·   SPACE: exit'), {
      fontSize: '11px', color: '#2a3f60', backgroundColor: '#ffffffaa', padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(8);

    // A concrete player anchor lets the overworld 3D mirror build this room as
    // an interior instead of leaving it as a flat full-screen cutscene.
    this.playerG = this.add.graphics().setDepth(7);
    drawTrainerBody(this.playerG, 1, 0, playerDesign(this.registry));
    this.playerG.setPosition(W * 0.5, H * 0.82);
  }

  private leaveLab(scene?: string) {
    const target = scene ?? (this.registry.get('sudoLabReturnScene') as string | undefined) ?? 'HaeanCityScene';
    this.registry.remove('sudoLabReturnScene');
    this.busy = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      if (target === 'CapitolCityScene') {
        this.registry.set('capitalReturnX', 56 * 32 + 16);
        this.registry.set('capitalReturnY', 14 * 32 + 16);
      } else {
        this.registry.set('haeanCityReturnX', 3 * 32);
        this.registry.set('haeanCityReturnY', 12 * 32);
      }
      this.scene.start(target);
    });
  }

  update(_t: number, dt: number) {
    if (this.ending) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        if (this.endingVideoAction) this.endingVideoAction();
        else this.endGame();
      }
      return;
    }
    if (this.busy) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    // Free to walk the lab (arrows / WASD); SPACE leaves by the door.
    this.walkLab(dt);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.leaveLab();
  }

  private walkLab(dt: number) {
    const W = this.scale.width, H = this.scale.height;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    else if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    else if (this.cursors.down.isDown  || this.wasd.down.isDown) { dy = 1; this.facing = 0; }
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1, speed = 0.24 * dt;
      this.px = Phaser.Math.Clamp(this.px + (dx / len) * speed, 60, W - 60);
      this.py = Phaser.Math.Clamp(this.py + (dy / len) * speed, H * 0.60, H * 0.92);
      this.walkTimer += dt;
      if (this.walkTimer > 130) { this.walkTimer = 0; this.walkFrame = (this.walkFrame + 1) % 4; }
    }
    this.playerG.clear();
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }

  /** Stream the authored ending movie and mix its original audio with the
   * looping game credits theme, then return to the title. */
  private rollCredits() {
    this.cameras.main.fadeOut(1000, 0, 0, 0, () => {
      // Free the complete laboratory display list and let Engine3D release its
      // hidden world before decoding a 1080p movie on memory-constrained phones.
      this.destroyDisplayList();
      this.ending = true;
      this.disable3D = true;
      playBgm(this, 'endingcredits');
      const mixedBgm = this.registry.get('bgmSound') as (Phaser.Sound.BaseSound & {
        setVolume?: (value: number) => unknown;
      }) | undefined;
      mixedBgm?.setVolume?.(ENDING_BGM_VOLUME);
      this.cameras.main.fadeIn(1000);
      this.endingVideoAction = playEndingCreditsVideo(
        this,
        () => this.endGame(),
        () => {
          this.endingVideoAction = undefined;
          this.rollLegacyCredits();
        },
      );
    });
  }

  /** Codec/network fallback retained so the true ending never soft-locks on a
   * browser that cannot decode H.264. The mixed BGM continues underneath. */
  private rollLegacyCredits() {
    if (!this.ending) return;
    const W = this.scale.width, H = this.scale.height;
    this.destroyDisplayList();
    this.add.rectangle(W / 2, H / 2, W, H, 0x05070f, 1).setDepth(200);
    const stars = this.add.graphics().setDepth(201);
    for (let i = 0; i < 130; i++) {
      stars.fillStyle(0xffffff, Math.random() * 0.7 + 0.2);
      stars.fillCircle(Math.random() * W, Math.random() * H, Math.random() < 0.15 ? 2 : 1);
    }

    const showcase = [...PANTHEON, ...PartySystem.get(this.registry).map(e => e.spriteKey)]
      .filter((k, i, a) => k && this.textures.exists(k) && a.indexOf(k) === i);
    showcase.forEach((k, i) => {
      const x = (W / (showcase.length + 1)) * (i + 1);
      const img = this.add.image(x, H + 100 + Math.random() * H, k).setDepth(202).setAlpha(0.9);
      const src = this.textures.get(k).getSourceImage();
      img.setScale(120 / Math.max((src.width as number) || 1, (src.height as number) || 1));
      this.tweens.add({ targets: img, y: -140, duration: 13000 + Math.random() * 9000, delay: i * 500, repeat: -1, ease: 'Linear' });
      this.tweens.add({ targets: img, x: x + (Math.random() * 50 - 25), duration: 2600 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: img, angle: Math.random() * 8 - 4, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    const credits = [
      '🌟  POKÉMON  KOREA  🌟', '', '', 'THE COMPLETE PANTHEON', '환웅 · 풍백 · 우사 · 운사 · 나비할망', '', '— TRUE END —', '', '',
      'You crossed all of Onnuri —', 'south and north, sea and summit —', 'and united a broken peninsula', 'under a single Champion.', '', '',
      'Thank you for playing.', '', '', 'Press SPACE to return to the title.',
    ].join('\n');
    const text = this.add.text(W / 2, H + 40, credits, {
      fontSize: '20px', color: '#ffe88a', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 4, lineSpacing: 12,
    }).setOrigin(0.5, 0).setDepth(204);
    this.tweens.add({
      targets: text, y: -text.height - 40, duration: 20000, ease: 'Linear',
      onComplete: () => this.time.delayedCall(800, () => this.endGame()),
    });
  }

  private endGame() {
    if (!this.ending) return;
    this.ending = false;
    this.endingVideoAction = undefined;
    this.cameras.main.fadeOut(1000, 0, 0, 0, () => this.scene.start('TitleScene'));
  }

  private destroyDisplayList(): void {
    // DisplayList.removeAll(true) means "skip callbacks", not "destroy". Use a
    // snapshot so textures/containers actually release before 1080p playback.
    for (const child of [...this.children.list]) child.destroy();
  }
}
