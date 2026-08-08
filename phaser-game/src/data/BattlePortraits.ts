import Phaser from 'phaser';
import { AVATAR_URL, rivalAvatarKey } from './PlayerAvatar';
// ── Trainer battle portraits ────────────────────────────────────────────────────
// Full-body NPC art shown ONLY during a trainer battle's intro (then it steps aside
// as the Pokémon are sent out). Keyed by the battle's `trainerKey`.

export interface Portrait { key: string; url: string; }

const NPC = 'assets/npc/';
// encodeURI so filenames with spaces / Korean characters (e.g. "gym trainer Haedo.png",
// "노스단 courier Cheol.png") load correctly from GitHub Pages. The texture key keeps the
// human-readable raw name; only the fetched URL is percent-encoded.
const P = (file: string): Portrait => ({ key: file.replace(/\.\w+$/, ''), url: encodeURI(NPC + file) });

export const PORTRAITS: Record<string, Portrait> = {
  // ── Onnuri League — Elite Four + Champion ──
  'e4-gyeoul':  P('npc_gyeoul.png'),
  'e4-hwageum': P('npc_hwageum.png'),
  'e4-baram':   P('npc_baram.png'),
  'e4-saleum':  P('npc_saleum.png'),
  'champion-hwangeum': P('npc_hwangeum.png'),

  // ── Gym Leaders ──
  'capitol-jin':      P('npc_jin.png'),        // Dark — Guardian of Capitol's shadows
  'baekdu-byeoksan':  P('npc_byeoksan.png'),
  'geumgang-namsun':  P('npc_namsun.png'),
  'haean-harang':     P('npc_harang.png'),
  'forest-noksaek':   P('npc_noksaek.png'),
  'sunrise-beonge':   P('npc_beonge.png'),
  'dolmoe-sandol':    P('npc_sandol.png'),   // Rock — The Bedrock
  'seorae-yeona':     P('npc_yeona.png'),    // Ice — The Winter Bell

  // ── 노스단 / Team Suri villains ──
  'nosdan-ryeo-1':     P('npc_ryeo.png'),
  'nosdan-ryeo-2':     P('npc_ryeo.png'),
  'nosdan-ryeo-cliff': P('npc_ryeo.png'),
  'jeju-ryeo-final':   P('npc_ryeo.png'),   // the Jeju summit finale
  'suri-director':     P('npc_suri.png'),
  // ── Northern 어사대 (Inspectorate Chiefs) — the 마패 circuit ──
  'eosa-kaesong':      P('npc_eosajang.png'),   // Songhyeon — 어사대장 Hyeon
  'eosa-nampo':        P('어사대장 해민.png'),   // Parangpo — 어사대장 Haemin
  'eosa-wonsan':       P('npc_jito.png'),       // Haesol — 어사대장 Haegang
  'eosa-hamhung':      P('npc_gapcheol.webp'),  // Gangcheoldo — 어사대장 Cheolju (Steel)
  'eosa-chongjin':     P('npc_dosadae.png'),    // Muyeonhang — 어사대장 Mukyeong
  'eosa-sinuiju':      P('npc_jinnok.png'),     // Binghagwan — 어사대장 Amrok
  'eosa-samjiyon':     P('npc_jito.png'),       // Samho — 어사대장 Seolwon
  'eosa-pyeongyang':   P('npc_dosadae.png'),    // Pyeongyang — 어사대장 Jeongan
  'eosa-pyeongseong':  P('npc_dosadae.png'),    // Gwanmunseong — Supreme Commander Gwang
  'suri-chaeyeon-1':   P('npc_chaeyeon.png'),
  'suri-chaeyeon-2':   P('npc_chaeyeon.png'),
  'nosdan-mubaek':     P('npc_mubaek.png'),
  'nosdan-chongjin':   P('npc_mubaek.png'),   // 노스단 officer Hyeok — Muyeonhang exam stand-in
  'baekdu-seollan':    P('npc_seollan.png'),

  // ── POST-GAME I — Northern League ──
  'north-seorak':    P('npc_seorak.png'),
  'north-hanseol':   P('npc_hanseol.png'),
  'north-cheolgang': P('npc_cheolgang.png'),
  'north-baekho':    P('npc_baekho.png'),
  'north-taewang':   P('npc_taewang.png'),

  // ── POST-GAME II — 어사대 (Royal Inspectorate) + 노스단's new leader (battles TBD) ──
  'inspector-jito':    P('npc_jito.png'),
  'inspector-salmu':   P('npc_salmu.png'),
  'inspector-gapcheol':P('npc_gapcheol.webp'),
  'inspector-jinnok':  P('npc_jinnok.png'),
  'dosadae':           P('npc_dosadae.png'),
  'nosdan-sovereign':  P('npc_sovereign.png'),
  'nosdan-samjiyon-boss': P('npc_sovereign.png'),   // Sovereign Clemont — atop the Samho 아지트
  'prof-song':         P('npc_song.webp'),

  // ── Named regular trainers with dedicated 2D battle art (assets/npc) ──
  // Filename ↔ trainer name matched to the trainer's `key` in each scene.
  'pass-deok':        P('snow worker deok.png'),   // Seorae Pass — Snow Worker Deok

  // Gym trainers
  'haean-haedo':      P('gym trainer Haedo.png'),
  'haean-byungchan':  P('gym_trainer_Byungchan.png'),
  'geum-junho':       P('gym trainer Junho.png'),
  'seorae-nunsong':   P('gym trainer Nunsong.png'),
  'sunrise-daehwi':   P('gym trainer daehwi.png'),
  'sunrise-seongwoo': P('gym trainer seongwoo.png'),
  'dolmoe-bawoo':     P('hiker_bawoo.png'),
  'dolmoe-doran':     P('gym trainer doran.png'),
  'baekdu-taeguk':    P('gym trainer taeguk.png'),
  'baekdu-nari':      P('gym_trainer_nari.png'),
  'forest-minho':     P('gym trainer minho.png'),
  'forest-chungha':   P('gym_traner_chungha.png'),
  'seorae-baram':     P('attendant Baram.png'),   // Attendant Baram (Seorae gym)

  // 어사대 disciples (Haesol/Wonsan)
  'wonsan-disciple-1': P('disciple baekho.png'),
  'wonsan-disciple-2': P('disciple miru.png'),
  'wonsan-disciple-3': P('disciple cheon.png'),

  // Hikers
  'rg-daljae':   P('hiker_daljae.png'),
  'cb-baekcheol': P('hiker_baekcheol.png'),
  'rv-bawoo':    P('hiker_bawoo.png'),
  'ab-cheolho':  P('hiker_cheolho.png'),
  'rg-cheol':    P('hiker_Cheol.png'),

  // Miners / diggers / workers
  'mine-gapdol': P('miner_gapdol.png'),
  'mine-gwang':  P('miner_gwang.png'),
  'mine-baru':   P('Digger_baru.png'),
  'mine-cheol':  P('worker_cheol.png'),
  'sj-cheolsu':  P('steelworker cheolsu.png'),

  // Fishers / anglers
  'rv-miyeon':   P('angler_miyeon.png'),
  'kalma-fisher': P('fisher Baram.png'),
  'sj-bora':     P('fisher_bora.png'),
  'nampo-dohun': P('fisher_dohun.png'),
  'r4-dalsu':    P('fisherman_dalsu.png'),

  // Paddy farmers
  'sj-deok':     P('paddy farmer deok.png'),
  'rv-deoksu':   P('paddy farmer deoksu.png'),

  // Sailors
  'ocean-baek':    P('sailor Baek.png'),
  'nampo-manho':   P('sailor Manho.png'),
  'ferry-geumdol': P('sailor_geumdol.png'),

  // Skiers
  'rg-nunbyeol': P('skier nunbyeol.png'),
  'pass-yuna':   P('skier yuna.png'),

  // Swimmers
  'kalma-swimmer': P('swimmer_haram.png'),
  'ocean-miho':    P('swimmer_miho.png'),
  'nampo-yura':    P('swimmer_yura.png'),

  // Ace trainers
  'road-dawon':  P('ace_trainer_Dawon.png'),
  'rg-hakryun':  P('ace_trainer_Hakryun.png'),
  'cb-jihu':     P('ace_trainer_jihu.png'),
  'km-seorin':   P('ace_trainer_seorin.png'),

  // Rangers, black belts, dragon tamer, bug catcher
  'r3-hyunwoo':  P('ranger_hyunwoo.png'),
  'rg-museon':   P('black belt museon.png'),
  'ab-muljin':   P('Black belt mujin.png'),
  'r6-yunho':    P('dragon tamer yunho.png'),
  'r5-beomseok': P('bug_catcher_bumseok.png'),

  // 노스단 / villain operatives
  'km-cheol':    P('노스단 courier Cheol.png'),
  'rv-scout':    P('노스단 scout garam.png'),
  'rg-hyeol':    P('노스단 scout hyeol.png'),
  'cb-ryun':     P('노스단 scout ryun.png'),
  'ruins-nosdan-1': P('노스단 digger.png'),
  'ruins-nosdan-2': P('노스단 digger.png'),
  'nosdan-ajit-road-1': P('노스단 sentry.png'),
  'nosdan-ajit-road-2': P('노스단 sentry.png'),
  'baekdu-sentry-w': P('Watchtower Sentry.png'),
  'baekdu-sentry-e': P('Watchtower Sentry.png'),
  'jeju-suri-1': P('team suri grunt.png'),
  'jeju-suri-2': P('team suri grunt.png'),
  // Generic 노스단 rank-and-file (same authored art for every grunt/admin/soldier)
  'baekdu-grunt-1':  P('노스단 Grunt.png'),
  'nosdan-ajit-1a':  P('노스단 Grunt.png'),
  'nosdan-ajit-2a':  P('노스단 Grunt.png'),
  'nosdan-ajit-2b':  P('노스단 Grunt.png'),
  'nosdan-ajit-3a':  P('노스단 Grunt.png'),
  'nosdan-ajit-3b':  P('노스단 Grunt.png'),
  'nosdan-ajit-4a':  P('노스단 Grunt.png'),
  'baekdu-admin-1':  P('노스단 admin.png'),
  'nosdan-admin':    P('노스단 admin.png'),
  'baekdu-soldier-1': P('노스단 soldier.png'),
  'baekdu-soldier-2': P('노스단 soldier.png'),

  // Bird keepers, campers, herders & outdoor classes
  'sj-sora':     P('Bird keeper Sora.png'),
  'ab-sora':     P('Bird keeper Sora.png'),
  'r6-sora':     P('Bird keeper Sora.png'),
  'cb-suna':     P('bird keeper Suna.png'),
  'cb-doha':     P('camper Doha.png'),
  'ab-dohyeon':  P('Camper Dohyeon.png'),
  'rg-boksun':   P('camper Boksun.png'),
  'km-poksil':   P('Herder Poksil.png'),
  'ab-yena':     P('picknicker Yena.png'),
  'mine-sunny':  P('prospector Sunny.png'),

  // Psychic / ghost / medium classes (Fogbound Manor, Rangrim)
  'manor-boryeong': P('Hex Maniac Boryeong.png'),
  'manor-yeong':    P('Medium Yeong.png'),
  'rg-myoja':       P('Psychic Myoja.png'),

  // Town / road classes
  'ferry-hojun': P('Rich Boy Hojun.png'),
  'road-hyeonu': P('Scholar-Trainer Hyeonu.png'),
  'road-munseok': P('veteran munseok.png'),
  'rg-seolla':   P('veteran Seolla.png'),
  'r5-jiyeon':   P('aroma lady Jiyeon.png'),
  'r3-seulgi':   P('photographer seulgi.png'),
  'r2-yujin':    P('school kid yujin.png'),
  'rv-jinho':    P('youngter Jinho.png'),   // Youngster Jinho

  // Capitol gym shade/shadow trainers
  'shade-yuna':    P('shade trainer yuna.png'),
  'shadow-jaemin': P('shadow trainer Jaemin.png'),
  'shadow-miso':   P('shadow trainer miso.png'),
};

export function portraitFor(trainerKey: string): Portrait | undefined {
  return PORTRAITS[trainerKey];
}

/**
 * Attach an existing full-body portrait to an overworld character. The 2D
 * Graphics object remains authoritative for position/visibility/gameplay, while
 * OverworldMirror replaces its generic relief with this character-specific 3D
 * sculpt when 3D mode is active.
 */
export function markTrainerPortrait(
  obj: Phaser.GameObjects.GameObject,
  trainerKey: string,
): void {
  const portrait = portraitFor(trainerKey);
  if (portrait) {
    obj.setData('characterPortrait3D', portrait);
    obj.setData('characterModel3DKey', portrait.key);
  }
}

/** The rival uses the opposite-gender trainer artwork selected at game start. */
export function markRivalPortrait(
  obj: Phaser.GameObjects.GameObject,
  registry: { get(key: string): unknown },
): void {
  const key = rivalAvatarKey(registry);
  obj.setData('characterPortrait3D', { key, url: AVATAR_URL[key] } satisfies Portrait);
  obj.setData('characterModel3DKey', key);
}

/**
 * Scale a portrait to a consistent on-screen size regardless of its source
 * resolution / framing, by fitting it inside a fixed box (min of width & height
 * scale). Keeps every trainer's portrait roughly the same size in battle.
 */
// Global shrink for ALL NPC battle portraits (they were rendering oversized).
// Battle portraits were globally reduced to 40%, which made every authored
// 2D trainer (gym leaders, Elite Four, rivals and ordinary trainers) tiny in
// the 3D battle layout. Keep their per-image tuning, but render them at twice
// the previous global size.
const GLOBAL_PORTRAIT_SCALE = 0.8;

// Per-portrait extra tweak (by texture key) for figures that fill their frame too
// tightly. Multiplied on top of the global scale. 1 = the standard fit.
const PORTRAIT_SCALE: Record<string, number> = {
  npc_byeoksan: 1.305,   // Baekdu gym leader
  npc_gyeoul:   1.305,   // Elite Four
  npc_hwageum:  1.305,
  npc_baram:    1.305,
  npc_saleum:   1.105,  // 0.85 × 1.3 — Saleum's portrait enlarged 1.3×
  npc_ryeo:     1.305,   // Commander Ryeo (Team Suri)
  npc_jito:     1.305,
  npc_gapcheol: 1.305,
  'trncls-worker': 1.35, // Snow Worker Deok's 80px source needs more stage presence
};

// Cache of the opaque (non-transparent) bounding box per texture key, so we only
// scan pixels once. Newer AI-generated trainer art is a wide 1408×768 canvas with
// the character floating small and centred in transparent padding; fitting the
// PADDED canvas made those trainers render tiny next to the tightly-cropped
// legacy portraits. Fit the character's actual pixels instead.
const OPAQUE_BBOX = new Map<string, { w: number; h: number }>();

function opaqueBBox(src: CanvasImageSource & { width: number; height: number }, key: string): { w: number; h: number } {
  const cached = OPAQUE_BBOX.get(key);
  if (cached) return cached;
  const w = src.width || 1, h = src.height || 1;
  let box = { w, h };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 16) {
            found = true;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (found) box = { w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  } catch { /* CORS-tainted source → fall back to full-frame fit */ }
  OPAQUE_BBOX.set(key, box);
  return box;
}

export function fitPortrait(img: Phaser.GameObjects.Image, maxW = 200, maxH = 290): void {
  const src = img.texture.getSourceImage() as CanvasImageSource & { width: number; height: number };
  const box = opaqueBBox(src, img.texture.key);
  const s = (PORTRAIT_SCALE[img.texture.key] ?? 1) * GLOBAL_PORTRAIT_SCALE;
  img.setScale(Math.min(maxW / box.w, maxH / box.h) * s);
}
