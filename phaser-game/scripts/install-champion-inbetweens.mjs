// Install AI-generated in-between frames for the champion's dance→throw handoff.
//
// Higgsfield (kling3_0) renders the transition as VIDEO from two of his existing
// keyframes. This script turns that video back into game-ready sprite frames:
// extract → chroma-key the green → align to the authored 510×520 framing → write
// PNGs next to the hand-drawn frames.
//
//   node scripts/install-champion-inbetweens.mjs <transition.mp4>
//
// Why a manual hand-off: the agent sandbox that drives Higgsfield can reach their
// CDN, but the sandbox that holds this repo cannot (proxy allowlist), and the tool
// channel between them truncates payloads of this size. Downloading the mp4 once
// is the only step that needs a human.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';

const CANVAS_W = 510, CANVAS_H = 520;
// Frames to lift out of the clip, and the texture each becomes. Picked at the
// points where the pose actually changes; the endpoints are skipped because they
// simply reproduce hw_stand and hw_throw1.
const PICKS = [
  { at: 0.41, name: 'hw_dance_to_throw1' },
  { at: 0.71, name: 'hw_dance_to_throw2' },
];

const mp4 = process.argv[2];
if (!mp4 || !fs.existsSync(mp4)) {
  console.error('usage: node scripts/install-champion-inbetweens.mjs <transition.mp4>');
  process.exit(1);
}

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../public/assets/npc/hwangeum');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-'));

execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vsync', '0', path.join(tmp, 'f%04d.png')]);
const frames = fs.readdirSync(tmp).filter(f => f.endsWith('.png')).sort();
if (!frames.length) { console.error('no frames extracted'); process.exit(1); }
console.log(`extracted ${frames.length} frames`);

/** Green-screen matte with despill. Green is used because his jacket is black and
 *  his hair navy — keying either against a dark background eats the character. */
function keyGreen(png) {
  const { width: w, height: h, data } = png;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const other = Math.max(r, b);
    const d = g - other;
    if (d > 0) {
      data[i + 3] = Math.max(0, Math.min(255, (30 - d) * 16));
      data[i + 1] = Math.min(g, other);            // despill the green rim
    } else {
      data[i + 3] = 255;
    }
    if (data[i + 3] < 128) data[i + 3] = 0; else data[i + 3] = 255;
  }
  return { w, h, data };
}

function alphaBBox({ w, h, data }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 128) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

/** Nearest-neighbour resample onto the authored canvas. The clip is rendered from
 *  the 510×520 keyframes, so a straight scale lands within a few pixels of the
 *  hand-drawn framing — verified against hw_stand/hw_throw1's own alpha bounds. */
function toCanvas(src) {
  const out = new PNG({ width: CANVAS_W, height: CANVAS_H });
  out.data.fill(0);
  for (let y = 0; y < CANVAS_H; y++) {
    const sy = Math.min(src.h - 1, Math.round(y * src.h / CANVAS_H));
    for (let x = 0; x < CANVAS_W; x++) {
      const sx = Math.min(src.w - 1, Math.round(x * src.w / CANVAS_W));
      const s = (sy * src.w + sx) * 4, d = (y * CANVAS_W + x) * 4;
      out.data[d] = src.data[s];
      out.data[d + 1] = src.data[s + 1];
      out.data[d + 2] = src.data[s + 2];
      out.data[d + 3] = src.data[s + 3];
    }
  }
  return out;
}

for (const pick of PICKS) {
  const idx = Math.min(frames.length - 1, Math.round(pick.at * (frames.length - 1)));
  const png = PNG.sync.read(fs.readFileSync(path.join(tmp, frames[idx])));
  const keyed = keyGreen(png);
  const bb = alphaBBox(keyed);
  const dest = path.join(outDir, `${pick.name}.png`);
  fs.writeFileSync(dest, PNG.sync.write(toCanvas(keyed)));
  console.log(`  ${pick.name}.png  <- frame ${idx}  subject bbox ${bb.x0},${bb.y0},${bb.x1},${bb.y1}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\ndone. Frames written to public/assets/npc/hwangeum/');
console.log('Next: they are already registered in HwangeumIntro2D.ts and will play once present.');
