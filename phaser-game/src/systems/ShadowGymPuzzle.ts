export interface ShadowGymPokemon {
  id: number;
  level: number;
}

export interface ShadowGymTrainer {
  key: string;
  name: string;
  line: string;
  pokemon: ShadowGymPokemon[];
  expPool: number;
  leader?: boolean;
}

export interface ShadowGymRoom {
  sceneKey: string;
  stage: number;
  trainer: ShadowGymTrainer;
  /** A null entry is the real trainer; every numeric entry is a wild-Pokemon clone. */
  candidates: Array<ShadowGymPokemon | null>;
  previousScene: string;
  nextScene?: string;
}

/**
 * The Capitol Shadow Gym is a four-room sequential illusion trial. Keeping the
 * puzzle data outside Phaser makes save compatibility and room ordering easy to
 * audit without booting the renderer.
 */
export const SHADOW_GYM_ROOMS: readonly ShadowGymRoom[] = [
  {
    sceneKey: 'CapitolGymScene',
    stage: 1,
    trainer: {
      key: 'shadow-miso', name: 'Shadow Trainer Miso',
      line: 'Miso: In darkness, only the strong survive!',
      pokemon: [{ id: 198, level: 7 }],
      expPool: 130,
    },
    candidates: [{ id: 198, level: 7 }, null, { id: 261, level: 7 }],
    previousScene: 'CapitolCityScene',
    nextScene: 'CapitolGymMirrorRoomScene',
  },
  {
    sceneKey: 'CapitolGymMirrorRoomScene',
    stage: 2,
    trainer: {
      key: 'shadow-jaemin', name: 'Shadow Trainer Jaemin',
      line: "Jaemin: Leader Jin's shadows protect this hall!",
      pokemon: [{ id: 261, level: 8 }, { id: 228, level: 9 }],
      expPool: 240,
    },
    candidates: [{ id: 228, level: 8 }, { id: 215, level: 8 }, null],
    previousScene: 'CapitolGymScene',
    nextScene: 'CapitolGymVeilRoomScene',
  },
  {
    sceneKey: 'CapitolGymVeilRoomScene',
    stage: 3,
    trainer: {
      key: 'shade-yuna', name: 'Shade Trainer Yuna',
      line: "Yuna: You'll face the true dark here!",
      pokemon: [{ id: 215, level: 9 }, { id: 198, level: 10 }],
      expPool: 300,
    },
    candidates: [null, { id: 302, level: 9 }, { id: 93, level: 9 }],
    previousScene: 'CapitolGymMirrorRoomScene',
    nextScene: 'CapitolGymSanctumScene',
  },
  {
    sceneKey: 'CapitolGymSanctumScene',
    stage: 4,
    trainer: {
      key: 'capitol-jin', name: 'Leader Jin',
      line: 'Leader Jin: Darkness is not evil — it is the truth behind light.',
      pokemon: [],
      expPool: 0,
      leader: true,
    },
    candidates: [{ id: 197, level: 10 }, { id: 510, level: 10 }, null],
    previousScene: 'CapitolGymVeilRoomScene',
  },
] as const;

export function shadowCandidateKind(room: ShadowGymRoom, index: number): 'trainer' | 'clone' {
  return room.candidates[index] === null ? 'trainer' : 'clone';
}

export function shadowCloneFlag(room: ShadowGymRoom, index: number): string {
  return `shadowGymCloneCleared_${room.sceneKey}_${index}`;
}

export function shadowRoomClearFlag(room: ShadowGymRoom): string {
  return room.trainer.leader ? 'gymLeaderDefeated' : `trainerDefeated_${room.trainer.key}`;
}
