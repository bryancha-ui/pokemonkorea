import Phaser from 'phaser';

// ── Background music ─────────────────────────────────────────────────────────
// One looping track plays at a time, owned by the game-global sound manager so it
// carries across scene changes. A scene calls `playBgm(this, key)` in create();
// if that track is already playing nothing happens (seamless when moving between
// a city and its interiors), otherwise the old track stops and the new one starts.
// Scenes with no BGM call simply leave the current track playing.

const BASE = 'assets/bgm/';   // relative so BGM resolves under the GitHub Pages subpath
export const TRACKS: Record<string, string> = {
  // ── Towns & cities ──
  waterfall:  BASE + 'waterfallcity3.mp3',   // Waterfall City (world hub)
  waterfallnight: BASE + 'bgm_waterfall2.mp3', // Waterfall City midnight finale
  pineneedle: BASE + 'bgm_pineneedle.mp3',  // Pine Needle Town
  sudo:       BASE + 'bgm_sudo.mp3',        // Sudo / Capital City
  deptstore:  BASE + 'bgm_deptstore.mp3',   // Department Store
  baekdu:     BASE + 'bgm_baekdu.mp3',      // Seolbong City
  geumgang:   BASE + 'bgm_geumgang.mp3',    // Geumgang City
  haean:      BASE + 'bgm_haean.mp3',       // Haean City
  dolmoe:     BASE + 'bgm_dolmoe.mp3',      // Dolmoe City
  seorae:     BASE + 'bgm_seorae.mp3',      // Seorae Town
  sunrise:    BASE + 'bgm_sunrise.mp3',     // Sunrise City
  forest:     BASE + 'bgm_forest.mp3',      // Forest City
  jejudo:     BASE + 'bgm_jejudo.mp3',      // Jeju Island
  // ── Northern 어사대 circuit (post-league) ──
  pyeongyang: BASE + 'bgm_pyeongyang.mp3',  // Pyeongyang — northern capital
  kaesong:    BASE + 'bgm_kaesong.mp3',     // Songhyeon (송현)
  nampo:      BASE + 'bgm_nampo.mp3',       // Parangpo (파랑포)
  wonsan:     BASE + 'bgm_wonsan.mp3',      // Haesol (해솔)
  hamhung:    BASE + 'bgm_hamhung.mp3',     // Gangcheoldo (강철도)
  chongjin:   BASE + 'bgm_chongjin.mp3',    // Muyeonhang (무연항)
  sinuiju:    BASE + 'bgm_sinuiju.mp3',     // Binghagwan (빙하관)
  samjiyon:   BASE + 'bgm_samjiyon.mp3',    // Samho (삼호)
  eosa:       BASE + 'bgm_eosa.mp3',        // 어사대장 exam battle (마패 circuit)
  northplaza: BASE + 'bgm_northplaza.mp3',  // Northern League forecourt
  northleaguebattle: BASE + 'bgm_northleaguebattle.mp3', // Northern League battle
  northroute: BASE + 'bgm_northroute.mp3',  // northern field routes
  railnorth:  BASE + 'bgm_railnorth.mp3',   // the rail north
  baekducheck: BASE + 'bgm_baekducheck.mp3',// Baekdu checkpoint
  northreaches: BASE + 'NorthernReachesScene.mp3', // Northern Reaches (dedicated theme)
  sacredpeak: BASE + 'bgm_sacredpeak.mp3',  // Sacred Peak
  // Northern (post-game) cities
  seolhwa:    BASE + 'bgm_seolhwa.mp3',     // Seolhwa City (gate of the north)
  nunbit:     BASE + 'bgm_nunbit.mp3',      // Nunbit Village
  cheongun:   BASE + 'bgm_cheongun.mp3',    // Cheongun City
  baekak:     BASE + 'bgm_baekak.mp3',      // Baekak City (어사대 HQ)
  hauntedhouse: BASE + 'bgm_hauntedhouse.mp3', // Haunted House
  headquarternorth: BASE + 'bgm_headquarternorth%20(2).mp3', // 노스단 아지트 (Team North HQ)
  // ── Dedicated Northern-region map themes (one file per map; filename = scene name) ──
  ryesong:          BASE + 'ryesongvalleyscene.mp3',    // Ryesong Valley
  ahobiryong:       BASE + 'AhobiryongPassScene.mp3',   // Ahobiryong Pass
  sijung:           BASE + 'SijungCoastScene.mp3',      // Sijung Coast
  chilbo:           BASE + 'ChilboHighlandsScene.mp3',  // Chilbo Highlands
  kaema:            BASE + 'KaemaPlateauScene.mp3',     // Kaema Plateau
  nampobeach:       BASE + 'NampoBeachScene.mp3',       // Parangpo Beach
  wonsanbeach:      BASE + 'WonsanBeachScene.mp3',      // Haesol Beach
  icecave:          BASE + 'SinuijuIceCaveScene.mp3',   // Binghagwan Ice Cave
  rangrimfoothills: BASE + 'RangrimFoothillsScene.mp3', // Onseong Foothills
  rangrimcavern:    BASE + 'RangrimCavernScene.mp3',    // Onseong Lower Cavern
  rangrimsnow:      BASE + 'RangrimSnowfieldScene.mp3', // Onseong Snow Ridge
  // ── Routes & field ──
  route1:     BASE + 'bgm_route1.mp3',
  route2:     BASE + 'bgm_route2.mp3',
  route3:     BASE + 'bgm_route3.mp3',
  route4:     BASE + 'bgm_route4.mp3',
  route5:     BASE + 'bgm_route5.mp3',
  route6:     BASE + 'bgm_route6.mp3',
  baekdupass: BASE + 'bgm_baekdupass.mp3',  // Seolbong Highland Pass
  baekdupeak: BASE + 'bgm_baekdupeak.mp3',  // Baekdu Peak climb / Cheonji gate
  scholarsroad: BASE + 'bgm_scholarsroad.mp3', // Scholar's Road (victory road)
  seoraepass: BASE + 'bgm_seoraepass.mp3',  // Seorae Pass
  // ── Jeju sea-voyage suite (ferry chapter) ──
  ferrydusk:  BASE + 'bgm_ferrydusk.mp3',   // Haean Port — Boarding at Dusk
  ferrynight: BASE + 'bgm_ferrynight.mp3',  // The Night Crossing (calm sailing)
  ferrystorm: BASE + 'bgm_ferrystorm.mp3',  // The Strait's Fury (storm mini-event)
  vents:      BASE + 'bgm_vents.mp3',        // Approach to the Vents (eerie volcanic arrival)
  dolmoemine: BASE + 'bgm_dolmoemine.mp3',  // Dolmoe Mine
  // ── Battle themes ──
  wild:       BASE + 'bgm_wild.mp3',
  trainer:    BASE + 'bgm_trainer.mp3',
  gymleader:  BASE + 'bgm_gymleader.mp3',
  rival:      BASE + 'bgm_rival.mp3',
  suri:       BASE + 'bgm_suri.mp3',        // Team Suri
  groupnorth: BASE + 'bgm_groupnorth.mp3',  // 노스단 (Group North)
  elitefour:  BASE + 'bgm_elitefour.mp3',   // Onnuri League Elite Four
  champion:   BASE + 'bgm_champion.mp3',    // Champion Hwangeum
  northelite: BASE + 'bgm_northelite.mp3',  // Northern League Elite Four
  taewang:    BASE + 'bgm_taewang.mp3',     // Northern Champion Taewang
  sovereign:  BASE + 'bgm_sovereign.mp3',   // 노스단 Sovereign-Claimant
  // ── Legendary / boss encounters ──
  nabihalmang: BASE + 'bgm_nabihalmang.mp3',
  hwanung:    BASE + 'bgm_hwanung.mp3',
  cheonji:    BASE + 'bgm_cheonji.mp3',     // Spirit of Cheonji
  dancheong:  BASE + 'bgm_dancheong.mp3',   // The Dancheong Shield
  poongbaek:  BASE + 'bgm_poongbaek.mp3',   // 풍백 (Wind)
  woosa:      BASE + 'bgm_woosa.mp3',       // 우사 (Rain)
  woonsa:     BASE + 'bgm_woonsa.mp3',      // 운사 (Clouds)
  // ── Utility / interior ──
  title:      BASE + 'bgm_title.mp3',       // Title screen
  professorintro: BASE + 'bgm_professorintro.mp3', // Professor Song's opening narration
  center:     BASE + 'pokemoncenter.mp3',      // Pokémon Center
  mart:       BASE + 'bgm_mart.mp3',        // Poké Mart / shop
  gyminterior: BASE + 'bgm_gyminterior.mp3',// Gym interior (approaching leader)
  leagueinterior: BASE + 'bgm_leagueinterior.mp3', // League interior
  halloffame: BASE + 'bgm_halloffame.mp3',  // Hall of Fame
  evolution:  BASE + 'bgm_evolution.mp3',   // Evolution sequence
  endingcredits: BASE + 'bgm_endingcredits.mp3',  // Ending credits — first movement
  endingcredits2: BASE + 'pokemon_endingcretids.mp3', // Ending credits — second movement
};

// Short, one-shot jingles that play OVER the current music (non-looping).
export const JINGLES: Record<string, string> = {
  victory:    BASE + 'bgm_victory.mp3',     // battle victory fanfare
  badge:      BASE + 'bgm_badge.mp3',       // badge / milestone get
  heal:       BASE + 'sfx_heal.mp3',        // Pokémon Center healing chime
};

const VOLUME = 0.35;
const JINGLE_VOLUME = 0.5;

export function playBgm(scene: Phaser.Scene, key: string): void {
  const reg = scene.game.registry;
  if (reg.get('bgmMuted')) return;

  const curKey = reg.get('bgmKey') as string | undefined;
  const cur    = reg.get('bgmSound') as Phaser.Sound.BaseSound | undefined;
  if (curKey === key && cur && cur.isPlaying) return;   // this track is already going

  const url = TRACKS[key];
  if (!url) return;

  // Record the track we WANT synchronously. A track can be lazy-loaded (its `begin`
  // fires later, once the file downloads AND the browser unlocks audio on first
  // input). If, in the meantime, another scene requested a different track, this
  // deferred `begin` must NOT resurrect the stale one — otherwise two tracks play at
  // once (e.g. the Title theme leaking over Professor Song's intro).
  reg.set('bgmWanted', key);

  // Cut the outgoing (different) track NOW, before the new one lazy-loads — otherwise it
  // keeps playing during the load and bleeds through (e.g. the Title theme continuing
  // over Professor Song's intro). Same-track calls already returned above, so this only
  // fires on a real switch.
  const outgoing = reg.get('bgmSound') as Phaser.Sound.BaseSound | undefined;
  if (outgoing) { outgoing.stop(); outgoing.destroy(); reg.remove('bgmSound'); reg.remove('bgmKey'); }

  const play = () => {
    if (reg.get('bgmWanted') !== key) return;   // superseded by a later playBgm/stopBgm — abort
    stopJingle(scene);   // a new track supersedes any lingering victory/badge fanfare
    const prev = reg.get('bgmSound') as Phaser.Sound.BaseSound | undefined;
    if (prev) { prev.stop(); prev.destroy(); }
    const snd = scene.sound.add(key, { loop: true, volume: VOLUME });
    snd.play();
    reg.set('bgmSound', snd);
    reg.set('bgmKey', key);
  };

  // Add/play as soon as the track is DECODED into the cache. If the audio context is
  // still locked (Safari / iOS before the first tap) that's fine — Phaser queues the
  // `play()` internally and auto-starts it on the first user gesture. The only thing we
  // must NOT do is call `sound.add` before the buffer is decoded, because that fails
  // with 'Audio key "<key>" missing from cache' (sometimes as an uncaught error the
  // global overlay surfaces). So if the buffer isn't ready we (re)load, then play once
  // it lands — and if a suspended-context decode was dropped, retry after the unlock.
  const begin = () => {
    if (reg.get('bgmWanted') !== key) return;
    if (scene.cache.audio.exists(key)) { play(); return; }
    scene.load.audio(key, url);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (scene.cache.audio.exists(key)) play();
      else scene.sound.once(Phaser.Sound.Events.UNLOCKED, begin);
    });
    scene.load.start();
  };

  if (scene.cache.audio.exists(key)) { begin(); return; }
  // Lazy-load the track, then start it.
  scene.load.audio(key, url);
  scene.load.once(Phaser.Loader.Events.COMPLETE, begin);
  scene.load.start();
}

/** Play a temporary track (e.g. a battle theme), remembering the current ambient
 *  track so `popBgm` can restore it when the battle ends. */
export function pushBgm(scene: Phaser.Scene, key: string): void {
  const reg = scene.game.registry;
  reg.set('bgmPrevKey', (reg.get('bgmKey') as string) ?? '');
  playBgm(scene, key);
}

/** Restore the ambient track saved by `pushBgm` (the previous track resumes from
 *  its start). Safe to call from a scene 'shutdown' handler — the track is cached. */
export function popBgm(scene: Phaser.Scene): void {
  const reg = scene.game.registry;
  const prev = reg.get('bgmPrevKey') as string | undefined;
  reg.remove('bgmPrevKey');
  if (prev) playBgm(scene, prev);
  else stopBgm(scene);
}

export function stopBgm(scene: Phaser.Scene): void {
  const reg = scene.game.registry;
  const cur = reg.get('bgmSound') as Phaser.Sound.BaseSound | undefined;
  if (cur) { cur.stop(); cur.destroy(); }
  reg.remove('bgmSound');
  reg.remove('bgmKey');
  reg.remove('bgmWanted');   // cancel any deferred track load so it can't start after a stop
}

/** Stop a currently-playing one-shot jingle (if any). */
export function stopJingle(scene: Phaser.Scene): void {
  const reg = scene.game.registry;
  const j = reg.get('bgmJingle') as Phaser.Sound.BaseSound | undefined;
  if (j) { j.stop(); j.destroy(); }
  reg.remove('bgmJingle');
}

/** Play a short one-shot jingle (victory fanfare, badge get) OVER the current BGM.
 *  Non-looping; doesn't disturb the ambient/battle track. */
export function playJingle(scene: Phaser.Scene, key: string): void {
  if (scene.game.registry.get('bgmMuted')) return;
  const url = JINGLES[key];
  if (!url) return;
  const fire = () => {
    // Only add once the buffer is decoded (see playBgm) so a one-shot jingle can never
    // throw 'Audio key "<key>" missing from cache'. A locked context is fine — Phaser
    // queues the play until the first user gesture.
    if (!scene.cache.audio.exists(key)) return;
    stopJingle(scene);   // never stack jingles
    const snd = scene.sound.add(key, { volume: JINGLE_VOLUME });
    snd.play();
    scene.game.registry.set('bgmJingle', snd);
  };
  if (scene.cache.audio.exists(key)) { fire(); return; }
  scene.load.audio(key, url);
  scene.load.once(Phaser.Loader.Events.COMPLETE, fire);
  scene.load.start();
}

/** Toggle mute. Returns the new muted state. */
export function toggleBgmMute(scene: Phaser.Scene): boolean {
  const reg = scene.game.registry;
  const muted = !reg.get('bgmMuted');
  reg.set('bgmMuted', muted);
  const cur = reg.get('bgmSound') as Phaser.Sound.BaseSound | undefined;
  if (cur) (cur as Phaser.Sound.WebAudioSound).setMute?.(muted);
  return muted;
}
