import type { ChoreoPose } from './CharacterModel';

// ── Champion Hwangeum's stage routine ────────────────────────────────────────
// The Golden One is an idol before he is a battler, so he opens a Championship
// match the way he opens a show: a short dance, then the ball.
//
// The track is TIME-keyed rather than beat-indexed, because a throw is not
// evenly spaced. Real throwing motion is slow to gather, explosively fast
// through release, then decelerates over a long follow-through — roughly
// 700ms of windup against 80ms of whip. Uniform beats are exactly what made
// the first version read as a puppet waving its arm.
//
// The throw follows the kinetic chain that makes a thrown ball look thrown:
//   weight back → front foot strides → HIPS open first → torso uncoils →
//   shoulder → elbow leads while the forearm still trails → forearm whips
//   through → release → follow-through across the body.
// The elbow lag is the important part: the forearm is still laid back at the
// moment the elbow is already driving forward, and it snaps through late.
//
// Purely presentational. No battle state is read or written here.

export const BALL_APPEARS = 2.80;   // he produces the ball into his hand
export const RELEASE_T    = 3.50;   // it leaves his fingers
export const ROUTINE_LENGTH = 4.30;

type Ease = 'smooth' | 'snap' | 'settle';

interface Key { t: number; ease?: Ease; pose: ChoreoPose }

const KEYS: Key[] = [
  // ── dance: eight beats at 150bpm ──
  { t: 0.00, pose: { armLX: 0.05, armRX: -0.05, elbowL: -0.12, elbowR: -0.12 } },
  // right arm punches up on the diagonal, hop off the floor
  { t: 0.40, pose: { armRX: -2.5, armRZ: -0.55, elbowR: -0.2, armLX: 0.5, armLZ: 0.3, elbowL: -0.5, hop: 0.09, torsoTwist: -0.22, headTurn: -0.3 } },
  // both arms cut down and across, body twists open
  { t: 0.80, pose: { armLX: -0.9, armLZ: 0.85, elbowL: -0.7, armRX: -0.6, armRZ: -0.95, elbowR: -0.7, torsoTwist: 0.3, torsoTilt: 0.12, headTurn: 0.25 } },
  // crossed-chest hold
  { t: 1.20, pose: { armLX: -1.5, armLZ: -0.7, elbowL: -1.5, armRX: -1.35, armRZ: 0.62, elbowR: -1.5, torsoTilt: -0.1, headTilt: 0.22, legLX: 0.18 } },
  // body roll, arms sweep wide
  { t: 1.60, pose: { armLX: 0.4, armLZ: 1.25, elbowL: -0.35, armRX: 0.4, armRZ: -1.25, elbowR: -0.35, hop: 0.04 } },
  // step-touch left
  { t: 2.00, pose: { armLX: -0.35, armLZ: 0.5, elbowL: -0.9, armRX: -1.1, armRZ: -0.35, elbowR: -1.1, legLX: 0.42, legRX: -0.2, torsoTwist: -0.28, spin: -0.18 } },
  // mirror, sharper
  { t: 2.40, pose: { armLX: -1.1, armLZ: 0.35, elbowL: -1.1, armRX: -0.35, armRZ: -0.5, elbowR: -0.9, legLX: -0.2, legRX: 0.42, torsoTwist: 0.28, spin: 0.18 } },

  // ── the throw ──
  // The battle camera sits almost on the line he throws along, so a throw aimed
  // straight down that line foreshortens into nothing. `spin` turns him to a
  // three-quarter stance first: the arm then sweeps across the screen plane,
  // and unwinding that stance through release doubles as the hip drive.
  // gather: hands meet at the chest, the ball is produced, he opens his stance
  { t: 2.80, pose: { armRX: -0.95, armRZ: 0.22, elbowR: -1.85, armLX: -0.8, armLZ: -0.15, elbowL: -1.6, torsoTwist: 0.1, headTurn: -0.08, spin: 0.26 } },
  // aim: left arm points out at the challenger, right hand drops back and out,
  // weight settles onto the back foot
  { t: 3.05, pose: { armRX: 0.5, armRZ: -0.6, elbowR: -1.2, armLX: -1.5, armLZ: -0.2, elbowL: -0.15, torsoTwist: 0.4, torsoTilt: 0.1, legRX: -0.3, legLX: 0.12, headTurn: -0.14, spin: 0.52 } },
  // max coil: arm cocked high and wide behind him, chest turned away, front foot
  // light. Everything is stored here.
  { t: 3.28, ease: 'settle', pose: { armRX: 1.55, armRZ: -0.92, armRY: -0.25, elbowR: -1.55, armLX: -1.65, armLZ: -0.32, elbowL: -0.1, torsoTwist: 0.62, torsoTilt: 0.2, legRX: -0.45, legLX: 0.34, headTurn: -0.16, hop: 0.03, spin: 0.62 } },
  // stride + hip fire: the front foot plants and the STANCE unwinds before the
  // arm does — the arm is still trailing behind the shoulders here
  { t: 3.40, ease: 'snap', pose: { armRX: 1.15, armRZ: -1.02, armRY: -0.12, elbowR: -1.95, armLX: -1.0, armLZ: 0.02, elbowL: -0.6, torsoTwist: 0.05, torsoTilt: 0.14, legLX: 0.52, legRX: -0.28, spin: 0.44 } },
  // elbow lead: the elbow has driven up and forward while the forearm is STILL
  // laid back. This lag is what sells the whip.
  { t: 3.45, ease: 'snap', pose: { armRX: -0.25, armRZ: -0.78, elbowR: -2.15, armLX: -0.45, armLZ: 0.28, elbowL: -1.0, torsoTwist: -0.3, torsoTilt: 0.02, legLX: 0.44, legRX: -0.14, spin: 0.16 } },
  // RELEASE: forearm snaps through, arm long, hand over the top toward the arena
  { t: 3.50, ease: 'snap', pose: { armRX: -1.5, armRZ: -0.26, elbowR: -0.14, armLX: -0.15, armLZ: 0.32, elbowL: -1.25, torsoTwist: -0.46, torsoTilt: -0.12, legLX: 0.36, legRX: -0.06, headTurn: 0.06, spin: -0.06 } },
  // follow-through: the arm keeps going down and across the body, shoulders
  // rotate past, back leg trails up. Nothing stops at release.
  { t: 3.72, pose: { armRX: -2.4, armRZ: 0.5, armRY: 0.28, elbowR: -0.62, armLX: 0.3, armLZ: 0.52, elbowL: -0.5, torsoTwist: -0.7, torsoTilt: -0.28, legLX: 0.22, legRX: -0.52, headTurn: 0.14, hop: 0.02, spin: -0.32 } },
  // recover
  { t: 4.00, ease: 'settle', pose: { armRX: -0.5, armRZ: 0.2, elbowR: -0.5, armLX: 0.1, armLZ: 0.2, elbowL: -0.3, torsoTwist: -0.18, torsoTilt: -0.05, legLX: 0.05, spin: -0.12 } },
  // proud stand
  { t: 4.30, pose: { armLX: 0.05, armRX: -0.05, elbowL: -0.12, elbowR: -0.12 } },
];

const FIELDS: (keyof ChoreoPose)[] = [
  'armLX', 'armLZ', 'armLY', 'elbowL',
  'armRX', 'armRZ', 'armRY', 'elbowR',
  'legLX', 'legRX', 'torsoTilt', 'torsoTwist',
  'headTilt', 'headTurn', 'hop', 'spin',
];

/** Ease in and out — the default, for dance poses that land and hold. */
function smooth(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
/** Fast out of the previous pose — used through the whip so the arm reads as
 *  accelerating rather than sliding. */
function snap(t: number): number { return 1 - Math.pow(1 - t, 2.6); }
/** Slow, weighted arrival — for the coil and the recovery. */
function settle(t: number): number { return 1 - Math.pow(1 - t, 3.4); }

function applyEase(kind: Ease | undefined, t: number): number {
  return kind === 'snap' ? snap(t) : kind === 'settle' ? settle(t) : smooth(t);
}

/**
 * Sample the routine at `t` seconds.
 * `release` is true on exactly the frame the ball leaves his hand;
 * `ballInHand` covers the window where it must be visible in his grip.
 */
export function sampleChampionIntro(t: number, prevT: number): {
  pose: ChoreoPose; release: boolean; ballInHand: boolean; done: boolean;
} {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1] ?? KEYS[KEYS.length - 1];
  const span = Math.max(1e-4, b.t - a.t);
  const k = applyEase(b.ease, Math.min(1, Math.max(0, (t - a.t) / span)));

  const pose: ChoreoPose = {};
  for (const f of FIELDS) {
    const av = a.pose[f] ?? 0, bv = b.pose[f] ?? 0;
    if (av !== 0 || bv !== 0) pose[f] = av + (bv - av) * k;
  }
  // A continuous micro-bounce keeps him breathing between the hard poses, but
  // it is suppressed through the throw so the whip stays clean.
  if (t < BALL_APPEARS) {
    pose.hop = (pose.hop ?? 0) + Math.abs(Math.sin((t / 0.4) * Math.PI)) * 0.012;
  }

  return {
    pose,
    release: prevT < RELEASE_T && t >= RELEASE_T,
    ballInHand: t >= BALL_APPEARS && t < RELEASE_T,
    done: t >= ROUTINE_LENGTH,
  };
}
