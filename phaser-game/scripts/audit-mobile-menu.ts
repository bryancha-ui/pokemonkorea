import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mobileMenuAllowedInScene } from '../src/systems/MobileMenuPolicy';

const failures: string[] = [];
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

expect(mobileMenuAllowedInScene({ px: 100, py: 200 }), 'ordinary map was rejected');
expect(!mobileMenuAllowedInScene({ px: 100, py: 200, cutsceneActive: true }), 'cutscene accepted a menu tap');
expect(!mobileMenuAllowedInScene({ px: 100, py: 200, exiting: true }), 'exiting map accepted a menu tap');
expect(!mobileMenuAllowedInScene({ px: 100, py: 200, __deferredScene: true }), 'lazy placeholder accepted a menu tap');
expect(!mobileMenuAllowedInScene({ px: 100, py: 200, dialog: { isOpen: () => true } }), 'dialog accepted a menu tap');
expect(!mobileMenuAllowedInScene({}), 'non-game scene accepted a menu tap');

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const controls = source('src/systems/TouchControls.ts');
const bridge = source('src/systems/MobileMenuBridge.ts');
const main = source('src/main.ts');
expect(controls.includes("export const MOBILE_MENU_EVENT = 'pokemonkorea:mobile-menu'"),
  'control deck has no direct mobile-menu event');
expect(controls.includes("new Event(MOBILE_MENU_EVENT, { cancelable: true })"),
  'menu request cannot suppress the synthetic-key fallback');
expect(bridge.includes("materializeScene(game, 'MenuScene')"),
  'first menu request can still be lost during lazy loading');
expect(bridge.includes('if (menuReady) return menuReady'),
  'background preload and a fast tap can materialize MenuScene twice');
expect(bridge.includes('const top = active[active.length - 1]'),
  'menu bridge can bypass an active modal to reach the map underneath');
expect(bridge.includes("game.scene.run('MenuScene')"),
  'bridge does not open MenuScene without replacing the map');
expect(main.includes('if (shell.mobile) installMobileMenuBridge(game)'),
  'mobile bridge is not installed at boot');

console.log(JSON.stringify({ rulesChecked: 13, failures }, null, 2));
if (failures.length) process.exitCode = 1;
