import Phaser from 'phaser';
import * as THREE from 'three';
import { toonMat, toonRamp } from './Props';

type ArenaFamily = 'gym' | 'hanbando' | 'northern' | 'lab';
type ArenaMotif =
  | 'shadow' | 'dojo' | 'lantern' | 'tide' | 'forest' | 'storm' | 'quarry' | 'frost'
  | 'crane' | 'forge' | 'wind' | 'spirit' | 'idol'
  | 'stone' | 'fortress' | 'tiger' | 'throne' | 'research';

export interface BattleArenaTheme {
  family: ArenaFamily;
  motif: ArenaMotif;
  floor: number;
  floorAlt: number;
  wall: number;
  trim: number;
  accent: number;
}

const GYM_THEMES: Record<string, BattleArenaTheme> = {
  capitol:  { family: 'gym', motif: 'shadow',  floor: 0x1a1a2e, floorAlt: 0x1e1e3a, wall: 0x0a0a1e, trim: 0x330055, accent: 0xaa44ff },
  baekdu:   { family: 'gym', motif: 'dojo',    floor: 0x8a6a44, floorAlt: 0x946f47, wall: 0x4a4239, trim: 0x5a3a1a, accent: 0xff8844 },
  geumgang: { family: 'gym', motif: 'lantern', floor: 0x241a38, floorAlt: 0x2e2248, wall: 0x140e22, trim: 0x4a2a5a, accent: 0xffaadd },
  haean:    { family: 'gym', motif: 'tide',    floor: 0x123a5a, floorAlt: 0x1a4a6e, wall: 0x0a2436, trim: 0x1a5a7a, accent: 0x88e0ff },
  forest:   { family: 'gym', motif: 'forest',  floor: 0x1f3a1e, floorAlt: 0x274a24, wall: 0x0e2410, trim: 0x3a5a28, accent: 0x9fe06a },
  sunrise:  { family: 'gym', motif: 'storm',   floor: 0x14203a, floorAlt: 0x1c2e4e, wall: 0x0a1226, trim: 0x2a3a6a, accent: 0xffe44e },
  dolmoe:   { family: 'gym', motif: 'quarry',  floor: 0x4a453e, floorAlt: 0x55504a, wall: 0x2a2620, trim: 0x6a655c, accent: 0xb0a898 },
  seorae:   { family: 'gym', motif: 'frost',   floor: 0xcfe4ef, floorAlt: 0xd6ecf6, wall: 0x3a5060, trim: 0xa8d0e8, accent: 0xffffff },
};

const HANBANDO_THEMES: Record<string, BattleArenaTheme> = {
  'e4-gyeoul':        { family: 'hanbando', motif: 'crane',  floor: 0x243746, floorAlt: 0x304a5b, wall: 0x101823, trim: 0x56768a, accent: 0x9fe0ff },
  'e4-hwageum':       { family: 'hanbando', motif: 'forge',  floor: 0x30343b, floorAlt: 0x3c424a, wall: 0x14171b, trim: 0x66707b, accent: 0xffa34a },
  'e4-baram':         { family: 'hanbando', motif: 'wind',   floor: 0x263b3c, floorAlt: 0x315052, wall: 0x102222, trim: 0x52756d, accent: 0xa8e6c8 },
  'e4-saleum':        { family: 'hanbando', motif: 'spirit', floor: 0x382d48, floorAlt: 0x46385b, wall: 0x181222, trim: 0x6b537d, accent: 0xe0b0ff },
  'champion-hwangeum': { family: 'hanbando', motif: 'idol',   floor: 0x141426, floorAlt: 0x242038, wall: 0x080812, trim: 0x5a294f, accent: 0xffd54a },
};

const NORTHERN_THEMES: Record<string, BattleArenaTheme> = {
  // Final Rival send-off at the Northern League doors. Keep the granite
  // colonnade, ceremonial red banners and gold accents visible in battle instead
  // of falling back to the generic snowy field for NorthernPlazaScene.
  'rival-5':          { family: 'northern', motif: 'fortress', floor: 0x45484f, floorAlt: 0x555a62, wall: 0x17191e, trim: 0x727984, accent: 0xe0bd4f },
  'north-seorak':    { family: 'northern', motif: 'stone',    floor: 0x403c38, floorAlt: 0x4b4640, wall: 0x171615, trim: 0x6d604f, accent: 0xc9a86a },
  'north-hanseol':   { family: 'northern', motif: 'frost',    floor: 0x34444e, floorAlt: 0x405762, wall: 0x121b20, trim: 0x638493, accent: 0xbfe8ff },
  'north-cheolgang': { family: 'northern', motif: 'fortress', floor: 0x363a40, floorAlt: 0x444950, wall: 0x111317, trim: 0x69717c, accent: 0xced4de },
  'north-baekho':    { family: 'northern', motif: 'tiger',    floor: 0x40364c, floorAlt: 0x4c405b, wall: 0x18131e, trim: 0x6b537d, accent: 0xd8b0ff },
  'north-taewang':   { family: 'northern', motif: 'throne',   floor: 0x343238, floorAlt: 0x423f45, wall: 0x111114, trim: 0x756324, accent: 0xffd54a },
  // 어사대장 Supreme Gwang, the final Chief in Gwanmunseong (관문성) — the northern
  // capital of grey-granite towers and ceremonial avenues. Pale granite floor and
  // walls with a ceremonial gold trim (the great bronze figure of the plaza), so
  // his battle reads as the disciplined stone capital rather than an open meadow.
  'eosa-pyeongseong': { family: 'northern', motif: 'fortress', floor: 0x4a4b50, floorAlt: 0x585a62, wall: 0x191b20, trim: 0x7b818b, accent: 0xd9b64a },
};

/** Professor Song's bright Sudo City laboratory. Rival battle #3 starts here
 * after the Nabihalmang briefing and must not inherit an outdoor route arena. */
const SUDO_LAB_THEME: BattleArenaTheme = {
  family: 'lab', motif: 'research',
  floor: 0xb8c2d4, floorAlt: 0xd9e2ef, wall: 0xdfe6f2,
  trim: 0x718198, accent: 0x55ddcc,
};

const GYM_KEY: Record<string, string> = {
  'capitol-jin': 'capitol',
  'baekdu-byeoksan': 'baekdu',
  'geumgang-namsun': 'geumgang',
  'haean-harang': 'haean',
  'forest-noksaek': 'forest',
  'sunrise-beonge': 'sunrise',
  'dolmoe-sandol': 'dolmoe',
  'seorae-yeona': 'seorae',
};

// The 노스단 아지트 (Nosdan hideout/base at the head of the Samjiyon mountain road):
// a dark steel bunker with the 노스단 red banners, so its battles read as being
// fought inside the enemy fortress rather than on an open route.
const NOSDAN_THEME: BattleArenaTheme = {
  family: 'northern', motif: 'fortress',
  floor: 0x2b2f3a, floorAlt: 0x343a48, wall: 0x14161e, trim: 0x3d4450, accent: 0xd8324a,
};
const NOSDAN_RETURN_SCENES = new Set(['NosdanHideoutScene', 'SamjiyonAjitRoadScene']);

const GYM_RETURN_SCENE: Record<string, string> = {
  CapitolGymScene: 'capitol',
  CapitolGymMirrorRoomScene: 'capitol',
  CapitolGymVeilRoomScene: 'capitol',
  CapitolGymSanctumScene: 'capitol',
  BaekduGymScene: 'baekdu',
  GeumgangGymScene: 'geumgang',
  HaeanGymScene: 'haean',
  ForestGymScene: 'forest',
  SunriseGymScene: 'sunrise',
  DolmoeGymScene: 'dolmoe',
  SeoraeGymScene: 'seorae',
};

/** Select a 3D room from the battle's story metadata. Ordinary route battles
 * return undefined and retain the existing outdoor arena. */
export function resolveBattleArenaTheme(scene: Phaser.Scene): BattleArenaTheme | undefined {
  // Jin uses a dedicated battle scene and does not populate trainerKey.
  if (scene.scene.key === 'GymLeaderBattleScene') return GYM_THEMES.capitol;
  // Wild and dedicated rival scenes can inherit old registry values; only the
  // shared trainer scene should consume trainerKey / trainerReturnScene.
  if (scene.scene.key !== 'TrainerBattleScene') return undefined;

  const trainerKey = String(scene.registry.get('trainerKey') ?? '');
  const returnScene = String(scene.registry.get('trainerReturnScene') ?? '');
  // Accept either marker so an older save made immediately before the battle
  // still resolves the laboratory even if one registry field was absent.
  if (trainerKey === 'rival-3' || returnScene === 'SudoLabScene') return SUDO_LAB_THEME;
  if (HANBANDO_THEMES[trainerKey]) return HANBANDO_THEMES[trainerKey];
  if (NORTHERN_THEMES[trainerKey]) return NORTHERN_THEMES[trainerKey];
  const gymKey = GYM_KEY[trainerKey];
  if (gymKey) return GYM_THEMES[gymKey];

  // Gym trainers share their building's interior even though their keys are
  // personal names rather than the leader's city-prefixed key.
  // Any battle fought inside the 노스단 아지트 uses the fortress arena.
  if (NOSDAN_RETURN_SCENES.has(returnScene)) return NOSDAN_THEME;
  const returnGym = GYM_RETURN_SCENE[returnScene];
  return returnGym ? GYM_THEMES[returnGym] : undefined;
}

function mixed(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function box(
  root: THREE.Object3D,
  size: [number, number, number],
  color: number,
  pos: [number, number, number],
  rotZ = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), toonMat(color));
  mesh.position.set(...pos);
  mesh.rotation.z = rotZ;
  root.add(mesh);
  return mesh;
}

function cylinder(
  root: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: number,
  pos: [number, number, number],
  sides = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), toonMat(color));
  mesh.position.set(...pos);
  root.add(mesh);
  return mesh;
}

function glowingMaterial(color: number, opacity = 1): THREE.MeshToonMaterial {
  const mat = toonMat(color, { transparent: opacity < 1, opacity });
  mat.emissive.set(color);
  mat.emissiveIntensity = 0.55;
  if (opacity < 1) mat.depthWrite = false;
  return mat;
}

function glowSphere(root: THREE.Object3D, color: number, pos: [number, number, number], radius = 0.16): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), glowingMaterial(color));
  mesh.position.set(...pos);
  root.add(mesh);
  return mesh;
}

function floorRing(root: THREE.Object3D, x: number, z: number, color: number, radius = 1.62): void {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 6, 40), glowingMaterial(color));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.055, z);
  root.add(ring);
}

function wallRing(root: THREE.Object3D, x: number, y: number, color: number, radius: number): void {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.065, 7, 40), glowingMaterial(color));
  ring.position.set(x, y, -6.94);
  root.add(ring);
}

function banner(root: THREE.Object3D, x: number, color: number, accent: number, angled = false): void {
  box(root, [1.05, 2.5, 0.08], color, [x, 2.8, -6.94]);
  box(root, [1.18, 0.11, 0.13], accent, [x, 4.08, -6.88]);
  if (angled) {
    box(root, [0.14, 2.05, 0.06], accent, [x - 0.2, 2.8, -6.87], -0.32);
    box(root, [0.14, 2.05, 0.06], accent, [x + 0.2, 2.8, -6.87], 0.32);
  } else {
    box(root, [0.12, 1.8, 0.06], accent, [x, 2.8, -6.87]);
  }
}

function lantern(root: THREE.Object3D, x: number, y: number, z: number, color: number): void {
  box(root, [0.06, 0.55, 0.06], 0x34251c, [x, y + 0.42, z]);
  cylinder(root, 0.22, 0.22, 0.08, 0x4b3324, [x, y + 0.14, z], 8);
  const light = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.38, 8), glowingMaterial(color, 0.88));
  light.position.set(x, y - 0.08, z);
  root.add(light);
  cylinder(root, 0.21, 0.17, 0.08, 0x4b3324, [x, y - 0.31, z], 8);
}

function crystal(root: THREE.Object3D, x: number, z: number, color: number, scale = 1): void {
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.34 * scale, 0), glowingMaterial(color, 0.72));
  shard.scale.y = 2.2;
  shard.position.set(x, 0.68 * scale, z);
  shard.rotation.y = x * 0.17;
  root.add(shard);
  for (const side of [-1, 1]) {
    const small = shard.clone();
    small.scale.set(0.55, 1.15, 0.55);
    small.position.set(x + side * 0.36 * scale, 0.36 * scale, z + 0.08);
    small.rotation.z = side * 0.35;
    root.add(small);
  }
}

function boulder(root: THREE.Object3D, x: number, z: number, color: number, scale = 1): void {
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * scale, 0), toonMat(color));
  rock.scale.set(1.2, 0.72, 0.95);
  rock.position.set(x, 0.36 * scale, z);
  rock.rotation.set(0.13, x * 0.21, -0.08);
  root.add(rock);
}

function segment(
  root: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  width = 0.055,
): void {
  const delta = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(width, width, delta.length(), 6), glowingMaterial(color));
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  root.add(mesh);
}

function lightning(root: THREE.Object3D, x: number, color: number): void {
  const pts = [
    new THREE.Vector3(x, 3.9, -6.86),
    new THREE.Vector3(x - 0.32, 3.25, -6.84),
    new THREE.Vector3(x + 0.2, 2.65, -6.84),
    new THREE.Vector3(x - 0.18, 1.95, -6.84),
    new THREE.Vector3(x + 0.12, 1.35, -6.84),
  ];
  for (let i = 1; i < pts.length; i++) segment(root, pts[i - 1], pts[i], color, 0.07);
}

function makeFloorTexture(theme: BattleArenaTheme): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${theme.floor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 512, 512);

  // Match the checker/plank floor language used by the authored 2D interiors.
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 10; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = `#${theme.floorAlt.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x * 52, y * 64, 52, 64);
      }
    }
  }
  ctx.strokeStyle = `#${theme.accent.toString(16).padStart(6, '0')}55`;
  ctx.lineWidth = theme.motif === 'dojo' ? 2 : 1;
  const step = theme.motif === 'dojo' ? 32 : 64;
  for (let p = 0; p <= 512; p += step) {
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
    if (theme.motif !== 'dojo') {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
    }
  }
  if (theme.motif === 'tide') {
    ctx.lineWidth = 4;
    for (let y = 45; y < 512; y += 80) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const yy = y + Math.sin(x * 0.045) * 7;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addRoomShell(root: THREE.Group, theme: BattleArenaTheme): void {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 14),
    new THREE.MeshToonMaterial({ map: makeFloorTexture(theme), gradientMap: toonRamp() }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -0.4;
  root.add(floor);
  box(root, [18.4, 0.38, 14.4], mixed(theme.floor, 0x000000, 0.38), [0, -0.22, -0.4]);

  // The back and side walls are deliberately outside the battle sightline.
  box(root, [18.4, 5.8, 0.34], theme.wall, [0, 2.78, -7.25]);
  box(root, [0.34, 5.8, 14.4], theme.wall, [-9.15, 2.78, -0.4]);
  box(root, [0.34, 5.8, 14.4], theme.wall, [9.15, 2.78, -0.4]);
  box(root, [18.5, 0.22, 0.48], theme.accent, [0, 5.55, -7.05]);
  box(root, [18.5, 0.18, 0.48], theme.trim, [0, 0.18, -7.04]);

  // Leader's raised background dais and two battle-position floor seals.
  box(root, [7.2, 0.28, 2.0], theme.trim, [1.8, 0.02, -5.65]);
  box(root, [7.6, 0.12, 2.28], theme.accent, [1.8, -0.08, -5.65]);
  for (const [x, z] of [[-1.85, 1.15], [2.0, -2.4]] as const) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.62, 0.1, 36), toonMat(theme.floorAlt));
    pad.position.set(x, 0.01, z);
    root.add(pad);
    floorRing(root, x, z, theme.accent);
  }

  // Structural rhythm mirrors the repeated columns in both League towers.
  const columnColor = theme.family === 'northern' ? mixed(theme.wall, 0xffffff, 0.22) : theme.trim;
  // The laboratory has broad uninterrupted map boards, so only slim edge
  // pilasters remain; League/gym rooms retain their ceremonial colonnade.
  const columnPositions = theme.family === 'lab' ? [-8.35, 8.35] : [-7.5, -4.6, 4.6, 7.5];
  for (const x of columnPositions) {
    box(root, [0.62, 4.8, 0.62], columnColor, [x, 2.4, -6.78]);
    box(root, [0.88, 0.22, 0.82], theme.accent, [x, 4.84, -6.76]);
    box(root, [0.88, 0.18, 0.82], theme.trim, [x, 0.12, -6.76]);
  }

  const accentLight = new THREE.PointLight(theme.accent, 1.25, 12, 2);
  accentLight.position.set(2.2, 4.7, -4.2);
  root.add(accentLight);
}

function addForestDecor(root: THREE.Group, theme: BattleArenaTheme): void {
  for (const x of [-6.5, -4.8, 5.2, 6.8]) {
    cylinder(root, 0.32, 0.5, 3.7, 0x4b321e, [x, 1.85, -6.55], 8);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), toonMat(mixed(theme.accent, 0x19451d, 0.55)));
    crown.position.set(x, 4.1, -6.4);
    root.add(crown);
  }
  for (const x of [-7.4, -5.8, 5.8, 7.4]) {
    glowSphere(root, theme.accent, [x, 1.2 + (x % 2) * 0.25, -5.9], 0.09);
  }
}

function addFrostDecor(root: THREE.Group, theme: BattleArenaTheme, crane = false): void {
  for (const [x, z, s] of [[-7.2, -5.9, 1.25], [-5.3, -6.1, 0.85], [5.3, -6.1, 0.9], [7.2, -5.9, 1.3]] as const) {
    crystal(root, x, z, theme.accent, s);
  }
  wallRing(root, 0, 2.9, theme.accent, crane ? 1.25 : 1.0);
  if (crane) {
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.3, 5), toonMat(theme.accent));
      wing.position.set(side * 1.1, 2.9, -6.88);
      wing.rotation.z = side * 1.08;
      root.add(wing);
    }
  } else {
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.65, 16, 1, true), glowingMaterial(theme.accent, 0.75));
    bell.position.set(0, 2.95, -6.84);
    bell.rotation.z = Math.PI;
    root.add(bell);
  }
}

function addStageDecor(root: THREE.Group, theme: BattleArenaTheme): void {
  // Main idol stage: layered risers, LED walls and crossing translucent beams.
  box(root, [11.5, 0.35, 2.3], theme.trim, [0.8, 0.38, -5.8]);
  box(root, [9.6, 0.34, 1.8], mixed(theme.trim, theme.accent, 0.18), [1.3, 0.7, -6.0]);
  for (const x of [-6.2, -3.1, 0, 3.1, 6.2]) {
    box(root, [2.35, 2.3, 0.12], x === 0 ? theme.accent : mixed(theme.trim, theme.accent, 0.3), [x, 3.1, -6.94]);
  }
  for (const [x, color] of [[-5.6, 0x66ccff], [-2.0, 0xff66cc], [2.0, 0xffd54a], [5.6, 0x9d72ff]] as const) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.72, 5.2, 18, 1, true), glowingMaterial(color, 0.12));
    beam.position.set(x, 2.65, -3.2);
    beam.rotation.z = x < 0 ? -0.26 : 0.26;
    root.add(beam);
    glowSphere(root, color, [x, 5.1, -6.55], 0.18);
  }
}

function addThroneDecor(root: THREE.Group, theme: BattleArenaTheme): void {
  for (const x of [-6.2, -3.9, 4.6, 6.8]) banner(root, x, 0x65171b, theme.accent);
  box(root, [2.5, 0.34, 1.8], theme.trim, [1.9, 0.55, -6.0]);
  box(root, [1.45, 2.25, 0.55], 0x5a1518, [1.9, 1.75, -6.45]);
  box(root, [1.65, 0.25, 0.78], theme.accent, [1.9, 2.85, -6.42]);
  box(root, [1.35, 0.38, 0.78], theme.trim, [1.9, 1.05, -6.05]);
  for (const side of [-1, 1]) box(root, [0.25, 0.75, 0.85], theme.accent, [1.9 + side * 0.76, 1.3, -6.05]);
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glowingMaterial(theme.accent));
  crown.position.set(1.9, 3.45, -6.35);
  root.add(crown);
}

function addResearchLabDecor(root: THREE.Group, theme: BattleArenaTheme): void {
  const DARK = 0x172438, FRAME = 0x66758a, BENCH = 0x96a3b5;
  const SCREEN = 0x55ddcc, RED = 0xdd4050, BLUE = 0x66ccff;

  // The two wall maps reproduce the red Team Suri / black Nosdan pin boards
  // from SudoLabScene. Raised routes and pins remain readable from the battle
  // camera instead of relying on a flat unlit texture.
  for (const [cx, pinColor] of [[-4.35, RED], [4.35, 0x30343a]] as const) {
    box(root, [3.75, 2.28, 0.12], FRAME, [cx, 3.18, -6.98]);
    box(root, [3.48, 2.02, 0.08], DARK, [cx, 3.18, -6.9]);
    const route = [
      new THREE.Vector3(cx - 1.25, 2.62, -6.83),
      new THREE.Vector3(cx - 0.64, 3.38, -6.82),
      new THREE.Vector3(cx + 0.12, 3.0, -6.82),
      new THREE.Vector3(cx + 0.68, 3.66, -6.82),
      new THREE.Vector3(cx + 1.28, 3.16, -6.82),
    ];
    for (let i = 1; i < route.length; i++) segment(root, route[i - 1], route[i], mixed(pinColor, 0xffffff, 0.3), 0.025);
    const pins: Array<[number, number]> = [
      [-1.18, 0.54], [-0.78, -0.34], [-0.2, 0.17], [0.32, -0.48], [0.76, 0.45], [1.2, -0.08],
    ];
    for (const [dx, dy] of pins) glowSphere(root, pinColor, [cx + dx, 3.18 + dy, -6.76], 0.055);
  }

  // Central analyzer terminal and live cyan display.
  box(root, [1.62, 1.62, 0.18], FRAME, [0, 3.16, -6.92]);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.34, 0.08), glowingMaterial(SCREEN, 0.93));
  screen.position.set(0, 3.16, -6.76);
  root.add(screen);
  for (let i = 0; i < 4; i++) {
    box(root, [0.78 - i * 0.1, 0.035, 0.035], i % 2 ? 0xe7ffff : 0x1b7380,
      [-0.18 + i * 0.06, 3.56 - i * 0.25, -6.69], i % 2 ? -0.15 : 0.12);
  }

  // Stainless benches flank the enemy side. Glassware is genuinely
  // volumetric and emissive enough to survive the interior's soft lighting.
  for (const side of [-1, 1]) {
    const x = side * 5.55;
    box(root, [3.4, 0.18, 1.08], mixed(BENCH, 0xffffff, 0.18), [x, 1.0, -5.95]);
    for (const leg of [-1.35, 1.35]) box(root, [0.16, 1.0, 0.16], FRAME, [x + leg, 0.5, -5.95]);
    box(root, [3.28, 0.62, 0.18], BENCH, [x, 0.67, -6.37]);

    const fluids = side < 0 ? [BLUE, 0xffdf78, 0xa1efa8] : [0xf0a6d8, SCREEN, 0xff9c70];
    for (let i = 0; i < 3; i++) {
      const bx = x - 0.7 + i * 0.7;
      const flask = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glowingMaterial(fluids[i], 0.82));
      flask.scale.y = 1.25;
      flask.position.set(bx, 1.25, -5.78);
      root.add(flask);
      cylinder(root, 0.065, 0.075, 0.3, 0xdcecf3, [bx, 1.52, -5.78], 10);
    }
  }

  // Books and specimen boxes at the far left.
  box(root, [1.25, 3.3, 0.52], 0x7b6146, [-7.55, 1.7, -6.45]);
  for (const y of [0.55, 1.25, 1.95, 2.65, 3.3]) box(root, [1.18, 0.09, 0.62], 0x4e3b2b, [-7.55, y, -6.38]);
  const bookColors = [0xc84b4b, 0x4f78c8, 0x55a66a, 0xd2a541, 0x9966b6];
  for (let i = 0; i < 10; i++) {
    box(root, [0.15, 0.43, 0.14], bookColors[i % bookColors.length],
      [-7.98 + (i % 5) * 0.22, 0.82 + Math.floor(i / 5) * 0.71, -6.05], (i % 3 - 1) * 0.04);
  }

  // Compact healing machine with the same red cross as the authored lab.
  box(root, [1.28, 2.0, 0.72], 0xeaf0f7, [7.35, 1.04, -6.15]);
  box(root, [0.82, 0.66, 0.08], 0x26384d, [7.35, 1.44, -5.75]);
  box(root, [0.52, 0.12, 0.05], RED, [7.35, 1.44, -5.68]);
  box(root, [0.12, 0.52, 0.05], RED, [7.35, 1.44, -5.67]);
  for (const x of [7.05, 7.35, 7.65]) glowSphere(root, x === 7.35 ? SCREEN : BLUE, [x, 0.5, -5.74], 0.07);

  // Long clinical light strips brighten the pale room without placing a roof
  // in front of the cinematic camera.
  for (const x of [-5.4, -1.8, 1.8, 5.4]) {
    box(root, [2.55, 0.1, 0.25], 0xf5fbff, [x, 5.03, -5.95]);
    const light = new THREE.PointLight(0xdff7ff, 0.38, 7.5, 2);
    light.position.set(x, 4.75, -4.9);
    root.add(light);
  }
  const labAccent = new THREE.PointLight(theme.accent, 0.52, 8, 2);
  labAccent.position.set(0, 3.7, -5.3);
  root.add(labAccent);
}

function addMotifDecor(root: THREE.Group, theme: BattleArenaTheme): void {
  switch (theme.motif) {
    case 'shadow':
      for (const x of [-6.4, -3.5, 3.5, 6.4]) {
        wallRing(root, x, 2.7, theme.accent, 0.64);
        glowSphere(root, theme.accent, [x, 1.0, -6.6], 0.11);
      }
      wallRing(root, 0, 2.9, theme.accent, 1.35);
      break;
    case 'dojo':
      for (const x of [-6.4, -3.2, 3.2, 6.4]) {
        box(root, [0.38, 4.8, 0.44], 0x5a3a1a, [x, 2.4, -6.78]);
      }
      // Open highland-lake window and mountain silhouettes from the 2D gym.
      box(root, [6.8, 2.4, 0.08], 0x5aa2d8, [0, 3.0, -6.93]);
      for (const x of [-2.2, 0, 2.3]) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.9, 5), toonMat(0x607080));
        peak.position.set(x, 2.0, -6.84);
        root.add(peak);
      }
      break;
    case 'lantern':
      for (const x of [-7, -5, -3, -1, 1, 3, 5, 7]) lantern(root, x, 4.3 - Math.abs(x) * 0.06, -6.55, x % 4 ? 0xffb0e0 : 0xffd0a0);
      break;
    case 'tide':
      for (const x of [-6.2, -3.1, 0, 3.1, 6.2]) wallRing(root, x, 2.7, theme.accent, 0.72);
      for (const z of [-5.4, -3.6, -1.5, 0.8, 3.0]) {
        const water = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1.05), glowingMaterial(0x39bde8, 0.17));
        water.rotation.x = -Math.PI / 2;
        water.position.set(0, 0.065, z);
        root.add(water);
      }
      break;
    case 'forest':
      addForestDecor(root, theme);
      break;
    case 'storm':
      for (const x of [-6.2, -3.1, 3.1, 6.2]) lightning(root, x, theme.accent);
      for (const x of [-7.2, -4.6, 4.6, 7.2]) glowSphere(root, x < 0 ? theme.accent : 0x88ddff, [x, 1.15, -6.4], 0.13);
      break;
    case 'quarry':
    case 'stone':
      for (const [x, z, s] of [[-7.1, -5.5, 1.2], [-5.4, -6.0, 0.8], [5.1, -5.9, 0.9], [7.1, -5.4, 1.25]] as const) {
        boulder(root, x, z, mixed(theme.floorAlt, 0xffffff, 0.14), s);
      }
      banner(root, -2.2, theme.trim, theme.accent);
      banner(root, 2.2, theme.trim, theme.accent);
      break;
    case 'frost':
      addFrostDecor(root, theme);
      break;
    case 'crane':
      addFrostDecor(root, theme, true);
      break;
    case 'forge':
      for (const x of [-6.0, 5.8]) {
        box(root, [2.0, 2.1, 0.75], 0x2b2d31, [x, 1.15, -6.45]);
        box(root, [1.2, 0.75, 0.08], 0xff6b24, [x, 0.75, -6.03]);
        glowSphere(root, 0xff8a36, [x, 0.78, -5.92], 0.24);
        cylinder(root, 0.28, 0.38, 2.4, 0x4f555d, [x, 3.15, -6.55], 10);
      }
      for (const x of [-3.2, 0, 3.2]) banner(root, x, 0x34383f, theme.accent, true);
      break;
    case 'wind':
      for (const x of [-6, -3, 0, 3, 6]) {
        wallRing(root, x, 2.75 + Math.abs(x) * 0.06, theme.accent, 0.62);
        const vane = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.3, 5), toonMat(theme.accent));
        vane.position.set(x, 2.75, -6.84);
        vane.rotation.z = x * 0.12;
        root.add(vane);
      }
      break;
    case 'spirit':
      for (const x of [-6.4, -4.2, -2.1, 0, 2.1, 4.2, 6.4]) lantern(root, x, 4.05 + (Math.abs(x) % 2) * 0.18, -6.58, theme.accent);
      wallRing(root, 0, 2.55, theme.accent, 1.25);
      wallRing(root, 0, 2.55, mixed(theme.accent, 0xffffff, 0.45), 0.72);
      break;
    case 'idol':
      addStageDecor(root, theme);
      break;
    case 'fortress':
      for (const x of [-6.4, -3.2, 3.2, 6.4]) {
        box(root, [1.2, 3.5, 0.72], 0x454b53, [x, 1.75, -6.45]);
        banner(root, x, 0x67171b, theme.accent);
      }
      break;
    case 'tiger':
      for (const x of [-6.3, -4.2, 4.2, 6.3]) banner(root, x, 0xe8e6eb, 0x292331, true);
      wallRing(root, 0, 2.8, theme.accent, 1.28);
      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 8), toonMat(0xf5f3f6));
        fang.position.set(side * 0.48, 2.35, -6.82);
        fang.rotation.z = Math.PI;
        root.add(fang);
      }
      break;
    case 'throne':
      addThroneDecor(root, theme);
      break;
    case 'research':
      addResearchLabDecor(root, theme);
      break;
  }
}

/** Build a full indoor battle room around the existing combatant anchors. */
export function buildThemedBattleArena(root: THREE.Group, theme: BattleArenaTheme): void {
  addRoomShell(root, theme);
  addMotifDecor(root, theme);

  // A subtle family-specific ceiling beam completes the room silhouette without
  // lowering a roof into the battle camera.
  const beamColor = theme.family === 'northern' ? 0x4a1618
    : theme.family === 'lab' ? mixed(theme.wall, 0xffffff, 0.16) : theme.trim;
  box(root, [18.1, 0.34, 0.5], beamColor, [0, 5.15, -6.7]);
}
