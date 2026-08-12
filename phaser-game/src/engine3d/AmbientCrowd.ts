import * as THREE from 'three';
import { buildCharacterModel, type PlayerModel } from './CharacterModel';

// ── Ambient crowd ────────────────────────────────────────────────────────────
// Purely decorative townspeople for the 3D view. They are NOT game objects:
// no collision, no interaction, no save state — the Phaser scene neither knows
// nor cares that they exist. Their only job is to stop a town from looking
// abandoned, which is the single biggest tell between a prototype and a
// shipped game.
//
// Two behaviours:
//   • 'stand'  — a merchant behind a counter or a local at a railing: idles in
//                place, facing an authored direction, with a slow breathing bob.
//   • 'stroll' — a shopper walking a short there-and-back path, turning around
//                at each end. Walk cycles come from the same procedural rig the
//                player uses, so everyone in town moves in one visual language.

export interface CrowdPlot {
  /** tile position (tile centres are x+0.5, y+0.5) */
  x: number;
  y: number;
  /** which character look to build (falls back to a generic villager) */
  look?: string;
  /** facing in radians (stand) or initial heading (stroll) */
  rot?: number;
  behaviour?: 'stand' | 'stroll';
  /** stroll only: how far it walks before turning back, in tiles */
  range?: number;
  /** stroll only: tiles per second */
  speed?: number;
  /** stroll axis: 'x' (east-west) or 'z' (north-south) */
  axis?: 'x' | 'z';
  scale?: number;
}

interface CrowdMember {
  model: PlayerModel;
  group: THREE.Group;
  plot: CrowdPlot;
  phase: number;
  t: number;
  /** stroll state */
  travelled: number;
  dir: 1 | -1;
  lastPos: THREE.Vector3;
}

export interface AmbientCrowdResult {
  group: THREE.Group;
  update(dt: number): void;
}

const LOOKS = ['villager_a', 'villager_b', 'villager_c', 'fisher', 'merchant'];

export function buildAmbientCrowd(plots: CrowdPlot[]): AmbientCrowdResult {
  const group = new THREE.Group();
  const members: CrowdMember[] = [];

  plots.forEach((plot, i) => {
    // buildCharacterModel falls back to a default profile for unknown keys, so
    // an unnamed villager still gets a complete body.
    const look = plot.look ?? LOOKS[i % LOOKS.length];
    const model = buildCharacterModel(look, i % 2 ? 'girl' : 'boy');
    const holder = new THREE.Group();
    holder.position.set(plot.x + 0.5, 0, plot.y + 0.5);
    if (plot.scale) model.group.scale.setScalar(plot.scale);
    holder.add(model.group);
    group.add(holder);
    model.face(Math.sin(plot.rot ?? 0), Math.cos(plot.rot ?? 0), 1);
    members.push({
      model, group: holder, plot,
      phase: (i * 0.7) % (Math.PI * 2),
      t: 0,
      travelled: 0,
      dir: 1,
      lastPos: holder.position.clone(),
    });
  });

  return {
    group,
    update(dt: number) {
      for (const m of members) {
        m.t += dt;
        const p = m.plot;
        if ((p.behaviour ?? 'stand') === 'stroll') {
          const axis = p.axis ?? 'x';
          const speed = p.speed ?? 0.85;
          const range = p.range ?? 3;
          // Pause briefly at each end so the walk reads as a person, not a shuttle.
          const step = speed * dt * m.dir;
          m.travelled += step;
          if (m.travelled > range) { m.travelled = range; m.dir = -1; }
          else if (m.travelled < 0) { m.travelled = 0; m.dir = 1; }
          if (axis === 'x') m.group.position.x = p.x + 0.5 + m.travelled;
          else m.group.position.z = p.y + 0.5 + m.travelled;

          const dx = m.group.position.x - m.lastPos.x;
          const dz = m.group.position.z - m.lastPos.z;
          m.lastPos.copy(m.group.position);
          const moving = Math.hypot(dx, dz) > 1e-4;
          m.model.setWalk(m.t * (moving ? 7.5 : 2.0) + m.phase, moving, dt);
          m.model.face(dx, dz, dt);
        } else {
          // Standing: idle breathing only, holding the authored facing.
          m.model.setWalk(m.t * 2.0 + m.phase, false, dt);
        }
      }
    },
  };
}
