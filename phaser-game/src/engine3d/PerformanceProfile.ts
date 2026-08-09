export interface PerformanceProfile {
  /** Phones, tablets, or the explicit touch QA shell. */
  mobile: boolean;
  /** Devices where two simultaneous WebGL renderers need a conservative budget. */
  constrained: boolean;
  target3DFps: number;
  paused3DFps: number;
  shadowFps: number;
  maxPixelRatio: number;
  minPixelRatio: number;
  textureAnisotropy: number;
}

let cached: PerformanceProfile | null = null;

/**
 * A single capability profile shared by the Phaser/Three integration. It never
 * removes scene content: lower-budget devices keep the same scene composition,
 * lighting, sky and effects, but render the 3D underlay at a steadier cadence
 * and let its internal resolution adapt when the browser misses its frame budget.
 */
export function performanceProfile(): PerformanceProfile {
  if (cached) return cached;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const forcedTouch = new URLSearchParams(location.search).has('touch');
  const ipadDesktopMode = /Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1;
  const mobileUa = /iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobile = forcedTouch || ipadDesktopMode || mobileUa || (coarsePointer && nav.maxTouchPoints > 0);
  const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 4;
  const fewCores = nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4;
  const constrained = mobile || lowMemory || fewCores;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const maxPixelRatio = Math.min(dpr, mobile ? 1.5 : constrained ? 1.65 : 2);

  cached = {
    mobile,
    constrained,
    // Phaser gameplay and UI remain at 60 Hz. Only the expensive 3D underlay
    // is cadence-limited on mobile, which removes GPU stalls without slowing
    // movement, battle logic, dialogue, input, or audio.
    target3DFps: mobile ? 30 : constrained ? 45 : 60,
    paused3DFps: mobile ? 10 : 15,
    shadowFps: mobile ? 15 : constrained ? 22 : 30,
    maxPixelRatio,
    minPixelRatio: Math.min(maxPixelRatio, 1),
    // Preserve the existing oblique ground/model texture clarity on every tier.
    textureAnisotropy: 8,
  };
  return cached;
}
