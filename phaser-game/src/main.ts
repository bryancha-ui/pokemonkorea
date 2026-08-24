import Phaser from 'phaser';

// ── Recoverable error boundary ───────────────────────────────────────────────
// Development builds retain full diagnostics. Players receive a compact,
// non-technical recovery card: minified filenames and stack traces should never
// cover a phone screen or expose internal implementation details.
function showError(msg: string) {
  console.error('[Pokemon Korea]', msg);
  let box = document.getElementById('__err__');
  if (!box) {
    box = document.createElement('div');
    box.id = '__err__';
    document.body.appendChild(box);
  }
  if (import.meta.env.DEV) {
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:40%;overflow:auto;'
      + 'background:#aa0000;color:#fff;font:12px/1.4 monospace;padding:8px 12px;white-space:pre-wrap;'
      + 'border-top:2px solid #ff5555;';
    box.textContent = '⚠ ' + msg + '\n(tap to dismiss)';
    box.onclick = () => box?.remove();
    return;
  }

  box.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);'
    + 'z-index:99999;width:min(430px,calc(100vw - 28px));box-sizing:border-box;border:1px solid #79bde6;'
    + 'border-radius:16px;background:rgba(7,22,40,.97);color:#eef8ff;font:14px/1.5 system-ui,sans-serif;'
    + 'padding:18px;box-shadow:0 12px 40px #000b;text-align:center;';
  const title = document.createElement('strong');
  title.textContent = '잠시 문제가 발생했습니다 · Something went wrong';
  title.style.cssText = 'display:block;font-size:16px;color:#fff;margin-bottom:7px;';
  const body = document.createElement('span');
  body.textContent = '저장 데이터는 그대로입니다. 화면을 새로고침해 계속 플레이해 주세요.\nYour save is safe. Reload to continue.';
  body.style.whiteSpace = 'pre-line';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:14px;';
  const reload = document.createElement('button');
  reload.type = 'button'; reload.textContent = '새로고침 · Reload';
  reload.style.cssText = 'border:0;border-radius:9px;padding:9px 13px;background:#2b91c9;color:#fff;font-weight:800;';
  reload.onclick = () => location.reload();
  const dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.textContent = '닫기 · Close';
  dismiss.style.cssText = 'border:1px solid #7693aa;border-radius:9px;padding:9px 13px;background:#172d43;color:#fff;font-weight:700;';
  dismiss.onclick = () => box?.remove();
  actions.append(reload, dismiss);
  box.replaceChildren(title, body, actions);
}
window.addEventListener('error', (e) => showError(`${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) =>
  showError('Promise: ' + (e.reason?.stack || e.reason?.message || String(e.reason))));

import { TitleScene } from './scenes/TitleScene';
import { configureRyeoBattleTest } from './scenes/RyeoBattleTestScene';
import { createLazySceneTypes, materializeScene, STORY_SCENE_KEYS } from './systems/LazyScenes';
import { setupMobileShell } from './systems/TouchControls';
import { installMobileMenuBridge } from './systems/MobileMenuBridge';
import { installFontScaling } from './systems/UiScale';
import { initI18n, setLang } from './systems/i18n';
import { PokemonFxPlugin } from './systems/PokemonFx';
import { SaveManager } from './utils/SaveManager';
import { PartySystem } from './systems/PartySystem';
import { standaloneTestMode } from './systems/StandaloneTestMode';
import { LeaderboardProgress } from './systems/LeaderboardProgress';
import { LeaderboardApi, type LeaderboardEntry } from './systems/LeaderboardApi';
import { showRewardCeremony } from './systems/RewardCeremony';
import { installFieldItems } from './systems/FieldItems';


// ── Build stamp (dev only) ───────────────────────────────────────────────────
// A small corner badge so it is obvious at a glance whether the running page is
// the current code. Repeated "did the fix land?" rounds are almost always a
// stale dev server or a cached asset, not a wrong edit — this makes that
// answerable in one look instead of another round trip.
export const BUILD_STAMP = 'hq-followers 2026-08-25c';
if (import.meta.env.DEV) {
  console.info(`[pokemonkorea] build ${BUILD_STAMP}`);
  const badge = document.createElement('div');
  badge.textContent = BUILD_STAMP;
  badge.style.cssText = 'position:fixed;top:4px;right:6px;z-index:99999;pointer-events:none;'
    + 'background:rgba(0,0,0,.55);color:#7CFC9B;font:11px/1.3 monospace;padding:2px 6px;border-radius:4px;';
  if (document.body) document.body.appendChild(badge);
  else addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
}

function launchRyeoBattleTest(game: Phaser.Game): void {
  // Restore into this window's Phaser registry only. The battle scene's save
  // guard keeps all test damage/EXP/flags out of the real save slot.
  const saved = SaveManager.load();
  if (saved) SaveManager.restore(game.registry, saved);

  // A fresh install may not have a party yet, so give the test a usable lead.
  if (PartySystem.get(game.registry).length === 0) {
    game.registry.set('starterName', 'Test Trainer');
    game.registry.set('starterKey', 'vipour');
    game.registry.set('starterLevel', 50);
    game.registry.set('starterExp', 0);
    PartySystem.initFromStarter(game.registry);
  }

  configureRyeoBattleTest(game.registry);
  game.registry.set('nabiCaughtBeat', true);
  game.registry.set('jejuVentReturnX', 12 * 32 + 16);
  game.registry.set('jejuVentReturnY', 8 * 32 + 16);
  // READY can fire in the same frame that Phaser is starting TitleScene. Give
  // that startup transaction a tick to settle, then explicitly remove the
  // title so it cannot remain underneath the standalone battle window.
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('JejuVentScene');
}

/** Open the complete pre-capture summit staging without touching the real save. */
function launchNabihalmangEntranceTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('seoraeGymDefeated', true);
  game.registry.set('jejuSummitSeen', false);
  game.registry.set('nabiEntranceMovieSeen', false);
  game.registry.set('jejuClimbStarted', true);
  game.registry.set('trainerDefeated_jeju-suri-1', true);
  game.registry.set('trainerDefeated_jeju-suri-2', true);
  game.registry.set('jejuVentReturnX', 12 * 32 + 16);
  game.registry.set('jejuVentReturnY', 8 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('JejuVentScene');
}

/** Open the fully assembled summit and Hwanung descent without changing saves. */
function launchHwanungEntranceTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', JSON.stringify(['poongbaek', 'woosa', 'woonsa']));
  game.registry.set('sacredPeakSeen', true);
  game.registry.set('trainerDefeated_nosdan-sovereign', true);
  game.registry.set('trueEndDone', false);
  game.registry.set('sacredPeakReturnX', 9 * 32 + 16);
  game.registry.set('sacredPeakReturnY', 7 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('SacredPeakScene');
}

/** Isolated Hwanung GLB + Master Ball consumption regression fixture. */
function launchHwanungBattleTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', JSON.stringify(['poongbaek', 'woosa', 'woonsa']));
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 80);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  game.registry.set('inventoryInit', true);
  game.registry.set('inventory', JSON.stringify({ masterball: 2 }));
  game.registry.set('hwanungMasterBallGranted', true);
  game.registry.set('wildId', 'hwanwoong');
  game.registry.set('wildLevel', 80);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 2);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  game.registry.set('sacredPeakReturnX', 9 * 32 + 16);
  game.registry.set('sacredPeakReturnY', 7 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Isolated Close Combat 3D combo regression fixture. */
function launchCloseCombatTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Close Combat', type: 'fighting' as const, category: 'physical' as const, power: 95, accuracy: 100, pp: 20 },
      { name: 'Rock Slide', type: 'rock' as const, category: 'physical' as const, power: 75, accuracy: 100, pp: 10 },
      { name: 'Stone Edge', type: 'rock' as const, category: 'physical' as const, power: 100, accuracy: 100, pp: 5 },
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Pipetiger', spriteKey: 'pipetiger', level: 56,
      type1: 'fire', type2: 'steel',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Woonsa 2D-fallback ascent and Fly wind-dive regression fixture. */
function launchFlyMoveTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Woonsa');
  game.registry.set('starterKey', 'woonsa');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Fly', type: 'flying' as const, category: 'physical' as const, power: 90, accuracy: 100, pp: 15, twoTurn: 'air' as const },
      { name: 'Air Slash', type: 'flying' as const, category: 'special' as const, power: 75, accuracy: 100, pp: 15 },
      { name: 'Thunderbolt', type: 'electric' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Quick Attack', type: 'normal' as const, category: 'physical' as const, power: 40, accuracy: 100, pp: 30 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Woonsa', spriteKey: 'woonsa', level: 56,
      type1: 'flying', type2: 'electric',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 48);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Ice Beam, Hydro Pump and Shadow Ball 3D timing regression fixture. */
function launchSpecialMoveFxTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Onnurian');
  game.registry.set('starterKey', 'onnurian');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Hydro Pump', type: 'water' as const, category: 'special' as const, power: 110, accuracy: 100, pp: 5 },
      { name: 'Shadow Ball', type: 'ghost' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Air Slash', type: 'flying' as const, category: 'special' as const, power: 85, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Thanatoat', spriteKey: 'thanatoat', level: 56,
      type1: 'water', type2: 'ghost',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Representative online-reference-inspired effect families. */
function launchMoveFxFamiliesTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Yeomtaeja');
  game.registry.set('starterKey', 'yeomtaeja');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Flamethrower', type: 'fire' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Psychic', type: 'psychic' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Dark Pulse', type: 'dark' as const, category: 'special' as const, power: 80, accuracy: 100, pp: 15 },
      { name: 'Moonblast', type: 'fairy' as const, category: 'special' as const, power: 95, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Pipetiger', spriteKey: 'pipetiger', level: 56,
      type1: 'fire', type2: 'steel',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Persistent major-status visuals and localized HUD badge fixture.
 *  Use `&condition=frz|par|brn|psn` to select the condition. */
function launchStatusEffectsTest(game: Phaser.Game): void {
  const requested = new URLSearchParams(location.search).get('condition') ?? 'frz';
  const condition = ['frz', 'par', 'brn', 'psn'].includes(requested) ? requested : 'frz';
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Onnurian');
  game.registry.set('starterKey', 'onnurian');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Hydro Pump', type: 'water' as const, category: 'special' as const, power: 110, accuracy: 100, pp: 5 },
      { name: 'Shadow Ball', type: 'ghost' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Air Slash', type: 'flying' as const, category: 'special' as const, power: 85, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Thanatoat', spriteKey: 'thanatoat', level: 56, status: condition,
      type1: 'water', type2: 'ghost',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Korean starter picker dialogue pagination and Enter prompt fixture. */
function launchStarterSelectTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  setLang('ko', false);
  game.registry.set('starterChosen', false);
  game.registry.set('party', '[]');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('StarterSelectScene');
}

/** Opening rival battle when the player chose Vipour/염혈목이. */
function launchStarterRivalVipourTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  setLang('ko', false);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterChosen', true);
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 5);
  game.registry.set('starterExp', 0);
  game.registry.set('rivalKey', 'onnurian');
  game.registry.set('rivalIntroSeen', true);
  PartySystem.initFromStarter(game.registry);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('RivalBattleScene');
}

/** Open the true-ending celebration, movie and homecoming without saving. */
function launchTrueEndingTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('finalePartyPending', true);
  game.registry.set('trueEndDone', true);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('SudoLabScene');
}

/** Open one deterministic chapter of the post-credit Waterfall City finale. */
function launchWaterfallFinaleTest(
  game: Phaser.Game,
  phase: 'party' | 'night' | 'logo',
  gender: 'boy' | 'girl' = 'boy',
): void {
  const requestedLang = new URLSearchParams(location.search).get('lang');
  if (requestedLang === 'ko' || requestedLang === 'en' || requestedLang === 'ja') setLang(requestedLang, false);
  game.registry.set('sceneFlowTest', true);
  game.registry.set('playerGender', gender);
  game.registry.set('playerName', gender === 'girl' ? 'Hana' : 'Jun');
  game.registry.set('rivalName', gender === 'girl' ? 'Minhyuk' : 'Soohyun');
  game.registry.set('finaleResumePhase', phase);
  game.registry.set('trueEndDone', true);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  if (phase === 'party') {
    game.registry.set('waterfallFinalePartyPending', true);
    game.registry.set('returnX', 16.5 * 32);
    game.registry.set('returnY', 16.4 * 32);
    game.scene.start('WorldMapScene');
  } else {
    game.registry.remove('waterfallFinalePartyPending');
    game.scene.start('WaterfallFinaleScene', { phase });
  }
}

/**
 * Deterministic mobile regression fixture for the Route 2 level cap and
 * voluntary-switch confirmation. It never restores or writes the real save.
 */
function launchBattleRegressionTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 20);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);

  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    PartySystem.set(game.registry, [
      { ...lead, breedingId: 'battle-regression-lead' },
      { ...lead, name: 'Vipour B', breedingId: 'battle-regression-bench' },
    ]);
  }

  // Deliberately inject the reported bad value. WildBattleScene must clamp it
  // to Route 2's authored Lv.13–16 range before drawing the HUD.
  // Ampere exercises the heavy local GLB path as well as the common enemy-facing
  // alignment; the intentionally invalid level still validates Route 2's cap.
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 35);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 200);
  game.registry.set('wildReturnScene', 'Route2Scene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Korean bag and old-save badge reconciliation fixture. */
function launchUiLocalizationTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  setLang('ko', false);
  game.registry.set('party', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 20);
  game.registry.set('starterExp', 0);
  game.registry.set('starterChosen', true);
  game.registry.set('hasPokedex', true);
  game.registry.set('hasRunningShoes', true);
  // Reproduce the old-save gap: only the seventh story badge remains set.
  // Opening the bag must reconcile this to seven earned badges.
  game.registry.set('seoraeGymDefeated', true);
  // Three northern tablets validate both earned and locked pouch slots.
  game.registry.set('mapae_kaesong', true);
  game.registry.set('mapae_nampo', true);
  game.registry.set('mapae_wonsan', true);
  PartySystem.initFromStarter(game.registry);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('MenuScene');
}

/** Isolated badge/mapae reveal fixture. Use `reward=badge|mapae` and `key=`. */
async function launchRewardCeremonyTest(game: Phaser.Game): Promise<void> {
  const params = new URLSearchParams(location.search);
  const kind = params.get('reward') === 'mapae' ? 'mapae' : 'badge';
  const key = params.get('key') || (kind === 'mapae' ? 'pyeongseong' : 'sunriseGymDefeated');
  const requestedLang = params.get('lang');
  if (requestedLang === 'ko' || requestedLang === 'en' || requestedLang === 'ja') setLang(requestedLang, false);
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 20);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  // This fixture needs to attach its CREATE listener before MenuScene starts.
  // Production scenes are lazy-loaded, so materialise just this class first.
  const menu = await materializeScene(game, 'MenuScene');
  menu.events.once(Phaser.Scenes.Events.CREATE, () => {
    menu.time.delayedCall(250, () => showRewardCeremony(menu, { kind, key }));
  });
  game.scene.start('MenuScene');
}

/** The Hall of Fame ceremony with a full six-Pokémon team, no save writes.
 *  `?clear=N` picks the rematch wording and the enshrinement number. */
function launchHallOfFameTest(game: Phaser.Game): void {
  const params = new URLSearchParams(location.search);
  const requestedLang = params.get('lang');
  if (requestedLang === 'ko' || requestedLang === 'en' || requestedLang === 'ja') setLang(requestedLang, false);
  const clears = Math.max(0, Number(params.get('clear') ?? '0') || 0);
  game.registry.set('sceneFlowTest', true);
  game.registry.set('playerName', '한라');
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 70);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const team = [
      { key: 'vipour', name: '염혈목이', level: 72, url: 'assets/vipour.png' },
      { key: 'thanatoat', name: '학동자', level: 70 },
      { key: 'pipetiger', name: '관솔범', level: 71 },
      { key: 'daejangseung', name: '대장승', level: 69 },
      { key: 'turtleship', name: '거북선', level: 73 },
      { key: 'nabihalmang', name: '나비할망', level: 74 },
    ];
    PartySystem.set(game.registry, team.map((m, i) => ({
      ...lead, name: m.name, spriteKey: m.key,
      spriteUrl: (m as { url?: string }).url ?? `assets/dex/${m.key}.png`,
      level: m.level, breedingId: `hof-${i}`,
    })));
  }
  game.registry.set('leagueClears', clears);
  if (clears > 0) {
    game.registry.set('hallOfFame', true);
    game.registry.set('leagueHallOfFameRematchPending', true);
  }
  game.registry.set('hanbandoLeagueFloor', 5);
  for (const k of ['e4-gyeoul', 'e4-hwageum', 'e4-baram', 'e4-saleum', 'champion-hwangeum']) {
    game.registry.set(`trainerDefeated_${k}`, true);
  }
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  // `?room=1` opens the registration room directly; otherwise the fixture starts
  // in the throne room so the champion's farewell and the hand-off are covered.
  // `?theme=northern` shows the north's stone register instead.
  const theme = params.get('theme') === 'northern' ? 'northern' as const : 'onnuri' as const;
  if (params.get('room') === '1') {
    game.scene.start('HallOfFameScene', { rematch: clears > 0, clears: clears + 1, theme });
  } else if (theme === 'northern') {
    game.registry.set('northHallOfFamePending', true);
    game.registry.set('northLeagueClears', clears);
    if (clears > 0) game.registry.set('northLeagueDone', true);
    game.registry.set('northLeagueFloor', 5);
    for (const k of ['north-seorak', 'north-hanseol', 'north-cheolgang', 'north-baekho', 'north-taewang']) {
      game.registry.set(`trainerDefeated_${k}`, true);
    }
    game.scene.start('NorthernColiseumScene');
  } else {
    game.registry.set('leagueHallOfFamePending', true);
    game.scene.start('PokemonLeagueScene');
  }
}

/** Responsive leaderboard fixture with enough anonymous players to test paging. */
function launchLeaderboardTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('starterChosen', true);
  game.registry.set('playerName', '한라챔피언');
  const mine = LeaderboardProgress.startNewRun(game.registry);
  mine.playMs = 18_754_000;
  mine.badgeCount = 6;
  mine.badgeTimes = [1_840_000, 3_190_000, 5_420_000, 7_770_000, 10_960_000, 14_220_000, null, null];
  mine.mapaeCount = 3;
  mine.mapaeTimes = [14_100_000, 15_800_000, 17_500_000, null, null, null, null, null];
  mine.mapaeObserved = [true, true, true, false, false, false, false, false];
  mine.totalCaught = 47;
  game.registry.set(LeaderboardProgress.registryKey, JSON.stringify(mine));
  const fixtures: LeaderboardEntry[] = Array.from({ length: 18 }, (_, index) => ({
    rank: index + 1,
    playerCode: `${(0xA10B20 + index * 73).toString(16).toUpperCase()}`.slice(0, 6),
    displayName: ['백두산', '물결', '별빛', '초록바람', '노을', '달토끼'][index % 6],
    playMs: 9_000_000 + index * 820_000,
    badgeCount: Math.max(1, 8 - Math.floor(index / 3)),
    badgeTimes: Array.from({ length: 8 }, (_, badge) => badge <= 7 - Math.floor(index / 3)
      ? 1_400_000 + badge * 1_180_000 + index * 95_000 : null),
    mapaeCount: Math.max(0, 8 - Math.floor(index / 2)),
    mapaeTimes: Array.from({ length: 8 }, (_, mapae) => mapae < Math.max(0, 8 - Math.floor(index / 2))
      ? 3_800_000 + mapae * 520_000 + index * 80_000 : null),
    southLeagueCleared: index < 8,
    southLeagueMs: index < 8 ? 12_300_000 + index * 490_000 : null,
    northLeagueCleared: index < 3,
    northLeagueMs: index < 3 ? 19_600_000 + index * 740_000 : null,
    totalCaught: 96 - index * 3,
    uniqueCaught: 71 - index * 2,
    updatedAt: Date.now() - index * 60_000,
    isMine: index === 5,
  }));
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('LeaderboardScene', { returnTo: 'TitleScene', fixtureEntries: fixtures });
}

/** Live Firebase connectivity check that never writes fixture/save data. */
function launchLiveLeaderboardTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('LeaderboardScene', { returnTo: 'TitleScene', readOnly: true });
}

async function bootGame() {
// Recover the IndexedDB mirror before TitleScene decides whether Continue is
// available. This protects game history when ordinary browser cache cleanup
// removes localStorage but leaves origin databases intact.
await SaveManager.bootstrapDurableStorage();

// On touch devices, split the page DS-style (game on top, control deck below) and
// mount the game into the top pane so the controls never cover it. ?touch=1 forces it.
const shell = setupMobileShell(new URLSearchParams(location.search).has('touch'));

// Touch devices enlarge on-canvas fonts/boxes in proportion to how far the
// 1280×720 canvas is shrunk to fit the screen — big on tiny phones, ~1× (no
// overlap) on large touchscreens. Must run before the game/scenes are created.
installFontScaling(shell.mobile);

// TitleScene is the only eagerly parsed scene. Every story/menu destination is
// represented by a tiny placeholder and downloads its real code on first use.
const deferredSceneTypes = createLazySceneTypes(STORY_SCENE_KEYS);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  parent: shell.parent,
  scene: [TitleScene, ...deferredSceneTypes],
  // CORS-enabled loads keep remote authored 2D fallback art readable while
  // approved local GLBs load. Visual pipeline only.
  loader: { crossOrigin: 'anonymous' },
  render: {
    powerPreference: 'high-performance',   // prefer the discrete GPU on dual-GPU laptops
    antialias: true,
    // Transparent canvas lets the engine3d WebGL layer show through underneath
    // while Phaser keeps drawing all UI (and, in 2D mode, the whole game) on top.
    // The page behind the canvas is black, so 2D mode looks identical to before.
    transparent: true,
  },
  // Global "Pokémon-like" post-FX (colour grade + bloom + vignette) on every scene.
  plugins: {
    scene: [
      { key: 'PokemonFx', plugin: PokemonFxPlugin, mapping: 'pokemonFx', start: true },
    ],
  },
  fps: { target: 60, min: 30 },
  scale: {
    mode: Phaser.Scale.FIT,
    // On mobile the game pane is taller than the 16:9 canvas, so anchor the canvas to
    // the TOP of its pane (centre only horizontally) instead of floating it in the
    // middle with wasted bars above. Desktop keeps full centring.
    autoCenter: shell.mobile ? Phaser.Scale.CENTER_HORIZONTALLY : Phaser.Scale.CENTER_BOTH,
  },
});

if (shell.mobile) installMobileMenuBridge(game);

// visualViewport may resize after Safari's browser chrome moves without firing
// a second ordinary resize after the emulator shell applies its new dimensions.
// Refresh Phaser only after the exact pane rectangle emitted by TouchControls
// has passed through browser layout. Foldables otherwise keep the cover-screen
// canvas size when their larger inner display opens.
if (shell.mobile) {
  let mobileRefitFrame = 0;
  let mobileRefitTimer = 0;
  const refitMobileCanvas = () => {
    if (mobileRefitFrame) cancelAnimationFrame(mobileRefitFrame);
    if (mobileRefitTimer) window.clearTimeout(mobileRefitTimer);
    mobileRefitFrame = requestAnimationFrame(() => {
      mobileRefitFrame = requestAnimationFrame(() => {
        mobileRefitFrame = 0;
        game.scale.refresh();
      });
    });
    // Samsung Internet can finish its fold posture animation after the next
    // paint. This final pass is cheap and guarantees the settled parent size.
    mobileRefitTimer = window.setTimeout(() => {
      mobileRefitTimer = 0;
      game.scale.refresh();
    }, 180);
  };
  window.addEventListener('pokemonkorea:mobile-layout', refitMobileCanvas);
  if ('ResizeObserver' in window && shell.parent) {
    new ResizeObserver(refitMobileCanvas).observe(shell.parent);
  }
}

initI18n(game);   // load the saved KO/EN language preference before any scene renders
installFieldItems(game);
LeaderboardProgress.install(game, snapshot => LeaderboardApi.queue(snapshot));

if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

// ── 3D rendering layer ───────────────────────────────────────────────────────
// Renders the game world in 3D (terrain, characters and approved local GLBs,
// third-person + cinematic battle cameras) beneath the Phaser canvas, which
// keeps drawing all UI. Three.js is a separate lazy chunk so the title can
// become interactive without first parsing the full 3D engine on a phone.
let threeStarted = false;
const start3D = () => {
  if (threeStarted) return;
  threeStarted = true;
  void import('./engine3d')
    .then(({ bootstrap3D }) => bootstrap3D(game))
    .catch((err) => console.warn('[engine3d] lazy bootstrap failed; game remains 2D:', err));
};
if (standaloneTestMode()) start3D();
else if (shell.mobile) {
  // Do not allocate a second WebGL renderer while the phone is only showing the
  // title. Start it as soon as the first real gameplay scene has materialised;
  // this preserves every 3D visual while cutting title-screen memory pressure.
  const startAfterTitle = () => {
    const readyForWorld = game.scene.getScenes(true).some(scene => {
      const deferred = scene as Phaser.Scene & { __deferredScene?: true };
      return scene.scene.key !== 'TitleScene'
        && scene.scene.key !== 'LeaderboardScene'
        && !deferred.__deferredScene;
    });
    if (!readyForWorld) return;
    game.events.off(Phaser.Core.Events.POST_STEP, startAfterTitle);
    start3D();
  };
  game.events.on(Phaser.Core.Events.POST_STEP, startAfterTitle);
} else {
  const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number };
  if (typeof idleWindow.requestIdleCallback === 'function') idleWindow.requestIdleCallback(start3D, { timeout: 1200 });
  else globalThis.setTimeout(start3D, 0);
}

// Open isolated scene-flow checks directly from their dedicated URLs.
const testMode = import.meta.env.DEV ? standaloneTestMode() : undefined;
if (testMode === 'leaderboard') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchLeaderboardTest(game), 100);
  });
} else if (testMode === 'leaderboard-live') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchLiveLeaderboardTest(game), 100);
  });
} else if (testMode === 'ryeo-battle') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchRyeoBattleTest(game), 0);
  });
} else if (testMode === 'nabi-entrance') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchNabihalmangEntranceTest(game), 350);
  });
} else if (testMode === 'hwanung-entrance') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchHwanungEntranceTest(game), 350);
  });
} else if (testMode === 'hwanung-battle') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchHwanungBattleTest(game), 350);
  });
} else if (testMode === 'true-ending') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchTrueEndingTest(game), 350);
  });
} else if (testMode === 'finale-party') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchWaterfallFinaleTest(game, 'party'), 350);
  });
} else if (testMode === 'finale-night-boy') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchWaterfallFinaleTest(game, 'night', 'boy'), 350);
  });
} else if (testMode === 'finale-night-girl') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchWaterfallFinaleTest(game, 'night', 'girl'), 350);
  });
} else if (testMode === 'finale-logo') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchWaterfallFinaleTest(game, 'logo'), 350);
  });
} else if (testMode === 'battle-regressions') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchBattleRegressionTest(game), 350);
  });
} else if (testMode === 'ui-localization') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchUiLocalizationTest(game), 350);
  });
} else if (testMode === 'hall-of-fame') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchHallOfFameTest(game), 350);
  });
} else if (testMode === 'reward-ceremony') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => { void launchRewardCeremonyTest(game); }, 350);
  });
} else if (testMode === 'close-combat') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchCloseCombatTest(game), 350);
  });
} else if (testMode === 'fly-move') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchFlyMoveTest(game), 350);
  });
} else if (testMode === 'special-move-fx') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchSpecialMoveFxTest(game), 350);
  });
} else if (testMode === 'move-fx-families') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchMoveFxFamiliesTest(game), 350);
  });
} else if (testMode === 'status-effects') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchStatusEffectsTest(game), 350);
  });
} else if (testMode === 'starter-select') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchStarterSelectTest(game), 350);
  });
} else if (testMode === 'starter-rival-vipour') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchStarterRivalVipourTest(game), 350);
  });
}
}

void bootGame().catch(e => showError(e?.stack || e?.message || String(e)));
