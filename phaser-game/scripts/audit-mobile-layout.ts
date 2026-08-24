import { calculateMobileShellLayout, GAME_ASPECT } from '../src/systems/MobileShellLayout';

interface Case {
  name: string;
  width: number;
  height: number;
  rotate: boolean;
}

const cases: Case[] = [
  { name: 'folded Galaxy cover portrait', width: 390, height: 844, rotate: true },
  { name: 'unfolded Galaxy portrait', width: 690, height: 829, rotate: false },
  { name: 'unfolded Galaxy landscape', width: 829, height: 690, rotate: false },
  { name: 'ultra-tall phone portrait', width: 412, height: 915, rotate: true },
  { name: 'ultra-wide phone landscape', width: 915, height: 412, rotate: false },
  { name: 'small landscape phone', width: 667, height: 375, rotate: false },
];

const failures: string[] = [];
const results = cases.map(test => {
  const layout = calculateMobileShellLayout(test.width, test.height);
  const ratio = layout.gameWidth / layout.gameHeight;
  if (Math.abs(ratio - GAME_ASPECT) > 0.0001) failures.push(`${test.name}: game aspect is ${ratio}`);
  if (layout.gameWidth > layout.viewportWidth + 0.01) failures.push(`${test.name}: game overflows horizontally`);
  if (layout.gameHeight > layout.viewportHeight + 0.01) failures.push(`${test.name}: game overflows vertically`);
  if (layout.deckWidth !== layout.viewportWidth || layout.deckHeight !== layout.viewportHeight) {
    failures.push(`${test.name}: control overlay does not cover the viewport`);
  }
  if (layout.direction !== 'overlay' || layout.stacked) failures.push(`${test.name}: controls consume layout space`);
  if (layout.rotationRequired !== test.rotate) failures.push(`${test.name}: rotate gate mismatch`);
  return {
    name: test.name,
    viewport: `${layout.viewportWidth}x${layout.viewportHeight}`,
    game: `${layout.gameWidth.toFixed(1)}x${layout.gameHeight.toFixed(1)}`,
    rotationRequired: layout.rotationRequired,
  };
});

console.log(JSON.stringify({ cases: results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
