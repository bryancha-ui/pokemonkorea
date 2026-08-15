import Phaser from 'phaser';
import { playBgm, TRACKS } from '../systems/Music';
import { t, tr } from '../systems/i18n';

// ── New-game opening — Professor Song's welcome ──────────────────────────────
// The very first thing a new game shows: Dr. Song Nam-woo (송남우 교수) steps out
// of the dark and explains the world of Pokémon, then hands off to the boy/girl
// character select. Classic "Welcome to the world of Pokémon!" framing.

const SONG_KEY = 'npc_song';
const SONG_URL = 'assets/npc/npc_song.webp';

const LINES: string[] = [
  'Hello there! Welcome to the world of Pokémon!',
  'My name is Song. Song Nam-woo. But everyone in the region simply calls me the Professor.',
  'This world is inhabited far and wide by wonderful creatures called Pokémon. We live alongside them — as friends, as partners, and sometimes as rivals in battle.',
  'This land is the Onnuri region: a peninsula of pine-needle towns and misty highlands, of volcanic isles in the south and a cold, watchful North.',
  'For some, Pokémon are beloved companions. For others, they are a subject of study. I have devoted my whole life to understanding the bond between people and Pokémon.',
  'Your very own story is about to unfold. A world of dreams and adventures with Pokémon awaits! Let\'s go!',
  'But first — tell me a little about yourself. Are you a boy? Or are you a girl?',
];

export class IntroScene extends Phaser.Scene {
  private idx = 0;
  private textObj!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private portrait?: Phaser.GameObjects.Image;
  private currentLine = '';
  private typingEvent?: Phaser.Time.TimerEvent;
  private busy = false;

  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super('IntroScene'); }

  preload() {
    if (!this.textures.exists(SONG_KEY)) this.load.image(SONG_KEY, SONG_URL);
    // Preload the intro theme so it can start instantly and cleanly (no lazy-load gap).
    if (!this.cache.audio.exists('professorintro') && TRACKS.professorintro) this.load.audio('professorintro', TRACKS.professorintro);
  }

  create() {
    this.idx = 0;
    // ── Hard-separate Prof. Song's intro music ──────────────────────────────────
    // Destroy EVERY lingering / queued sound before starting. On mobile the audio
    // context is locked until the first touch; the Title track's play() call is
    // queued and then resumes on that first tap — so it can slip in UNDER the intro
    // theme even after a plain stop(). Destroying the sound objects removes them from
    // the manager entirely, so nothing can resume. Then start the intro theme alone.
    this.sound.stopAll();
    const mgr = this.sound as unknown as { sounds?: Phaser.Sound.BaseSound[] };
    (mgr.sounds ?? []).slice().forEach((s) => { try { s.destroy(); } catch { /* already gone */ } });
    this.registry.remove('bgmSound'); this.registry.remove('bgmKey'); this.registry.remove('bgmWanted');
    playBgm(this, 'professorintro');
    this.cameras.main.fadeIn(500);
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x080a14, 1);

    // Soft spotlight behind the professor
    this.add.ellipse(this.W / 2, this.H / 2 - 40, 520, 520, 0x1a2748, 0.55);

    if (this.textures.exists(SONG_KEY)) {
      const img = this.add.image(this.W / 2, this.H / 2 - 60, SONG_KEY);
      const src = this.textures.get(SONG_KEY).getSourceImage();
      img.setScale(Math.min(380 / (src.width as number), 430 / (src.height as number)));
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 700, ease: 'Sine.easeOut' });
      this.portrait = img;
    }

    // Name plate
    this.add.text(this.W / 2, 40, t('PROF. SONG', '송 박사'), {
      fontSize: '15px', color: '#ffe44e', fontStyle: 'bold', letterSpacing: 3,
      backgroundColor: '#00000066', padding: { x: 10, y: 5 },
    }).setOrigin(0.5);

    // Dialog box
    const boxY = this.H - 96;
    this.add.rectangle(this.W / 2, boxY, this.W - 60, 132, 0x0d0d2e, 0.96).setStrokeStyle(2, 0x5577aa);
    this.textObj = this.add.text(50, boxY - 48, '', {
      fontSize: '17px', color: '#ffffff', lineSpacing: 7,
      wordWrap: { width: this.W - 100 },
    }).setOrigin(0, 0);
    this.prompt = this.add.text(this.W - 44, boxY + 44, '▼', { fontSize: '16px', color: '#ffe44e' })
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.prompt, alpha: 1, duration: 500, yoyo: true, repeat: -1 });

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.advance());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => this.advance());
    this.input.on('pointerdown', () => this.advance());

    this.showLine();
  }

  private showLine() {
    this.busy = true;
    this.currentLine = tr(LINES[this.idx]);
    this.textObj.setText('');
    let i = 0;
    // simple typewriter reveal
    this.typingEvent?.destroy();
    this.typingEvent = this.time.addEvent({
      delay: 18, repeat: this.currentLine.length - 1,
      callback: () => {
        this.textObj.setText(this.currentLine.slice(0, ++i));
        if (i >= this.currentLine.length) {
          this.typingEvent = undefined;
          this.busy = false;
        }
      },
    });
  }

  private advance() {
    if (this.busy) {
      // reveal the whole line instantly on the first tap
      this.typingEvent?.destroy();
      this.typingEvent = undefined;
      this.textObj.setText(this.currentLine);
      this.busy = false;
      return;
    }
    this.idx++;
    if (this.idx >= LINES.length) { this.finish(); return; }
    this.showLine();
  }

  private finish() {
    this.input.enabled = false;
    this.tweens.add({ targets: this.portrait, alpha: 0, duration: 400 });
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('GenderSelectScene'));
  }
}
