import Phaser from 'phaser';
import { Pokemon, MoveData } from '../battle/Pokemon';
import { PartySystem } from './PartySystem';
import { buildFromEntry } from './PartyBattle';
import { levelUpMoves } from '../data/Learnsets';
import { TYPE_COLORS } from '../data/StarterData';
import { t, tr, typeName } from './i18n';

/** Moves newly learned crossing from `oldLevel` → `newLevel` (by level range). */
function newMoves(spriteKey: string, t1: string | undefined, t2: string | undefined,
                  oldLevel: number, newLevel: number): MoveData[] {
  const before = new Set(levelUpMoves(spriteKey, t1, t2, oldLevel).map(m => m.name.toLowerCase()));
  return levelUpMoves(spriteKey, t1, t2, newLevel).filter(m => !before.has(m.name.toLowerCase()));
}

/**
 * Level-up move learning for the ACTIVE battler. For each move it newly learns
 * this level-up: if it has a free slot it learns it automatically; if it already
 * knows 4 moves, the player is asked which move to forget — or to skip learning.
 * The live battle moveset AND the persisted party entry (via `battleMoves`) are
 * both updated. `say(text, cb)` shows a battle dialog line; `onDone` finishes.
 */
export function runLevelUpLearning(
  scene: Phaser.Scene,
  slot: number,
  mon: Pokemon,
  oldLevel: number,
  newLevel: number,
  say: (text: string, cb: () => void) => void,
  onDone: () => void,
): void {
  const entry = PartySystem.get(scene.registry)[slot];
  if (!entry) { onDone(); return; }
  const queue = newMoves(entry.spriteKey, entry.type1, entry.type2, oldLevel, newLevel);

  const commit = () => {
    // Persist the (possibly changed) live moveset as the curated set.
    const party = PartySystem.get(scene.registry);
    const e = party[slot];
    if (e) {
      e.battleMoves = mon.moves.map(m => m.data);
      e.moves = mon.moves.map(m => m.data.name);
      PartySystem.set(scene.registry, party);
    }
  };

  let i = 0;
  const step = () => {
    if (i >= queue.length) { onDone(); return; }
    const move = queue[i++];
    if (mon.moves.some(m => m.data.name.toLowerCase() === move.name.toLowerCase())) { step(); return; }

    if (mon.moves.length < 4) {
      mon.moves.push({ data: move, pp: move.pp });
      commit();
      say(`${mon.name} learned ${move.name}!`, step);
      return;
    }

    // 4 moves already — ask which to forget.
    say(`${mon.name} wants to learn ${move.name}, but it already knows 4 moves.`, () => {
      askForget(scene, mon, move, (choice) => {
        if (choice < 0) {
          say(`${mon.name} did not learn ${move.name}.`, step);
          return;
        }
        const forgot = mon.moves[choice].data.name;
        mon.moves[choice] = { data: move, pp: move.pp };
        commit();
        say(`${mon.name} forgot ${forgot} and learned ${move.name}!`, step);
      });
    });
  };
  step();
}

/**
 * Run the level-up move-learning prompt for BENCHED Pokémon that gained levels
 * via shared EXP (from awardBenchExp's leveledOut list). Each is rebuilt at its
 * PRE-level-up level so its old 4-move set is offered against the new move — the
 * same "forget which move?" flow the active battler gets — so no EXP-share level
 * silently swaps a move. Runs them one after another, then `onDone`.
 */
export function runBenchLevelUpLearning(
  scene: Phaser.Scene,
  leveled: { slot: number; from: number; to: number }[],
  say: (text: string, cb: () => void) => void,
  onDone: () => void,
): void {
  let i = 0;
  const step = () => {
    if (i >= leveled.length) { onDone(); return; }
    const { slot, from, to } = leveled[i++];
    const entry = PartySystem.get(scene.registry)[slot];
    if (!entry) { step(); return; }
    // Build the mon at its OLD level so its moveset is the pre-level-up set; the
    // learning routine then offers the newly-crossed moves against it and commits.
    const mon = buildFromEntry({ ...entry, level: from });
    runLevelUpLearning(scene, slot, mon, from, to, say, step);
  };
  step();
}

/** Overlay: pick which of the 4 current moves to forget, or cancel (returns -1). */
function askForget(scene: Phaser.Scene, mon: Pokemon, newMove: MoveData,
                   cb: (choiceIdx: number) => void): void {
  const W = scene.scale.width, H = scene.scale.height;
  const cx = W / 2, cy = H / 2;
  const layer = scene.add.container(0, 0).setDepth(200);
  layer.add(scene.add.rectangle(cx, cy, W, H, 0x000000, 0.68));
  layer.add(scene.add.rectangle(cx, cy, 500, 420, 0x10142a, 0.99).setStrokeStyle(2, 0x5577aa));
  layer.add(scene.add.text(cx, cy - 178, tr(`Forget a move to learn ${newMove.name}?`),
    { fontSize: '15px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));

  const row = (y: number, label: string, sub: string, color: number, onClick: () => void) => {
    const r = scene.add.rectangle(cx, y, 430, 44, 0x14223a).setStrokeStyle(1, 0x3a5a8a).setInteractive({ useHandCursor: true });
    r.on('pointerover', () => r.setFillStyle(0x1a4488));
    r.on('pointerout',  () => r.setFillStyle(0x14223a));
    r.on('pointerdown', onClick);
    layer.add(r);
    layer.add(scene.add.rectangle(cx - 195, y, 12, 24, color).setOrigin(0.5));
    layer.add(scene.add.text(cx - 178, y - 9, label, { fontSize: '14px', color: '#fff' }));
    layer.add(scene.add.text(cx - 178, y + 9, sub, { fontSize: '10px', color: '#9ab' }));
  };

  mon.moves.forEach((m, j) => {
    const c = (TYPE_COLORS as Record<string, number>)[m.data.type] ?? 0x666666;
    const kind = m.data.category === 'status' ? t('STATUS', '변화') : `${t('Pow', '위력')} ${m.data.power}`;
    row(cy - 128 + j * 52, tr(m.data.name), `${typeName(m.data.type)}  ·  ${kind}`, c,
      () => { layer.destroy(true); cb(j); });
  });

  const cancel = scene.add.text(cx, cy + 172, tr(`✕ Don't learn ${newMove.name}`),
    { fontSize: '13px', color: '#c99' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  cancel.on('pointerdown', () => { layer.destroy(true); cb(-1); });
  layer.add(cancel);
}
