import Phaser from 'phaser';
import { pushBgm, popBgm } from '../systems/Music';
import { findPendingEvolution, applyEvolution, PendingEvolution } from '../systems/EvolutionSystem';
import { SaveManager } from '../utils/SaveManager';
import { findForm } from '../data/StarterData';
import { customForm } from '../data/CustomBattle';
import { POKEDEX, dexKeyFor } from '../data/Pokedex';
import { tr } from '../systems/i18n';

/** Evolution art uses its own texture namespace. A battle or menu scene can
 *  remove/reload the ordinary species key while this modal is opening; sharing
 *  that key left Phaser's missing-texture X in place of the evolved Pokémon. */
export function evolutionTextureKey(key: string): string {
  return `evolution-${key.toLowerCase()}`;
}

/** Resolve the correct sprite URL for any starter/custom/dex key. */
export function evolutionSpriteUrlForKey(key: string): string {
  const f = findForm(key);
  if (f) return f.data.spriteUrl;
  const c = customForm(key);
  if (c) return c.data.spriteUrl;
  // Also check the full Pokédex (covers dex-only customs like ssangdungori, and
  // PokéAPI mons whose party key `wild-<id>` maps to the `api-<id>` dex entry).
  const dk = dexKeyFor(key);
  const d = POKEDEX.find(e => e.key === key || e.key === dk);
  if (d) return d.spriteUrl;
  return `assets/dex/${key}.png`;   // safe fallback
}

/**
 * Modal overlay that plays the evolution animation for every pending
 * party Pokémon in sequence, then resumes the parent scene.
 */
export class EvolutionScene extends Phaser.Scene {
  private parentKey = 'WorldMapScene';
  private oldSprite!: Phaser.GameObjects.Image;
  private newSprite!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private dialogText!: Phaser.GameObjects.Text;
  private current!: PendingEvolution;
  private leaving = false;

  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super('EvolutionScene'); }

  init(data: { parentKey?: string }) {
    this.parentKey = data.parentKey ?? 'WorldMapScene';
  }

  preload() {
    const p = findPendingEvolution(this.registry);
    if (p) {
      for (const key of [p.fromKey, p.toKey]) {
        const textureKey = evolutionTextureKey(key);
        if (!this.textures.exists(textureKey)) {
          this.load.image(textureKey, evolutionSpriteUrlForKey(key));
        }
      }
    }
  }

  create() {
    this.scene.bringToTop();
    this.leaving = false;
    pushBgm(this, 'evolution');   // evolution theme; parent's ambient restores when done
    // Dark starry backdrop
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x05050f, 1);
    for (let i = 0; i < 60; i++) {
      this.add.arc(
        Phaser.Math.Between(0, this.W), Phaser.Math.Between(0, this.H),
        Math.random() < 0.2 ? 2 : 1, 0, 360, false, 0xffffff, Math.random() * 0.6 + 0.2,
      );
    }

    this.flash = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0xffffff, 0)
      .setDepth(20);

    this.dialogText = this.add.text(this.W / 2, this.H - 80, '', {
      fontSize: '20px', color: '#ffffff', align: 'center', fontStyle: 'bold',
      wordWrap: { width: this.W - 80 }, lineSpacing: 6,
    }).setOrigin(0.5).setDepth(15);

    this.processNext();
  }

  // ── Sequence ────────────────────────────────────────────────────────────────

  private processNext() {
    const pending = findPendingEvolution(this.registry);
    if (!pending) { this.finish(); return; }
    this.current = pending;
    // preload() can only know the first pending party member. If several party
    // members evolve in sequence, load each later pair before constructing its
    // images instead of letting Phaser draw a missing-texture X.
    void this.ensureEvolutionTextures(pending).then(ready => {
      if (!this.scene.isActive()) return;
      if (!ready) {
        console.error(`[EvolutionScene] Failed to load evolution art: ${pending.fromKey} -> ${pending.toKey}`);
        // Keep the modal alive and retry the local asset rather than completing
        // an evolution whose new form was never shown.
        this.time.delayedCall(500, () => this.processNext());
        return;
      }
      this.playEvolution(pending);
    });
  }

  private async ensureEvolutionTextures(p: PendingEvolution): Promise<boolean> {
    const keys = [p.fromKey, p.toKey];
    const missing = keys.filter(key => !this.textures.exists(evolutionTextureKey(key)));
    if (!missing.length) return true;

    for (const key of missing) {
      this.load.image(evolutionTextureKey(key), evolutionSpriteUrlForKey(key));
    }
    await new Promise<void>(resolve => {
      this.load.once(Phaser.Loader.Events.COMPLETE, resolve);
      this.load.start();
    });
    return keys.every(key => this.textures.exists(evolutionTextureKey(key)));
  }

  private fitSprite(img: Phaser.GameObjects.Image, size: number) {
    const tex = this.textures.get(img.texture.key).getSourceImage();
    const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
    img.setScale(size / dim);
  }

  private playEvolution(p: PendingEvolution) {
    const cx = this.W / 2, cy = this.H / 2 - 30;

    // Clean up any previous sprites
    this.oldSprite?.destroy();
    this.newSprite?.destroy();

    this.oldSprite = this.add.image(cx, cy, evolutionTextureKey(p.fromKey)).setDepth(10);
    this.newSprite = this.add.image(cx, cy, evolutionTextureKey(p.toKey)).setDepth(10).setAlpha(0);
    this.fitSprite(this.oldSprite, 260);
    this.fitSprite(this.newSprite, 280);

    this.typeText(`What? ${p.fromName} is evolving!`, () => {
      // Pulsing scale flicker between old and new
      let toggles = 0;
      const maxToggles = 10;
      const pulse = () => {
        toggles++;
        const showNew = toggles % 2 === 1;
        this.oldSprite.setAlpha(showNew ? 0 : 1);
        this.newSprite.setAlpha(showNew ? 1 : 0);
        // Tint white during transition
        const tint = 0x99ccff;
        this.oldSprite.setTint(tint);
        this.newSprite.setTint(tint);
        const delay = Math.max(70, 320 - toggles * 25);
        if (toggles < maxToggles) {
          this.time.delayedCall(delay, pulse);
        } else {
          this.finishPulse(p);
        }
      };
      this.time.delayedCall(300, pulse);
    });
  }

  private finishPulse(p: PendingEvolution) {
    // White flash burst
    this.tweens.add({
      targets: this.flash, alpha: { from: 0, to: 1 }, duration: 250, yoyo: true,
      onComplete: () => {
        this.oldSprite.setVisible(false);
        this.newSprite.setAlpha(1).clearTint();
        // Apply evolution to saved party. Save under the scene that launched the
        // evolution (NOT the WorldMap default), keeping the tracked position.
        applyEvolution(this.registry, p);
        const sx = (this.registry.get('lastX') as number) ?? 0;
        const sy = (this.registry.get('lastY') as number) ?? 0;
        SaveManager.save(this.registry, sx, sy, this.parentKey);

        // Sparkle burst
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const star = this.add.text(this.W / 2, this.H / 2 - 30, '✨', { fontSize: '20px' }).setDepth(12);
          this.tweens.add({
            targets: star,
            x: this.W / 2 + Math.cos(ang) * 120,
            y: this.H / 2 - 30 + Math.sin(ang) * 120,
            alpha: 0, duration: 900, onComplete: () => star.destroy(),
          });
        }

        this.typeText(`Congratulations! Your ${p.fromName}\nevolved into ${p.toName}!`, () => {
          this.time.delayedCall(800, () => this.processNext());
        });
      },
    });
  }

  private finish() {
    // All evolutions done — let the evolution theme's ending play out (on the
    // "Congratulations" screen) before fading back to the overworld.
    const snd = this.registry.get('bgmSound') as Phaser.Sound.WebAudioSound | undefined;
    if (snd && this.registry.get('bgmKey') === 'evolution' && snd.duration) {
      const ENDBIT = 6;   // jump to the final ~6s so the resolution/fanfare is heard
      const start = Math.max(0, snd.duration - ENDBIT);
      snd.once('complete', () => this.leave());
      try { snd.play({ seek: start, loop: false }); } catch { snd.loop = false; }
      this.time.delayedCall((ENDBIT + 2) * 1000, () => this.leave());   // safety net
    } else {
      this.leave();
    }
  }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => {
      popBgm(this);   // restore the overworld track before handing control back
      this.scene.resume(this.parentKey);
      this.scene.stop();
    });
  }

  // ── Typewriter ──────────────────────────────────────────────────────────────

  private typeText(text: string, onDone?: () => void) {
    text = tr(text);
    this.dialogText.setText('');
    let i = 0;
    const ev = this.time.addEvent({
      delay: 28, repeat: text.length - 1,
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) {
          ev.destroy();
          if (onDone) this.time.delayedCall(500, onDone);
        }
      },
    });
  }
}
