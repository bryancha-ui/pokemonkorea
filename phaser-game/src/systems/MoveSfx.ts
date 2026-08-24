import Phaser from 'phaser';

// ── Type-flavoured move sound effects ────────────────────────────────────────
// Every move used to land on the same filtered-noise thud, so a Flamethrower and
// a Karate Chop were audibly identical. Each type now has its own voice: fire
// crackles, fighting cracks like a snapped pine board, steel rings, ice chimes.
//
// All of it is SYNTHESISED through the WebAudio context Phaser already owns —
// the same approach as UiSfx and the existing hit sting. Eighteen types would
// otherwise mean shipping thirty-odd compressed audio files and preloading them
// on a phone, and this way the whole set costs nothing to download and can never
// be missing when a move resolves.
//
// Purely presentational. Nothing here reads or writes battle state.

/** Which half of the move a voice belongs to. */
export type MovePhase = 'cast' | 'impact';

type Ctx = { ac: AudioContext; at: number; out: GainNode };

// ── Primitives ───────────────────────────────────────────────────────────────

/** A decaying noise burst shaped by one filter — the workhorse for anything
 *  textural: flame, wind, water, stone, static. */
function noise(
  c: Ctx, dur: number, gain: number,
  filter: BiquadFilterType, freq: number, q = 1,
  sweepTo?: number, curve: 'linear' | 'exp' = 'exp',
): void {
  const { ac, at } = c;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const k = i / len;
    d[i] = (Math.random() * 2 - 1) * (curve === 'exp' ? (1 - k) * (1 - k) : 1 - k);
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), at + dur);
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.out);
  src.start(at); src.stop(at + dur + 0.02);
}

/** A pitched tone with an envelope; optionally glides. */
function tone(
  c: Ctx, freq: number, dur: number, gain: number,
  type: OscillatorType = 'sine', glideTo?: number, delay = 0,
): void {
  const { ac } = c;
  const t0 = c.at + delay;
  const osc = ac.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.out);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

/** A struck-object ring: a tone with an instant attack and a long tail. Give it
 *  inharmonic partials and it reads as metal; harmonic ones read as a bell. */
function ring(c: Ctx, freq: number, dur: number, gain: number, partials: number[]): void {
  for (const p of partials) tone(c, freq * p, dur * (1 / Math.sqrt(p)), gain / partials.length, 'sine');
}

/** Scatter short bursts across a window — crackle, bubbles, skittering. */
function scatter(c: Ctx, count: number, window: number, each: (c: Ctx, i: number) => void): void {
  for (let i = 0; i < count; i++) {
    each({ ...c, at: c.at + Math.random() * window }, i);
  }
}

// ── The eighteen voices ──────────────────────────────────────────────────────

const VOICES: Record<string, (c: Ctx, phase: MovePhase) => void> = {
  // Roaring flame plus irregular crackle — the crackle is what sells fire, so it
  // stays even on the cast, where the roar is still building.
  fire: (c, phase) => {
    noise(c, phase === 'cast' ? 0.42 : 0.3, 0.16, 'lowpass', 900, 1, 320, 'linear');
    noise(c, 0.26, 0.1, 'bandpass', 2400, 0.8);
    scatter(c, phase === 'impact' ? 9 : 6, 0.3, cc => {
      noise(cc, 0.035, 0.11, 'bandpass', 1800 + Math.random() * 3200, 6);
    });
  },
  // A surge that falls in pitch as the mass of water lands, with bubbles under it.
  water: (c, phase) => {
    noise(c, 0.38, 0.17, 'bandpass', phase === 'cast' ? 900 : 1600, 0.7, 260, 'linear');
    scatter(c, 7, 0.26, cc => tone(cc, 300 + Math.random() * 500, 0.07, 0.05, 'sine', 140));
  },
  // Leaves and stems: a dry high whoosh with a green, woody creak inside it.
  grass: (c) => {
    noise(c, 0.3, 0.13, 'highpass', 1800, 0.9, 3600);
    tone(c, 520, 0.16, 0.06, 'triangle', 300);
    scatter(c, 5, 0.2, cc => noise(cc, 0.03, 0.06, 'bandpass', 3000 + Math.random() * 2000, 5));
  },
  // Hard electrical gating: a buzz chopped into fragments, then the crack.
  electric: (c) => {
    scatter(c, 14, 0.22, cc => tone(cc, 1600 + Math.random() * 2600, 0.022, 0.09, 'square'));
    noise(c, 0.1, 0.18, 'highpass', 4200, 1);
    tone(c, 140, 0.2, 0.09, 'sawtooth', 60);
  },
  // Glass and frost: a bright inharmonic chime over a thin hiss.
  ice: (c) => {
    ring(c, 1750, 0.55, 0.13, [1, 2.31, 3.07]);
    noise(c, 0.34, 0.08, 'highpass', 5200, 0.8);
    tone(c, 2600, 0.18, 0.05, 'sine', 3400);
  },
  // 송판 격파 — a snapped pine board. The whole illusion is one very fast, very
  // bright crack (almost no decay) sitting on a hollow wooden knock; stretch the
  // crack even slightly and it stops being wood and becomes a gunshot.
  fighting: (c) => {
    noise(c, 0.035, 0.34, 'highpass', 2600, 1);
    noise(c, 0.09, 0.2, 'bandpass', 1100, 3.5);
    ring(c, 190, 0.22, 0.16, [1, 2.7]);
    tone(c, 90, 0.14, 0.12, 'triangle', 55, 0.01);
  },
  // Thick, wet, and slow — low bubbles rising through sludge.
  poison: (c) => {
    noise(c, 0.34, 0.1, 'lowpass', 700, 1, 300, 'linear');
    scatter(c, 8, 0.3, cc => tone(cc, 150 + Math.random() * 260, 0.1, 0.07, 'sine', 90));
  },
  // Weight, not brightness: sub-bass drop with grit on top.
  ground: (c) => {
    tone(c, 120, 0.42, 0.2, 'sine', 42);
    noise(c, 0.4, 0.14, 'lowpass', 420, 1, 160, 'linear');
  },
  // Air moving fast: a band of noise that rises then falls away.
  flying: (c) => {
    noise(c, 0.24, 0.13, 'bandpass', 700, 1.4, 2600, 'linear');
    noise(c, 0.26, 0.1, 'bandpass', 2400, 1.4, 600, 'linear');
  },
  // Two close tones beating against each other — an unsettling warble.
  psychic: (c) => {
    tone(c, 660, 0.5, 0.09, 'sine', 880);
    tone(c, 668, 0.5, 0.09, 'sine', 892);
    ring(c, 1320, 0.4, 0.06, [1, 1.5]);
  },
  // Dry, fast, insect-like ticking.
  bug: (c) => {
    scatter(c, 16, 0.26, cc => noise(cc, 0.018, 0.08, 'bandpass', 2400 + Math.random() * 2400, 8));
    tone(c, 240, 0.16, 0.07, 'sawtooth', 180);
  },
  // Stone on stone: a blunt crunch with a couple of loose clacks after it.
  rock: (c) => {
    noise(c, 0.16, 0.24, 'lowpass', 1200, 1);
    noise(c, 0.3, 0.1, 'bandpass', 500, 2, 220, 'linear');
    scatter(c, 3, 0.22, cc => noise(cc, 0.04, 0.12, 'bandpass', 900 + Math.random() * 900, 4));
  },
  // Hollow and airy, sliding downward — nothing solid to strike.
  ghost: (c) => {
    tone(c, 420, 0.62, 0.1, 'sine', 150);
    tone(c, 210, 0.7, 0.08, 'triangle', 90);
    noise(c, 0.5, 0.06, 'bandpass', 900, 0.6, 300, 'linear');
  },
  // A roar: stacked saws pulled down together, thick and loud.
  dragon: (c) => {
    tone(c, 220, 0.5, 0.12, 'sawtooth', 90);
    tone(c, 331, 0.46, 0.09, 'sawtooth', 132);
    noise(c, 0.42, 0.13, 'lowpass', 1800, 1, 500, 'linear');
  },
  // A swallowing low swell rather than a strike.
  dark: (c) => {
    tone(c, 180, 0.55, 0.13, 'sine', 70);
    noise(c, 0.46, 0.1, 'lowpass', 600, 1.2, 200, 'linear');
    ring(c, 320, 0.4, 0.05, [1, 1.41]);
  },
  // Struck metal: inharmonic partials that ring on well past the impact.
  steel: (c) => {
    ring(c, 620, 0.75, 0.15, [1, 1.73, 2.41, 3.19]);
    noise(c, 0.06, 0.2, 'highpass', 3600, 1);
  },
  // Bright, sweet, harmonic bells with a sparkle above them.
  fairy: (c) => {
    ring(c, 990, 0.6, 0.12, [1, 2, 3, 4]);
    scatter(c, 6, 0.3, cc => tone(cc, 2000 + Math.random() * 2000, 0.08, 0.05, 'sine'));
  },
  // Deliberately plain — the untyped thwack the base hit sound already provides.
  normal: (c) => {
    noise(c, 0.09, 0.16, 'lowpass', 1600, 1);
  },
};

/**
 * Play the voice for `type`.
 *
 * `cast` fires as the move launches and `impact` as it lands, at reduced level so
 * the two layers sit under the existing hit thud rather than fighting it.
 */
export function playMoveSfx(scene: Phaser.Scene, type: string, phase: MovePhase): void {
  if (scene.game.registry.get('bgmMuted')) return;
  const voice = VOICES[(type ?? '').toLowerCase()];
  if (!voice) return;
  const mgr = scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ac = mgr && mgr.context;
  if (!ac) return;                                   // HTML5 audio fallback — skip

  const run = () => {
    // A small lookahead: under the heavy 3D battle scenes a frame hitch can leave
    // ac.currentTime behind the audio clock, and a start time in the past
    // glitches to silence on some browsers.
    const out = ac.createGain();
    out.gain.value = phase === 'cast' ? 0.55 : 0.8;
    out.connect(ac.destination);
    voice({ ac, at: ac.currentTime + 0.02, out }, phase);
  };
  // The context auto-suspends after silent gaps (mobile power saving, long
  // battles). resume() is async, so scheduling on a still-suspended context
  // silently drops the sound — wait for it, then synthesise.
  if (ac.state === 'suspended') ac.resume().then(run).catch(() => { /* gesture-locked */ });
  else run();
}
