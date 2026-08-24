import Phaser from 'phaser';

// ── UI sound effects ─────────────────────────────────────────────────────────
// Short synthesised blips for menu interaction. Synthesised through the same
// WebAudio context Phaser already owns, so there are no new audio assets to
// ship and nothing to preload — and, like the battle hit sounds, a suspended
// context is resumed first so a click never lands silently.

type Voice = (ac: AudioContext, at: number) => void;

function withContext(scene: Phaser.Scene, voice: Voice): void {
  if (scene.game.registry.get('bgmMuted')) return;
  const mgr = scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ac = mgr && mgr.context;
  if (!ac) return;                                  // HTML5 audio fallback — skip
  const run = () => voice(ac, ac.currentTime + 0.02);
  if (ac.state === 'suspended') ac.resume().then(run).catch(() => { /* gesture-locked */ });
  else run();
}

/** A single decaying sine "pip" — the building block for every UI sound. */
function pip(
  ac: AudioContext, at: number,
  freq: number, dur: number, gain: number,
  type: OscillatorType = 'sine',
  glideTo?: number,
): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g); g.connect(ac.destination);
  osc.start(at); osc.stop(at + dur + 0.02);
}

/** Cursor moved to another option — a soft, quick tick. */
export function sfxMove(scene: Phaser.Scene): void {
  withContext(scene, (ac, at) => {
    pip(ac, at, 880, 0.07, 0.10, 'triangle');
  });
}

/** A Poké Ball opening — a bright two-note chime with a little air. */
export function sfxBallOpen(scene: Phaser.Scene): void {
  withContext(scene, (ac, at) => {
    pip(ac, at, 660, 0.09, 0.13, 'triangle', 990);
    pip(ac, at + 0.07, 1320, 0.16, 0.10, 'sine');
    // A whisper of noise for the "shhk" of the shell splitting.
    const dur = 0.14;
    const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const k = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - k) * (1 - k) * 0.6;
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600;
    const g = ac.createGain(); g.gain.value = 0.10;
    src.connect(bp); bp.connect(g); g.connect(ac.destination);
    src.start(at); src.stop(at + dur);
  });
}

/** Confirming a choice — a rising major triad. */
export function sfxConfirm(scene: Phaser.Scene): void {
  withContext(scene, (ac, at) => {
    pip(ac, at, 660, 0.1, 0.12, 'triangle');
    pip(ac, at + 0.08, 880, 0.1, 0.12, 'triangle');
    pip(ac, at + 0.16, 1320, 0.22, 0.13, 'sine');
  });
}

/** Field item obtained — the familiar bright pickup fanfare. A glassy rising
 * arpeggio and short octave resolve make rare finds read clearly even without
 * shipping another compressed audio file. */
export function sfxItemGet(scene: Phaser.Scene): void {
  withContext(scene, (ac, at) => {
    pip(ac, at,        523.25, 0.11, 0.12, 'triangle');
    pip(ac, at + 0.08, 659.25, 0.11, 0.12, 'triangle');
    pip(ac, at + 0.16, 783.99, 0.13, 0.13, 'triangle');
    pip(ac, at + 0.25, 1046.5, 0.30, 0.14, 'sine');
    pip(ac, at + 0.29, 1567.9, 0.24, 0.07, 'sine');
  });
}

/** Backing out / cancelling — a short falling blip. */
export function sfxCancel(scene: Phaser.Scene): void {
  withContext(scene, (ac, at) => {
    pip(ac, at, 520, 0.12, 0.10, 'triangle', 300);
  });
}
