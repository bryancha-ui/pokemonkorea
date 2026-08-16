import * as THREE from 'three';
import { toonMat } from './Props';

// ── Procedural protagonist model ─────────────────────────────────────────────
// A stylized low-poly 3D version of the hero, built from primitives so it
// needs no asset files and stays true to the original design: charcoal school
// blazer with a white collar — the boy with side-parted dark hair, red tie and
// grey trousers; the girl with a hair bun, pink backpack and pleated skirt.
// Limbs are pivoted groups driven by a walk cycle (arm/leg swing + bob), and
// the whole model yaws to face its movement direction.

const SKIN = 0xf0c8a0, HAIR = 0x1a1410, BLAZER = 0x33363e, COLLAR = 0xffffff;
const TROUSER = 0x555560, SKIRT = 0x2e3038, SHOE = 0xffffff, TIE = 0xcc2233;
const BACKPACK = 0xe86fa0;

/** A hand-authored limb pose, used for choreographed cutscene motion (the
 *  Champion's stage routine) instead of the procedural walk cycle. Every field
 *  is optional and defaults to the rest pose, so a keyframe only needs to name
 *  the joints it actually moves. Angles are radians. */
export interface ChoreoPose {
  armLX?: number; armLZ?: number; armLY?: number; elbowL?: number;
  armRX?: number; armRZ?: number; armRY?: number; elbowR?: number;
  legLX?: number; legRX?: number;
  torsoTilt?: number;    // lean, rotation.z
  torsoTwist?: number;   // rotation.y
  headTilt?: number;
  headTurn?: number;
  hop?: number;          // vertical offset of the whole figure
  spin?: number;         // yaw added on top of the facing direction
}

export interface PlayerModel {
  group: THREE.Group;
  /** phase advances while moving; moving=false eases limbs back to rest. */
  setWalk(phase: number, moving: boolean, dt: number): void;
  /** smoothly turn to face a world-space direction (dx, dz). */
  face(dx: number, dz: number, dt: number): void;
  /** Drive the limbs directly from a keyframed pose. Present on the generic NPC
   *  figure; the protagonist model keeps its own walk/ride rig. */
  setChoreo?(pose: ChoreoPose): void;
  /** World-space position of the right hand — where a thrown ball leaves from. */
  rightHandWorld?(out: THREE.Vector3): THREE.Vector3;
  /** The forearm node, so a held prop (a Poké Ball) can ride the hand until it
   *  is released. */
  rightHandAttach?(): THREE.Object3D;
  /** Optional vehicle pose used by the protagonist's true-3D bicycle. */
  setRiding?(riding: boolean): void;
  /** Water-mount pose: the hero sits on the Surf Pokémon instead of walking. */
  setSurfing?(surfing: boolean): void;
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  // Rounded extruded rectangles preserve crisp costume panels while removing
  // the cuboid/Minecraft silhouette of the old primitive characters.
  const r = Math.max(0.002, Math.min(w, h) * 0.16);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bevel = Math.min(r * 0.45, d * 0.18);
  const depth = Math.max(0.001, d - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 2,
    bevelEnabled: bevel > 0.001, bevelSegments: 2,
    bevelSize: bevel, bevelThickness: bevel,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toonMat(color));
}

function ellipsoid(w: number, h: number, d: number, color: number, detail = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, detail, Math.max(8, detail - 4)), toonMat(color));
  mesh.scale.set(w, h, d);
  return mesh;
}

function capsule(w: number, h: number, d: number, color: number): THREE.Mesh {
  const radius = Math.max(0.008, Math.min(w, d) * 0.5);
  const body = Math.max(0.001, h - radius * 2);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, body, 4, 10), toonMat(color));
  mesh.scale.set(w / (radius * 2), 1, d / (radius * 2));
  return mesh;
}

export function buildPlayerModel(design: 'boy' | 'girl'): PlayerModel {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const H = 0.94;                       // total height in world units (≈30px)
  const s = H / 0.94;

  // ── legs (pivot at hip) ──
  const legL = new THREE.Group(), legR = new THREE.Group();
  const legColor = design === 'boy' ? TROUSER : SKIN;
  for (const [leg, off] of [[legL, -0.075], [legR, 0.075]] as [THREE.Group, number][]) {
    const l = capsule(0.11 * s, 0.34 * s, 0.13 * s, legColor);
    l.position.y = -0.17 * s;
    const shoe = ellipsoid(0.13 * s, 0.075 * s, 0.18 * s, SHOE);
    shoe.position.set(0, -0.335 * s, 0.02 * s);
    leg.add(l, shoe);
    leg.position.set(off * s, 0.41 * s, 0);
    body.add(leg);
  }

  // ── torso ──
  const torso = new THREE.Group();
  const jacket = ellipsoid(0.35 * s, 0.36 * s, 0.21 * s, BLAZER, 14);
  jacket.position.y = 0.58 * s;
  torso.add(jacket);
  const collar = box(0.35 * s, 0.055 * s, 0.21 * s, COLLAR);
  collar.position.y = 0.735 * s;
  torso.add(collar);
  if (design === 'boy') {
    const tie = box(0.05 * s, 0.16 * s, 0.02 * s, TIE);
    tie.position.set(0, 0.63 * s, 0.11 * s);
    torso.add(tie);
  } else {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.21 * s, 0.14 * s, 8), toonMat(SKIRT));
    skirt.position.y = 0.385 * s;
    torso.add(skirt);
    const pack = box(0.24 * s, 0.26 * s, 0.1 * s, BACKPACK);
    pack.position.set(0, 0.58 * s, -0.16 * s);
    torso.add(pack);
  }
  body.add(torso);

  // ── arms (pivot at shoulder) ──
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [arm, off] of [[armL, -0.215], [armR, 0.215]] as [THREE.Group, number][]) {
    const sleeve = capsule(0.095 * s, 0.25 * s, 0.115 * s, BLAZER);
    sleeve.position.y = -0.1 * s;
    const hand = ellipsoid(0.085 * s, 0.08 * s, 0.095 * s, SKIN);
    hand.position.y = -0.25 * s;
    arm.add(sleeve, hand);
    arm.position.set(off * s, 0.72 * s, 0);
    body.add(arm);
  }

  // ── head ──
  const head = new THREE.Group();
  const face = ellipsoid(0.285 * s, 0.265 * s, 0.255 * s, SKIN, 16);
  face.position.y = 0.905 * s;
  head.add(face);
  // hair: cap over the top + back
  const hairTop = ellipsoid(0.302 * s, 0.14 * s, 0.275 * s, HAIR, 14);
  hairTop.position.y = 1.002 * s;
  head.add(hairTop);
  const hairBack = box(0.28 * s, 0.18 * s, 0.08 * s, HAIR);
  hairBack.position.set(0, 0.9 * s, -0.1 * s);
  head.add(hairBack);
  if (design === 'girl') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), toonMat(HAIR));
    bun.position.set(0, 1.06 * s, -0.06 * s);
    head.add(bun);
  } else {
    const fringe = box(0.28 * s, 0.06 * s, 0.03 * s, HAIR);
    fringe.position.set(0, 0.985 * s, 0.125 * s);
    head.add(fringe);
  }
  // simple eyes so the front reads as a face
  for (const ex of [-0.06, 0.06]) {
    const eye = ellipsoid(0.034 * s, 0.052 * s, 0.014 * s, 0x22232a, 8);
    eye.position.set(ex * s, 0.9 * s, 0.128 * s);
    head.add(eye);
  }
  body.add(head);

  // Proper 3D bicycle for the cycling state. The old renderer switched the
  // whole hero back to a flat sprite whenever the art became wide; keeping the
  // vehicle in this model means the protagonist remains 3D in every state.
  const bike = new THREE.Group();
  bike.visible = false;
  const wheelMaterial = toonMat(0x1a1b1e);
  const rimMaterial = toonMat(0xc9d2da);
  const bikeMaterial = toonMat(0x256fd0);
  const wheels: THREE.Mesh[] = [];
  for (const z of [-0.34, 0.34]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.028, 7, 18), wheelMaterial);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(0, 0.245, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.009, 5, 16), rimMaterial);
    rim.rotation.y = Math.PI / 2;
    rim.position.copy(tire.position);
    bike.add(tire, rim);
    wheels.push(tire, rim);
  }
  const tube = (a: THREE.Vector3, b: THREE.Vector3, radius = 0.018, mat = bikeMaterial) => {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 7), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    bike.add(mesh);
  };
  const crank = new THREE.Vector3(0, 0.27, -0.02);
  const seatPost = new THREE.Vector3(0, 0.53, -0.12);
  const handle = new THREE.Vector3(0, 0.56, 0.27);
  tube(new THREE.Vector3(0, 0.245, -0.34), crank);
  tube(new THREE.Vector3(0, 0.245, 0.34), crank);
  tube(crank, seatPost);
  tube(seatPost, handle);
  tube(handle, new THREE.Vector3(0, 0.245, 0.34), 0.015, rimMaterial);
  const seat = box(0.16, 0.035, 0.09, 0x202226); seat.position.copy(seatPost); bike.add(seat);
  const bar = box(0.3, 0.025, 0.025, 0xd9e0e5); bar.position.copy(handle); bike.add(bar);
  const pedal = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 5, 12), rimMaterial);
  pedal.rotation.y = Math.PI / 2; pedal.position.copy(crank); bike.add(pedal);
  group.add(body, bike);

  // state
  let yaw = 0, targetYaw = 0, restEase = 0, riding = false, surfing = false;

  return {
    group,
    setWalk(phase: number, moving: boolean, dt: number) {
      restEase = THREE.MathUtils.clamp(restEase + (moving ? dt * 8 : -dt * 6), 0, 1);
      const mounted = riding || surfing;
      const swing = Math.sin(phase) * (mounted ? 0.18 : 0.75) * restEase;
      legL.rotation.x = mounted ? 0.95 + swing : swing;
      legR.rotation.x = mounted ? 0.95 - swing : -swing;
      armL.rotation.x = mounted ? -0.58 : -swing * 0.8;
      armR.rotation.x = mounted ? -0.58 : swing * 0.8;
      const bob = Math.abs(Math.sin(phase)) * (mounted ? 0.018 : 0.035) * restEase;
      const breathe = moving ? 0 : Math.sin(phase * 0.35) * 0.008;
      group.position.y = mounted ? 0 : bob;
      body.position.y = (mounted ? 0.28 : 0) + (mounted ? bob : 0);
      torso.scale.y = 1 + breathe;
      head.position.y = breathe * 0.5;
      if (riding && moving) for (const wheel of wheels) wheel.rotation.x -= dt * 9;
    },
    face(dx: number, dz: number, dt: number) {
      if (Math.abs(dx) + Math.abs(dz) > 0.001) {
        targetYaw = Math.atan2(dx, dz);       // model front is +z
      }
      let d = targetYaw - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += d * Math.min(1, dt * 12);
      group.rotation.y = yaw;
    },
    setRiding(on: boolean) {
      riding = on;
      bike.visible = on;
      if (!on) body.position.y = 0;
    },
    setSurfing(on: boolean) {
      surfing = on;
      if (on) bike.visible = false;
      if (!on && !riding) body.position.y = 0;
    },
  };
}

type BodyShape = 'slim' | 'average' | 'broad' | 'heroic';
type OutfitStyle = 'trainer' | 'uniform' | 'coat' | 'robe' | 'hanbok' | 'armor' | 'winter' | 'martial';
type HairStyle = 'short' | 'spiky' | 'bob' | 'long' | 'bun' | 'braid' | 'topknot' | 'wild';
type HeldProp = 'staff' | 'sword' | 'lantern';

export interface CharacterProfile {
  skin?: number;
  hair: number;
  outfit: number;
  secondary: number;
  accent: number;
  trousers?: number;
  shoes?: number;
  body?: BodyShape;
  outfitStyle?: OutfitStyle;
  hairStyle?: HairStyle;
  hat?: 'beret' | 'wide' | 'crown' | 'hood' | 'helmet' | 'mask';
  cape?: number;
  fur?: number;
  glasses?: boolean;
  scarf?: number;
  prop?: HeldProp;
  height?: number;
}

const DEFAULT_PROFILE: CharacterProfile = {
  hair: 0x1b1715, outfit: 0x343741, secondary: 0xf5f5f2, accent: 0xb92335,
  trousers: 0x282b32, shoes: 0x17181c, body: 'average', outfitStyle: 'trainer', hairStyle: 'short',
};

/** Visual profiles keyed by the authored portrait texture.  They deliberately
 * describe silhouettes and signature colours rather than copying portrait
 * pixels: every result is a genuine, rotatable low-poly humanoid. */
const CHARACTER_PROFILES: Record<string, CharacterProfile> = {
  // ── Seolbong summit school ──
  // The mountain dojo's people, each built to read as a distinct person at a
  // glance: rank shows in the belt/sash colour, role in the silhouette (staff,
  // sword, hood, apron), and seniority in body shape and hair.
  seolbong_master:   { skin: 0xe8c49a, hair: 0xe9e4dc, outfit: 0x2f3a52, secondary: 0xd8c39a, accent: 0x1d2433, trousers: 0x2a3244, outfitStyle: 'martial', hairStyle: 'topknot', body: 'broad', prop: 'staff', scarf: 0x8c2f2a },
  seolbong_sensei:   { skin: 0xd9a97a, hair: 0x2a2320, outfit: 0xf2efe6, secondary: 0x1d2433, accent: 0x8c2f2a, trousers: 0x232a36, outfitStyle: 'martial', hairStyle: 'bun', body: 'average', scarf: 0x2f5f8f },
  seolbong_swordsman:{ skin: 0xf0c8a0, hair: 0x1c1a19, outfit: 0x3d4f6b, secondary: 0xe6e2d8, accent: 0xd8b45a, outfitStyle: 'martial', hairStyle: 'topknot', body: 'heroic', prop: 'sword' },
  seolbong_monk:     { skin: 0xc98f5e, hair: 0x3a2c22, outfit: 0x9a5a2a, secondary: 0xd8a44a, accent: 0x6b3a18, outfitStyle: 'robe', hairStyle: 'short', body: 'average', prop: 'lantern' },
  seolbong_elder:    { skin: 0xdcb98f, hair: 0xf0ece4, outfit: 0x4a4f6a, secondary: 0xcdc6b6, accent: 0x6f7590, outfitStyle: 'robe', hairStyle: 'long', body: 'slim', glasses: true, prop: 'staff' },
  seolbong_disciple_a:{ skin: 0xf2cfa6, hair: 0x241f1c, outfit: 0xf4f1e8, secondary: 0x2f3a52, accent: 0xffffff, trousers: 0xe8e3d8, outfitStyle: 'martial', hairStyle: 'short', body: 'slim' },
  seolbong_disciple_b:{ skin: 0xc98f5e, hair: 0x14100e, outfit: 0xf4f1e8, secondary: 0x2f3a52, accent: 0xd8b45a, trousers: 0xe8e3d8, outfitStyle: 'martial', hairStyle: 'braid', body: 'slim' },
  seolbong_disciple_c:{ skin: 0xe8c49a, hair: 0x5a3a20, outfit: 0xf4f1e8, secondary: 0x2f3a52, accent: 0x3f8f5a, trousers: 0xe8e3d8, outfitStyle: 'martial', hairStyle: 'spiky', body: 'average' },
  seolbong_disciple_d:{ skin: 0xa9713f, hair: 0x100d0c, outfit: 0xf4f1e8, secondary: 0x2f3a52, accent: 0x8c2f2a, trousers: 0xe8e3d8, outfitStyle: 'martial', hairStyle: 'bun', body: 'average' },
  seolbong_disciple_e:{ skin: 0xf0c8a0, hair: 0x6a4a22, outfit: 0xf4f1e8, secondary: 0x2f3a52, accent: 0x2f5f8f, trousers: 0xe8e3d8, outfitStyle: 'martial', hairStyle: 'wild', body: 'slim' },
  seolbong_fighter_a:{ skin: 0xd9a97a, hair: 0x241f1c, outfit: 0xb03a32, secondary: 0x2a2f38, accent: 0xf0e6cc, trousers: 0x2a2f38, outfitStyle: 'martial', hairStyle: 'spiky', body: 'broad' },
  seolbong_fighter_b:{ skin: 0xf2cfa6, hair: 0x2f4a8a, outfit: 0x2f5f8f, secondary: 0x2a2f38, accent: 0xf0e6cc, trousers: 0x2a2f38, outfitStyle: 'martial', hairStyle: 'bob', body: 'broad' },
  seolbong_guide:    { skin: 0xc98f5e, hair: 0x3a2c22, outfit: 0x3f6b4a, secondary: 0xd8c39a, accent: 0xd8b45a, outfitStyle: 'winter', hairStyle: 'short', body: 'average', hat: 'wide', scarf: 0xb03a32 },
  seolbong_keeper:   { skin: 0xe8c49a, hair: 0x4a3524, outfit: 0x8a5a34, secondary: 0xf0e6cc, accent: 0x5f4326, outfitStyle: 'hanbok', hairStyle: 'bun', body: 'average' },
  seolbong_bather:   { skin: 0xf0c8a0, hair: 0x1c1a19, outfit: 0xdfe8ee, secondary: 0x9ec7dd, accent: 0xf2f7fb, outfitStyle: 'robe', hairStyle: 'bun', body: 'average', scarf: 0xf2f7fb },
  seolbong_smith:    { skin: 0xa9713f, hair: 0x2a2320, outfit: 0x4a4038, secondary: 0x8a5a34, accent: 0xd86a2a, outfitStyle: 'uniform', hairStyle: 'wild', body: 'broad' },

  // Pokémon Center staff use opaque low-poly characters. Previously their
  // generic Graphics were extruded as alpha-blended reliefs, which made faces
  // appear transparent against the bright Center interior.
  center_nurse:        { skin: 0xf0c8a0, hair: 0xc94f76, outfit: 0xf7f4f2, secondary: 0xf08aaa, accent: 0xc92d4c, outfitStyle: 'uniform', hairStyle: 'bun', body: 'slim' },
  center_clerk:        { skin: 0xf0c8a0, hair: 0x27241f, outfit: 0x2f8c58, secondary: 0xd9f1e2, accent: 0xf0c94e, outfitStyle: 'uniform', hairStyle: 'short' },
  center_pc_attendant: { skin: 0xf0c8a0, hair: 0x18243b, outfit: 0x315dc0, secondary: 0xdbe8ff, accent: 0x70d6f2, outfitStyle: 'uniform', hairStyle: 'short' },
  npc_gyeoul:    { hair: 0xe8edf2, outfit: 0xeef7fa, secondary: 0xa8dceb, accent: 0x73b8d4, outfitStyle: 'hanbok', hairStyle: 'long', body: 'slim' },
  npc_hwageum:   { hair: 0x31352d, outfit: 0x536b54, secondary: 0x313b35, accent: 0xb89a53, outfitStyle: 'armor', hairStyle: 'topknot', prop: 'sword' },
  npc_baram:     { hair: 0xd9e0e7, outfit: 0x33485c, secondary: 0x899bab, accent: 0x6b91b3, outfitStyle: 'coat', hairStyle: 'spiky', cape: 0x8fa2ae, body: 'slim' },
  npc_saleum:    { hair: 0x201813, outfit: 0xb42332, secondary: 0x2d846e, accent: 0xe8b844, outfitStyle: 'hanbok', hairStyle: 'bun', hat: 'crown' },
  // Champion Hwangeum — idol-styled stage uniform: black military jacket with
  // white lapel piping and bright gold trim/chain, black trousers with a gold
  // side stripe, white-and-gold high-tops, swept indigo hair. Matches the
  // champion battle portrait (npc_hwangeum.png).
  npc_hwangeum:  { skin: 0xf0c8a0, hair: 0x342a57, outfit: 0x14181e, secondary: 0xf4f4f2, accent: 0xe0b52e, trousers: 0x15171c, shoes: 0xf2f2f0, body: 'slim', outfitStyle: 'uniform', hairStyle: 'spiky', height: 1.05 },
  npc_jin:       { hair: 0x17161a, outfit: 0x202129, secondary: 0x373844, accent: 0x7d578f, outfitStyle: 'coat', hairStyle: 'bob', hat: 'beret', body: 'slim' },
  npc_byeoksan:  { hair: 0x24201d, outfit: 0xf3f0e8, secondary: 0xe2ded5, accent: 0x17171a, outfitStyle: 'martial', hairStyle: 'short', body: 'broad' },
  npc_namsun:    { hair: 0x55352b, outfit: 0x4c4891, secondary: 0x783b50, accent: 0xd19c55, outfitStyle: 'uniform', hairStyle: 'short', body: 'broad' },
  npc_harang:    { hair: 0x202127, outfit: 0x24425f, secondary: 0x93b9d7, accent: 0xd3e5ef, outfitStyle: 'uniform', hairStyle: 'short', glasses: true },
  npc_noksaek:   { hair: 0xb7b8ae, outfit: 0x315f42, secondary: 0x244833, accent: 0x8eaa62, outfitStyle: 'robe', hairStyle: 'long', hat: 'hood', prop: 'staff' },
  npc_beonge:    { hair: 0x6a4631, outfit: 0xe9b92e, secondary: 0x272b32, accent: 0xf2df70, outfitStyle: 'coat', hairStyle: 'spiky' },
  npc_sandol:    { hair: 0x4f392b, outfit: 0x9a8a62, secondary: 0xc3af76, accent: 0x66523b, outfitStyle: 'trainer', hairStyle: 'short', body: 'slim' },
  npc_yeona:     { hair: 0xe3e5ea, outfit: 0xf1f2f4, secondary: 0x26364d, accent: 0x8cc9e4, outfitStyle: 'winter', hairStyle: 'bun', scarf: 0x26364d, fur: 0xe9f6fa },
  npc_ryeo:      { hair: 0x93969c, outfit: 0x161a20, secondary: 0x343b46, accent: 0x9e2731, outfitStyle: 'uniform', hairStyle: 'short' },
  npc_suri:      { hair: 0xc5c7ca, outfit: 0x50545b, secondary: 0x282c33, accent: 0x8b2028, outfitStyle: 'coat', hairStyle: 'long' },
  npc_eosajang:  { skin: 0x9a603f, hair: 0x4a2d21, outfit: 0x9e2830, secondary: 0x25282d, accent: 0xd7a348, outfitStyle: 'coat', hairStyle: 'short', fur: 0xe2d5bd, prop: 'sword', body: 'broad' },
  npc_salmu:     { hair: 0xd9d7dc, outfit: 0x705692, secondary: 0x1d2028, accent: 0xb72f48, outfitStyle: 'coat', hairStyle: 'long', glasses: true, scarf: 0xa32236, body: 'slim' },
  npc_jito:      { hair: 0x34312d, outfit: 0x20242a, secondary: 0x292d33, accent: 0xb42731, outfitStyle: 'robe', hairStyle: 'short', prop: 'lantern', body: 'broad' },
  npc_gapcheol:  { hair: 0x70744a, outfit: 0xa52a31, secondary: 0x252a2c, accent: 0xd4ad54, outfitStyle: 'armor', hairStyle: 'long', hat: 'helmet', fur: 0xe1d2b8, prop: 'sword' },
  npc_dosadae:   { hair: 0xe4bec8, outfit: 0x22242b, secondary: 0x6b4651, accent: 0xb8384a, outfitStyle: 'hanbok', hairStyle: 'long', hat: 'wide', prop: 'staff', body: 'slim' },
  npc_jinnok:    { hair: 0x4c8a59, outfit: 0x254f39, secondary: 0x171d1b, accent: 0xa83438, outfitStyle: 'robe', hairStyle: 'wild', hat: 'mask', prop: 'staff' },
  npc_chaeyeon:  { hair: 0x191719, outfit: 0x171a20, secondary: 0xa32939, accent: 0xd05a62, outfitStyle: 'coat', hairStyle: 'bob', body: 'slim' },
  npc_mubaek:    { hair: 0xa7a9ac, outfit: 0x171a20, secondary: 0x30343b, accent: 0x8e2530, outfitStyle: 'coat', hairStyle: 'short', body: 'broad' },
  npc_seollan:   { hair: 0xe5e7e8, outfit: 0x171b24, secondary: 0x343b47, accent: 0xaac5d2, outfitStyle: 'winter', hairStyle: 'long', fur: 0xe0e5e5 },
  npc_seorak:    { hair: 0xb6b7b6, outfit: 0x6d4b35, secondary: 0x3c3028, accent: 0xb28a52, outfitStyle: 'armor', hairStyle: 'wild', fur: 0xb9aa8e, body: 'heroic', height: 1.08 },
  npc_hanseol:   { hair: 0xebedf0, outfit: 0xe8f2f5, secondary: 0xa5d5e5, accent: 0x6eaec6, outfitStyle: 'winter', hairStyle: 'braid', fur: 0xf5fbfc, body: 'slim' },
  npc_cheolgang: { hair: 0x292829, outfit: 0x252b32, secondary: 0x4a5058, accent: 0x8e2831, outfitStyle: 'armor', hairStyle: 'short', cape: 0x6e2028, body: 'broad' },
  npc_baekho:    { hair: 0xe5e4e5, outfit: 0x59437b, secondary: 0x343040, accent: 0xc4a75a, outfitStyle: 'armor', hairStyle: 'wild', cape: 0xe8e4d8, fur: 0xf1eee5, body: 'heroic' },
  npc_taewang:   { hair: 0xbcbfc1, outfit: 0x4d5053, secondary: 0x313438, accent: 0xb59352, outfitStyle: 'armor', hairStyle: 'wild', fur: 0xb8b2a8, cape: 0x5f2529, body: 'broad' },
  npc_sovereign: { hair: 0xb5b6b5, outfit: 0x17191d, secondary: 0x4a3030, accent: 0xd0a84f, outfitStyle: 'robe', hairStyle: 'short', hat: 'crown', cape: 0x2b2328 },
  npc_song:      { hair: 0x858789, outfit: 0x72777d, secondary: 0x24282d, accent: 0x9e2830, outfitStyle: 'coat', hairStyle: 'spiky', glasses: true },
};

function cylinder(rt: number, rb: number, h: number, color: number, segments = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), toonMat(color));
}

/** Build a protagonist-style true 3D model for a named trainer or story NPC. */
export function buildCharacterModel(
  key: string,
  fallbackDesign: 'boy' | 'girl' = 'boy',
  profile?: Partial<CharacterProfile>,
): PlayerModel {
  if (key === 'trainer_boy' || key === 'trainer_girl') {
    return buildPlayerModel(key === 'trainer_girl' ? 'girl' : 'boy');
  }
  const fallback = fallbackDesign === 'girl'
    ? { ...DEFAULT_PROFILE, hairStyle: 'bun' as HairStyle, accent: BACKPACK }
    : DEFAULT_PROFILE;
  const p = { ...fallback, ...(CHARACTER_PROFILES[key] ?? {}), ...(profile ?? {}) };
  const group = new THREE.Group();
  const width = p.body === 'heroic' ? 1.38 : p.body === 'broad' ? 1.2 : p.body === 'slim' ? 0.9 : 1;
  const skin = p.skin ?? SKIN;
  const trousers = p.trousers ?? (p.outfitStyle === 'martial' ? 0xeee9df : 0x262a30);
  const shoes = p.shoes ?? 0x191a1e;
  const legL = new THREE.Group(), legR = new THREE.Group();

  for (const [leg, off] of [[legL, -0.075], [legR, 0.075]] as [THREE.Group, number][]) {
    const shin = capsule(0.11 * width, 0.35, 0.13 * width, trousers);
    shin.position.y = -0.175;
    const boot = ellipsoid(0.14 * width, p.outfitStyle === 'armor' ? 0.125 : 0.08, 0.185, shoes);
    boot.position.set(0, -0.34, 0.025);
    leg.add(shin, boot);
    leg.position.set(off * width, 0.41, 0);
    group.add(leg);
  }

  const torso = new THREE.Group();
  const torsoW = 0.35 * width;
  const torsoMesh = p.outfitStyle === 'armor'
    ? box(torsoW, 0.35, 0.24, p.outfit)
    : ellipsoid(torsoW, 0.36, 0.205, p.outfit, 14);
  torsoMesh.position.y = 0.59;
  torso.add(torsoMesh);
  if (p.outfitStyle === 'coat' || p.outfitStyle === 'winter') {
    const tails = cylinder(0.16 * width, 0.23 * width, 0.3, p.outfit);
    tails.position.y = 0.38;
    torso.add(tails);
  } else if (p.outfitStyle === 'robe' || p.outfitStyle === 'hanbok') {
    const robe = cylinder(0.17 * width, 0.29 * width, 0.39, p.outfit);
    robe.position.y = 0.37;
    torso.add(robe);
    const sash = box(0.37 * width, 0.055, 0.215, p.accent);
    sash.position.y = 0.54;
    torso.add(sash);
  } else if (p.outfitStyle === 'martial') {
    const belt = box(0.38 * width, 0.06, 0.22, p.accent);
    belt.position.y = 0.47;
    torso.add(belt);
  } else {
    const trim = box(0.36 * width, 0.055, 0.21, p.secondary);
    trim.position.y = 0.735;
    torso.add(trim);
  }
  if (p.outfitStyle === 'armor') {
    const chest = box(0.3 * width, 0.22, 0.255, p.secondary);
    chest.position.set(0, 0.62, 0.02);
    torso.add(chest);
    for (const x of [-0.23 * width, 0.23 * width]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.105 * width, 8, 5), toonMat(p.secondary));
      pad.scale.y = 0.65; pad.position.set(x, 0.72, 0); torso.add(pad);
    }
  }
  if (p.cape !== undefined) {
    const cape = cylinder(0.15 * width, 0.28 * width, 0.55, p.cape, 10);
    cape.scale.z = 0.28; cape.position.set(0, 0.49, -0.14); torso.add(cape);
  }
  if (p.fur !== undefined) {
    const fur = new THREE.Mesh(new THREE.TorusGeometry(0.2 * width, 0.045, 5, 10), toonMat(p.fur));
    fur.rotation.x = Math.PI / 2; fur.position.y = 0.76; torso.add(fur);
  }
  if (p.scarf !== undefined) {
    const scarf = box(0.3 * width, 0.07, 0.23, p.scarf); scarf.position.y = 0.77; torso.add(scarf);
    const tail = box(0.07, 0.3, 0.035, p.scarf); tail.position.set(0.12, 0.55, -0.12); torso.add(tail);
  }
  group.add(torso);

  // Arms are two-bone: shoulder → elbow → hand. A single rigid arm cannot throw
  // — a real throw leads with the elbow and extends late — so the forearm is its
  // own group. At rest both joints sit at zero and the silhouette is identical to
  // the old one-piece arm, so every other NPC looks unchanged.
  const armL = new THREE.Group(), armR = new THREE.Group();
  const foreL = new THREE.Group(), foreR = new THREE.Group();
  const ELBOW_Y = -0.13;
  for (const [arm, fore, off] of [
    [armL, foreL, -0.215 * width], [armR, foreR, 0.215 * width],
  ] as [THREE.Group, THREE.Group, number][]) {
    const upper = capsule(0.1 * width, 0.13, 0.12 * width, p.outfit);
    upper.position.y = -0.06;
    const lower = capsule(0.095 * width, 0.11, 0.115 * width, p.outfit);
    lower.position.y = -0.055;
    const hand = ellipsoid(0.09 * width, 0.08, 0.1, skin);
    hand.position.y = -0.125;
    fore.add(lower, hand);
    fore.position.y = ELBOW_Y;
    arm.add(upper, fore);
    arm.position.set(off, 0.72, 0);
    group.add(arm);
  }

  const head = new THREE.Group();
  const face = ellipsoid(0.285 * width, 0.265, 0.255, skin, 16); face.position.y = 0.905; head.add(face);
  const addHairBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const hair = box(w * width, h, d, p.hair); hair.position.set(x * width, y, z); head.add(hair);
  };
  const hairCap = ellipsoid(0.302 * width, 0.14, 0.275, p.hair, 14);
  hairCap.position.y = 1.002;
  head.add(hairCap);
  if (p.hairStyle === 'long' || p.hairStyle === 'bob' || p.hairStyle === 'braid' || p.hairStyle === 'wild') {
    addHairBox(0.29, p.hairStyle === 'long' ? 0.3 : 0.2, 0.08, 0, p.hairStyle === 'long' ? 0.86 : 0.9, -0.1);
  }
  if (p.hairStyle === 'spiky' || p.hairStyle === 'wild') {
    for (const [x, y, r] of [[-0.09, 1.05, -0.25], [0, 1.08, 0], [0.09, 1.04, 0.25]] as [number, number, number][]) {
      const spike = cylinder(0, 0.055 * width, 0.19, p.hair, 5); spike.position.set(x * width, y, 0); spike.rotation.z = r; head.add(spike);
    }
  }
  if (p.hairStyle === 'bun' || p.hairStyle === 'topknot') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(p.hairStyle === 'topknot' ? 0.065 : 0.09, 8, 6), toonMat(p.hair));
    bun.position.set(0, 1.075, p.hairStyle === 'topknot' ? 0 : -0.05); head.add(bun);
  }
  if (p.hairStyle === 'braid') {
    for (let i = 0; i < 4; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), toonMat(p.hair));
      bead.position.set(0.13 * width, 0.87 - i * 0.08, -0.08); head.add(bead);
    }
  }
  for (const ex of [-0.06, 0.06]) {
    const eye = ellipsoid(0.032, 0.048, 0.014, 0x22232a, 8); eye.position.set(ex * width, 0.9, 0.13); head.add(eye);
  }
  if (p.glasses) {
    for (const ex of [-0.06, 0.06]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 4, 8), toonMat(0x20242a));
      lens.position.set(ex * width, 0.9, 0.137); head.add(lens);
    }
    const bridge = box(0.04, 0.012, 0.012, 0x20242a); bridge.position.set(0, 0.9, 0.137); head.add(bridge);
  }
  if (p.hat === 'beret') {
    const hat = cylinder(0.16 * width, 0.16 * width, 0.05, 0x17171b, 10); hat.position.set(-0.02, 1.075, 0); hat.rotation.z = -0.12; head.add(hat);
  } else if (p.hat === 'wide') {
    const brim = cylinder(0.24 * width, 0.24 * width, 0.025, 0x202127, 12); brim.position.y = 1.07; head.add(brim);
    const crown = cylinder(0.11 * width, 0.15 * width, 0.17, 0x202127, 10); crown.position.y = 1.15; head.add(crown);
  } else if (p.hat === 'crown') {
    const crown = cylinder(0.07 * width, 0.12 * width, 0.17, p.accent, 6); crown.position.y = 1.14; head.add(crown);
  } else if (p.hat === 'hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.18 * width, 8, 6), toonMat(p.outfit));
    hood.scale.z = 0.8; hood.position.y = 0.96; head.add(hood); face.position.z = 0.08;
  } else if (p.hat === 'helmet') {
    // Open-face helmet: a dome caps the crown and a brow band sits above the
    // eyes, so the face (and eyes) stay visible instead of being covered.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.175 * width, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      toonMat(p.secondary),
    );
    dome.position.y = 1.0; head.add(dome);
    const band = box(0.3 * width, 0.05, 0.245, p.accent); band.position.set(0, 0.985, 0.01); head.add(band);
  } else if (p.hat === 'mask') {
    const mask = box(0.2 * width, 0.18, 0.03, 0xb89a68); mask.position.set(0, 0.91, 0.145); head.add(mask);
    for (const ex of [-0.055, 0.055]) { const slit = box(0.035, 0.02, 0.012, 0x18201a); slit.position.set(ex, 0.92, 0.165); head.add(slit); }
  }
  group.add(head);

  if (p.prop) {
    const propRoot = new THREE.Group(); propRoot.position.set(0.32 * width, 0.42, 0.02);
    if (p.prop === 'staff' || p.prop === 'lantern') {
      const pole = cylinder(0.018, 0.018, 0.85, p.prop === 'staff' ? 0x5c412c : 0x222429, 6); pole.position.y = 0.18; propRoot.add(pole);
      if (p.prop === 'lantern') { const lamp = box(0.13, 0.17, 0.13, 0xd3a13d); lamp.position.y = -0.18; propRoot.add(lamp); }
      else { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), toonMat(p.accent)); cap.position.y = 0.62; propRoot.add(cap); }
    } else {
      const blade = box(0.035, 0.68, 0.02, 0xd7dce0); blade.position.y = 0.15; propRoot.add(blade);
      const guard = box(0.17, 0.035, 0.05, p.accent); guard.position.y = -0.18; propRoot.add(guard);
    }
    group.add(propRoot);
  }

  group.scale.setScalar(p.height ?? 1);
  let yaw = 0, targetYaw = 0, restEase = 0;
  return {
    group,
    setWalk(phase: number, moving: boolean, dt: number) {
      restEase = THREE.MathUtils.clamp(restEase + (moving ? dt * 8 : -dt * 6), 0, 1);
      const swing = Math.sin(phase) * 0.68 * restEase;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.72; armR.rotation.x = swing * 0.72;
      group.position.y = Math.abs(Math.sin(phase)) * 0.035 * restEase;
      const breathe = moving ? 0 : Math.sin(phase * 0.35) * 0.007;
      torso.scale.y = 1 + breathe; head.position.y = breathe * 0.5;
    },
    setChoreo(pose: ChoreoPose) {
      armL.rotation.x = pose.armLX ?? 0; armL.rotation.z = pose.armLZ ?? 0;
      armL.rotation.y = pose.armLY ?? 0; foreL.rotation.x = pose.elbowL ?? 0;
      armR.rotation.x = pose.armRX ?? 0; armR.rotation.z = pose.armRZ ?? 0;
      armR.rotation.y = pose.armRY ?? 0; foreR.rotation.x = pose.elbowR ?? 0;
      legL.rotation.x = pose.legLX ?? 0; legR.rotation.x = pose.legRX ?? 0;
      torso.rotation.z = pose.torsoTilt ?? 0; torso.rotation.y = pose.torsoTwist ?? 0;
      head.rotation.z = pose.headTilt ?? 0; head.rotation.y = pose.headTurn ?? 0;
      group.position.y = pose.hop ?? 0;
      group.rotation.y = yaw + (pose.spin ?? 0);
    },
    rightHandWorld(out: THREE.Vector3) {
      // The hand hangs off the FOREARM, so the release point follows the elbow
      // through the whip instead of pivoting rigidly at the shoulder.
      foreR.updateWorldMatrix(true, false);
      return out.set(0, -0.125, 0).applyMatrix4(foreR.matrixWorld);
    },
    rightHandAttach() { return foreR; },
    face(dx: number, dz: number, dt: number) {
      if (Math.abs(dx) + Math.abs(dz) > 0.001) targetYaw = Math.atan2(dx, dz);
      let d = targetYaw - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += d * Math.min(1, dt * 12);
      group.rotation.y = yaw;
    },
  };
}
