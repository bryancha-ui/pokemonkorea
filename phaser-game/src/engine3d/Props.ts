import * as THREE from 'three';

// ── Procedural prop library ──────────────────────────────────────────────────
// Low-poly trees, rocks, grass tufts, flowers, water and wall blocks in a soft
// toon style. Everything is built from primitives at runtime — no asset files.

let gradientMap: THREE.DataTexture | null = null;

/** Five-step pastel ramp. The extra mid-tones keep curved silhouettes readable
 * without the hard cubic bands that made the procedural world feel voxelled. */
export function toonRamp(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([
    82, 82, 88, 255,
    132, 132, 138, 255,
    180, 180, 184, 255,
    221, 221, 224, 255,
    255, 255, 255, 255,
  ]);
  gradientMap = new THREE.DataTexture(data, 5, 1, THREE.RGBAFormat);
  gradientMap.magFilter = THREE.LinearFilter;
  gradientMap.minFilter = THREE.LinearFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export function toonMat(color: number, opts: { transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color, gradientMap: toonRamp(),
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
}

/**
 * Procedural 3D "Fog-Wraith" (Gengar / 안개 팬텀) for the Fogbound Manor boss —
 * a volumetric version of the manor's painted purple grinning ghost. Built facing
 * +Z (toward the camera), roughly 2 units tall with feet near y=0; the model loader
 * normalizes it to height 1. No GLB / no generation credits required.
 */
export function makeGengar(): THREE.Group {
  const g = new THREE.Group();
  const PURPLE = 0x5a3a7a, DARKP = 0x452c60;
  // Round squashed body.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 18), toonMat(PURPLE));
  body.scale.set(1.02, 0.94, 0.9); body.position.y = 1.05; g.add(body);
  // Jagged spikes over the back and crown.
  const spikeMat = toonMat(DARKP);
  for (const [x, y, z, s] of [
    [0, 2.0, -0.15, 0.36], [-0.55, 1.8, -0.25, 0.32], [0.55, 1.8, -0.25, 0.32],
    [-0.95, 1.35, -0.15, 0.28], [0.95, 1.35, -0.15, 0.28], [0, 1.25, -0.95, 0.3],
  ] as [number, number, number, number][]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.5, 6), spikeMat);
    sp.position.set(x, y, z); sp.rotation.x = -0.45; g.add(sp);
  }
  // Glowing red eyes + dark pupils.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  for (const ex of [-0.34, 0.34]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), eyeMat);
    eye.position.set(ex, 1.2, 0.8); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), toonMat(0x140018));
    pupil.position.set(ex, 1.18, 0.96); g.add(pupil);
  }
  // Wide toothy grin.
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.3, 0.12), toonMat(0xf5f5ff));
  mouth.position.set(0, 0.78, 0.84); g.add(mouth);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.14), toonMat(0x2a1a3a));
    tooth.position.set(i * 0.19, 0.78, 0.88); g.add(tooth);
  }
  // Stubby arms + legs.
  const limbMat = toonMat(DARKP);
  for (const ax of [-1.02, 1.02]) {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), limbMat);
    arm.scale.set(1, 0.7, 0.7); arm.position.set(ax, 0.95, 0.12); g.add(arm);
  }
  for (const lx of [-0.5, 0.5]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), limbMat);
    leg.scale.set(1, 0.68, 1); leg.position.set(lx, 0.2, 0.22); g.add(leg);
  }
  return g;
}

/**
 * Volumetric 목탁귀 (Moktakgwi). Its generated GLB was hosted on an expired
 * CDN URL, so this faithful lightweight sculpture is built locally and works
 * instantly in field, battle and hatch scenes (including iOS/Android).
 * The face points toward +Z.
 */
export function makeMoktakgwi(): THREE.Group {
  const g = new THREE.Group();
  const WOOD = 0x75492f, DARK_WOOD = 0x49301f, RIM = 0xa77b52, MOSS = 0x728d49;
  const GHOST = 0x83d7ae, GHOST_LIGHT = 0xb3f3c8, MOUTH = 0x201f1d, TOOTH = 0xe9e2c7;

  const tube = (points: THREE.Vector3[], radius: number, color: number, opacity = 1): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, radius, 8, false),
      toonMat(color, opacity < 1 ? { transparent: true, opacity } : {}),
    );
    mesh.castShadow = opacity > 0.8;
    return mesh;
  };
  const cylinderBetween = (a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number): THREE.Mesh => {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, delta.length(), 9), toonMat(color));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    return mesh;
  };

  // Rounded wooden moktak body — deliberately deep on Z so it reads as a
  // carved object from a moving battle camera, not a stretched sprite card.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), toonMat(WOOD));
  body.scale.set(0.88, 0.93, 0.68);
  body.position.set(-0.14, 0.9, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const lowerBark = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), toonMat(DARK_WOOD));
  lowerBark.scale.set(0.8, 0.25, 0.62);
  lowerBark.position.set(-0.14, 0.26, 0.02);
  g.add(lowerBark);

  // Black carved cavity and thick wooden lip sell the huge open-mouth design.
  const cavity = new THREE.Mesh(new THREE.CircleGeometry(0.65, 36), new THREE.MeshBasicMaterial({ color: MOUTH }));
  cavity.scale.set(1, 0.88, 1);
  cavity.position.set(-0.03, 0.94, 0.685);
  g.add(cavity);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.105, 10, 40), toonMat(RIM));
  lip.scale.set(1, 0.88, 1);
  lip.position.set(-0.03, 0.94, 0.7);
  lip.castShadow = true;
  g.add(lip);

  // Uneven inward-facing teeth around the opening.
  const toothAngles = [-2.75, -2.28, -1.82, -1.35, -0.85, 0.42, 0.84, 1.28, 1.72, 2.14, 2.58];
  for (let i = 0; i < toothAngles.length; i++) {
    const a = toothAngles[i];
    const px = -0.03 + Math.cos(a) * 0.58;
    const py = 0.94 + Math.sin(a) * 0.49;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.085 + (i % 3) * 0.012, 0.27, 9), toonMat(TOOTH));
    tooth.position.set(px, py, 0.75);
    const inward = new THREE.Vector3(-0.03 - px, 0.94 - py, 0).normalize();
    tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward);
    tooth.castShadow = true;
    g.add(tooth);
  }

  // Raised grain rings and bark strips keep the body recognisably wooden.
  for (const [x, y, r] of [[-0.58, 0.86, 0.17], [-0.47, 1.34, 0.1], [-0.38, 0.45, 0.12]] as const) {
    const grain = new THREE.Mesh(new THREE.TorusGeometry(r, 0.024, 6, 20), toonMat(DARK_WOOD));
    grain.scale.y = 0.72;
    grain.position.set(x, y, 0.625);
    g.add(grain);
  }
  const barkLine = tube([
    new THREE.Vector3(-0.78, 0.45, 0.42), new THREE.Vector3(-0.7, 0.7, 0.59),
    new THREE.Vector3(-0.8, 1.02, 0.47), new THREE.Vector3(-0.66, 1.35, 0.42),
  ], 0.026, DARK_WOOD);
  g.add(barkLine);

  // A broken stem and moss crown sit above the wooden shell.
  g.add(cylinderBetween(new THREE.Vector3(-0.5, 1.68, -0.03), new THREE.Vector3(-0.56, 1.95, 0), 0.09, DARK_WOOD));
  g.add(cylinderBetween(new THREE.Vector3(-0.56, 1.9, 0), new THREE.Vector3(-0.68, 2.08, 0.01), 0.055, DARK_WOOD));
  for (const [x, y, sx] of [[-0.36, 1.76, 0.32], [-0.1, 1.73, 0.27], [-0.62, 1.7, 0.22]] as const) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), toonMat(MOSS));
    moss.scale.set(sx, 0.13, 0.24);
    moss.position.set(x, y, 0.03);
    g.add(moss);
  }

  // Spectral tail pours out of the hollow drum and curls into the head.
  const ghostTail = tube([
    new THREE.Vector3(-0.02, 0.83, 0.74), new THREE.Vector3(0.16, 1.05, 0.8),
    new THREE.Vector3(0.18, 1.42, 0.74), new THREE.Vector3(0.38, 1.64, 0.56),
  ], 0.24, GHOST, 0.92);
  g.add(ghostTail);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 17), toonMat(GHOST, { transparent: true, opacity: 0.92 }));
  head.scale.set(0.47, 0.59, 0.39);
  head.position.set(0.38, 1.78, 0.55);
  g.add(head);

  // Signature curled flame crest.
  const crest = tube([
    new THREE.Vector3(0.22, 2.18, 0.48), new THREE.Vector3(0.05, 2.38, 0.35),
    new THREE.Vector3(-0.25, 2.45, 0.25), new THREE.Vector3(-0.38, 2.28, 0.29),
    new THREE.Vector3(-0.27, 2.16, 0.36),
  ], 0.15, GHOST, 0.9);
  g.add(crest);

  // Luminous eyes and curved smile sit slightly proud of the translucent head.
  const glowMat = new THREE.MeshBasicMaterial({ color: GHOST_LIGHT, transparent: true, opacity: 0.98 });
  for (const x of [0.22, 0.53]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 9), glowMat);
    eye.scale.y = 1.35;
    eye.position.set(x, 1.86, 0.9);
    g.add(eye);
  }
  const smile = tube([
    new THREE.Vector3(0.19, 1.64, 0.91), new THREE.Vector3(0.37, 1.55, 0.95),
    new THREE.Vector3(0.57, 1.65, 0.9),
  ], 0.027, GHOST_LIGHT, 0.98);
  g.add(smile);

  // Spectral arm grips a gnarled wooden striker at the right side.
  const arm = tube([
    new THREE.Vector3(0.64, 1.68, 0.57), new THREE.Vector3(0.86, 1.45, 0.62),
    new THREE.Vector3(1.02, 1.28, 0.58),
  ], 0.105, GHOST, 0.9);
  g.add(arm);
  const handleA = new THREE.Vector3(0.91, 0.78, 0.35);
  const handleB = new THREE.Vector3(1.35, 1.66, 0.38);
  g.add(cylinderBetween(handleA, handleB, 0.055, DARK_WOOD));
  const malletHead = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.4, 10), toonMat(WOOD));
  malletHead.position.set(1.4, 1.78, 0.38);
  malletHead.rotation.z = -0.52;
  malletHead.castShadow = true;
  g.add(malletHead);

  // Wispy musical leaves at the base mirror the pale spirit trail in the art.
  for (const side of [-1, 1]) {
    const wisp = tube([
      new THREE.Vector3(side * 0.45 - 0.15, 0.22, -0.08),
      new THREE.Vector3(side * 0.8 - 0.15, 0.08, 0.05),
      new THREE.Vector3(side * 0.96 - 0.15, 0.26, 0.12),
    ], 0.055, GHOST_LIGHT, 0.72);
    g.add(wisp);
  }

  return g;
}

/**
 * Volumetric 두루광 (Thanatoat), the Water/Ghost grim-reaper crane. The old
 * generated GLB now returns HTTP 403, so this local model preserves the blue
 * crane, black gat, funeral robe and feathered soul-staff on every device.
 * Built facing +Z for battle, field and hatch cameras.
 */
export function makeThanatoat(): THREE.Group {
  const g = new THREE.Group();
  const INK = 0x252b3c, ROBE = 0x353a45, ROBE_LIGHT = 0x4b4f52;
  const BLUE = 0x087eb3, BLUE_LIGHT = 0x8eb1e1, GOLD = 0xf2c94c;
  const BONE = 0xe8edf0, STAFF = 0x202638, WISP = 0x9edff0;

  const tube = (points: THREE.Vector3[], radius: number, color: number, opacity = 1): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 34, radius, 8, false),
      toonMat(color, opacity < 1 ? { transparent: true, opacity } : {}),
    );
    mesh.castShadow = opacity > 0.82;
    return mesh;
  };
  const extruded = (points: Array<[number, number]>, color: number, depth = 0.18): THREE.Mesh => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.025, bevelThickness: 0.025,
    });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, toonMat(color));
    mesh.castShadow = true;
    return mesh;
  };
  const cylinderBetween = (a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number): THREE.Mesh => {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 9), toonMat(color));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    return mesh;
  };
  const feather = (width: number, height: number, color: number): THREE.Mesh => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-width * 0.56, height * 0.24, -width * 0.52, height * 0.78, 0, height);
    shape.bezierCurveTo(width * 0.52, height * 0.78, width * 0.56, height * 0.24, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.018, bevelThickness: 0.018,
    });
    geo.translate(0, 0, -0.06);
    const mesh = new THREE.Mesh(geo, toonMat(color));
    mesh.castShadow = true;
    return mesh;
  };

  // Long funeral robe, widened at the hem but rounded in depth so the model
  // keeps a full silhouette when the battle camera moves around it.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.72, 1.55, 16), toonMat(ROBE));
  body.scale.z = 0.7;
  body.position.set(0, 0.9, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const robeFront = extruded([
    [-0.38, 1.6], [-0.66, 1.05], [-0.78, 0.2], [-0.5, 0.04],
    [-0.12, 0.32], [0.2, 0.08], [0.62, 0.24], [0.68, 1.04], [0.36, 1.6],
  ], ROBE_LIGHT, 0.2);
  robeFront.position.z = 0.43;
  g.add(robeFront);

  // Broad asymmetrical sleeves evoke folded crane wings and the original
  // flowing jeoseung-saja hanbok rather than a generic humanoid cylinder.
  const leftSleeve = extruded([
    [-0.34, 1.52], [-0.82, 1.65], [-1.42, 1.42], [-1.72, 0.68],
    [-1.58, 0.38], [-1.12, 0.62], [-0.58, 1.02],
  ], INK, 0.22);
  leftSleeve.position.z = 0.04;
  g.add(leftSleeve);
  const rightSleeve = extruded([
    [0.33, 1.48], [0.74, 1.7], [1.06, 2.38], [1.54, 2.5],
    [1.4, 1.78], [1.04, 1.18], [0.6, 0.94],
  ], INK, 0.22);
  rightSleeve.position.z = 0.02;
  g.add(rightSleeve);
  // Feather steps along the raised wing keep its crane anatomy readable.
  for (let i = 0; i < 4; i++) {
    const wingFeather = feather(0.25 + i * 0.035, 0.72 + i * 0.08, i % 2 ? INK : 0x303647);
    wingFeather.position.set(0.56 + i * 0.2, 1.55 + i * 0.13, 0.18 - i * 0.025);
    wingFeather.rotation.z = -0.78 + i * 0.08;
    g.add(wingFeather);
  }

  // Thin S-curved blue crane neck emerging from the white funeral collar.
  const neck = tube([
    new THREE.Vector3(0, 1.45, 0.12), new THREE.Vector3(-0.06, 1.95, 0.1),
    new THREE.Vector3(0.03, 2.48, 0.12), new THREE.Vector3(0.02, 2.82, 0.16),
  ], 0.145, BLUE);
  g.add(neck);
  const collarLeft = extruded([[-0.38, 1.55], [-0.04, 1.32], [0, 1.6], [-0.22, 1.79]], BONE, 0.1);
  collarLeft.position.z = 0.48;
  g.add(collarLeft);
  const collarRight = extruded([[0.38, 1.55], [0.04, 1.32], [0, 1.6], [0.22, 1.79]], BONE, 0.1);
  collarRight.position.z = 0.48;
  g.add(collarRight);
  for (const side of [-1, 1]) {
    const bow = extruded([[0, 0], [side * 0.42, 0.16], [side * 0.38, -0.18]], ROBE_LIGHT, 0.11);
    bow.position.set(side * 0.02, 1.19, 0.52);
    g.add(bow);
  }

  // Crane head and pale cheek mask.
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 17), toonMat(BLUE));
  head.scale.set(0.42, 0.33, 0.4);
  head.position.set(0, 2.92, 0.18);
  head.castShadow = true;
  g.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 13), toonMat(BLUE_LIGHT));
  face.scale.set(0.34, 0.26, 0.26);
  face.position.set(0, 2.86, 0.48);
  g.add(face);
  for (const x of [-0.17, 0.17]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 9), new THREE.MeshBasicMaterial({ color: GOLD }));
    eye.scale.y = 1.25;
    eye.position.set(x, 2.98, 0.7);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), toonMat(0x172033));
    pupil.position.set(x, 2.98, 0.758);
    g.add(pupil);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.68, 10), toonMat(0xd6b65c));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.84, 0.84);
  beak.castShadow = true;
  g.add(beak);

  // Traditional black gat: wide brim, rounded crown and small blue ribbon.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.07, 28), toonMat(INK));
  brim.scale.z = 0.86;
  brim.position.set(0, 3.22, 0.14);
  brim.castShadow = true;
  g.add(brim);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), toonMat(INK));
  crown.scale.set(0.46, 0.27, 0.42);
  crown.position.set(0, 3.39, 0.08);
  crown.castShadow = true;
  g.add(crown);
  const ribbon = tube([
    new THREE.Vector3(0.38, 3.35, 0.24), new THREE.Vector3(0.58, 3.5, 0.2),
    new THREE.Vector3(0.48, 3.62, 0.12), new THREE.Vector3(0.34, 3.55, 0.16),
  ], 0.045, BLUE);
  g.add(ribbon);

  // Diagonal soul-staff held across the robe. A layered feather bloom at its
  // lower end matches the brush/scythe silhouette in the source design.
  const staffA = new THREE.Vector3(-1.18, 0.58, 0.62);
  const staffB = new THREE.Vector3(1.06, 2.25, 0.62);
  g.add(cylinderBetween(staffA, staffB, 0.035, STAFF));
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9), toonMat(INK));
  grip.position.set(0.32, 1.7, 0.64);
  grip.scale.set(1.25, 0.82, 0.85);
  g.add(grip);
  for (let i = 0; i < 7; i++) {
    const plume = feather(0.18 + (i % 3) * 0.035, 0.5 + (i % 2) * 0.16, i % 2 ? ROBE_LIGHT : INK);
    plume.position.set(-0.82 + Math.cos(i * 0.9) * 0.18, 0.82 + Math.sin(i * 0.9) * 0.14, 0.5 + i * 0.012);
    plume.rotation.z = -1.15 + i * 0.34;
    g.add(plume);
  }

  // Crane legs and curled dark shoes anchor the otherwise floating robe.
  for (const side of [-1, 1]) {
    const leg = cylinderBetween(
      new THREE.Vector3(side * 0.18, 0.25, -0.02),
      new THREE.Vector3(side * 0.24, 0.02, 0.12), 0.045, INK,
    );
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), toonMat(INK));
    foot.scale.set(0.13, 0.07, 0.33);
    foot.position.set(side * 0.24, 0.015, 0.29);
    g.add(foot);
  }

  // Small translucent soul wisps communicate Ghost typing without hiding the
  // authored robe silhouette.
  for (const side of [-1, 1]) {
    const wisp = tube([
      new THREE.Vector3(side * 0.6, 0.46, -0.18),
      new THREE.Vector3(side * 0.92, 0.66, -0.12),
      new THREE.Vector3(side * 0.8, 0.94, -0.08),
    ], 0.045, WISP, 0.58);
    g.add(wisp);
  }

  return g;
}

/**
 * Volumetric 넋풀 (Ghograss), built from its authored dead-leaf illustration.
 * The old generated GLB lived only on an expired CDN URL, so this lightweight
 * model is deliberately local, synchronous and safe on mobile. It faces +Z.
 */
export function makeGhograss(): THREE.Group {
  const g = new THREE.Group();
  const BROWN = 0x76503f, DARK = 0x4b3632, MID = 0x956343;
  const OCHRE = 0xd9af45, OLIVE = 0x8f8b55, ORANGE = 0xdf5938;

  const leaf = (width: number, height: number, color: number, depth = 0.1): THREE.Mesh => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-width * 0.58, height * 0.2, -width * 0.55, height * 0.7, 0, height);
    shape.bezierCurveTo(width * 0.55, height * 0.7, width * 0.58, height * 0.2, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 2,
      bevelSize: Math.min(width, height) * 0.045,
      bevelThickness: depth * 0.18,
    });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, toonMat(color));
    mesh.castShadow = true;
    return mesh;
  };

  const tube = (points: THREE.Vector3[], radius: number, color: number, segments = 32): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), toonMat(color));
    mesh.castShadow = true;
    return mesh;
  };

  // Three torn-looking dead leaves form the tall ghostly crown behind the body.
  const backLeft = leaf(0.43, 1.05, DARK, 0.13);
  backLeft.position.set(-0.48, 0.72, -0.16); backLeft.rotation.z = 0.2; g.add(backLeft);
  const backTall = leaf(0.48, 1.42, 0x59423b, 0.15);
  backTall.position.set(-0.16, 0.72, -0.2); backTall.rotation.z = -0.06; g.add(backTall);
  const backRight = leaf(0.5, 1.08, 0x65483e, 0.14);
  backRight.position.set(0.38, 0.72, -0.14); backRight.rotation.z = -0.18; g.add(backRight);

  // Olive mould patches give the right leaf the same aged vegetation motif as
  // the 2D design without relying on a texture map.
  for (const [x, y, sx, sy] of [
    [0.28, 1.47, 0.22, 0.17], [0.47, 1.39, 0.2, 0.2], [0.32, 1.25, 0.25, 0.16],
  ] as [number, number, number, number][]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toonMat(OLIVE));
    patch.scale.set(sx, sy, 0.035); patch.position.set(x, y, 0.02); g.add(patch);
  }

  // Rounded seed-pod body, flattened only slightly so it reads as a real volume
  // from the rotating 3D camera instead of the old accordion-like card.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), toonMat(BROWN));
  body.scale.set(0.72, 0.67, 0.42); body.position.set(-0.04, 0.8, 0.08); body.castShadow = true; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toonMat(0xe0bd59));
  belly.scale.set(0.2, 0.18, 0.04); belly.position.set(-0.34, 0.65, 0.485); g.add(belly);
  for (const [x, y, s] of [[0.26, 0.62, 0.09], [-0.22, 0.91, 0.105], [0.5, 0.76, 0.07]] as const) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), toonMat(x > 0.35 ? OCHRE : ORANGE));
    spot.scale.set(s, s * 0.72, 0.03); spot.position.set(x, y, 0.5); g.add(spot);
  }

  // White asymmetric eyes sit proud of the pod surface.
  const eyeMat = toonMat(0xf4f1e7);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), eyeMat);
  leftEye.scale.set(0.17, 0.28, 0.07); leftEye.position.set(-0.32, 1.16, 0.47); g.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), eyeMat);
  rightEye.scale.set(0.18, 0.3, 0.07); rightEye.position.set(0.31, 1.16, 0.46); g.add(rightEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), toonMat(0x888239));
  leftPupil.scale.set(0.095, 0.12, 0.04); leftPupil.position.set(-0.32, 1.24, 0.54); g.add(leftPupil);
  // Two orange lobes and a point reproduce the signature heart-shaped pupil.
  for (const x of [0.275, 0.345]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toonMat(ORANGE));
    lobe.scale.set(0.06, 0.065, 0.035); lobe.position.set(x, 1.22, 0.535); g.add(lobe);
  }
  const heartPoint = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.14, 8), toonMat(ORANGE));
  heartPoint.rotation.z = Math.PI; heartPoint.scale.z = 0.45;
  heartPoint.position.set(0.31, 1.15, 0.545); g.add(heartPoint);

  // A curling vine loops around the body and reaches into a golden leaf hand.
  const loop = tube([
    new THREE.Vector3(0.25, 1.1, 0.42), new THREE.Vector3(-0.18, 1.25, 0.49),
    new THREE.Vector3(-0.72, 1.22, 0.36), new THREE.Vector3(-0.91, 0.94, 0.18),
    new THREE.Vector3(-0.69, 0.65, 0.31), new THREE.Vector3(-0.38, 0.73, 0.48),
    new THREE.Vector3(-0.48, 0.88, 0.52),
  ], 0.055, MID, 40);
  g.add(loop);
  const arm = tube([
    new THREE.Vector3(-0.78, 1.08, 0.25), new THREE.Vector3(-0.18, 1.12, 0.48),
    new THREE.Vector3(0.42, 1.1, 0.5), new THREE.Vector3(0.68, 1.0, 0.42),
  ], 0.06, OCHRE, 30);
  g.add(arm);
  const hand = leaf(0.25, 0.55, 0xe1b94c, 0.11);
  hand.position.set(0.62, 1.0, 0.4); hand.rotation.z = -Math.PI / 2; g.add(hand);

  // Long hooked tail and dry terminal leaf.
  const tail = tube([
    new THREE.Vector3(0.08, 0.35, 0.02), new THREE.Vector3(0.25, 0.08, 0.02),
    new THREE.Vector3(0.57, 0.05, 0.01), new THREE.Vector3(0.47, 0.27, 0.02),
    new THREE.Vector3(0.35, 0.22, 0.03), new THREE.Vector3(0.56, 0.03, 0.01),
    new THREE.Vector3(0.92, 0.17, 0),
  ], 0.045, MID, 42);
  g.add(tail);
  const tailLeaf = leaf(0.22, 0.48, 0x8a4935, 0.1);
  tailLeaf.position.set(0.91, 0.15, 0); tailLeaf.rotation.z = -0.9; g.add(tailLeaf);

  g.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}

/**
 * Low-poly 여우귀 (Foxgeist), matching the grey native fox and flowing purple
 * spirit-cloak in its Pokédex art. The generated GLB is 39 MB / 1.4M triangles
 * and is blocked on mobile; this synchronous model loads reliably everywhere.
 * Faces +Z like the other procedural battlers.
 */
export function makeFoxgeist(): THREE.Group {
  const g = new THREE.Group();
  const FUR = 0xaeb7bd, LIGHT = 0xf0f3f2, SHADE = 0x7481a3;
  const SPIRIT = 0x49345f, SPIRIT_HI = 0x675078, DARK = 0x21182a;

  const orb = (
    color: number, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, seg = 16,
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(8, seg - 4)), toonMat(color));
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh);
    return mesh;
  };
  const tube = (points: THREE.Vector3[], radius: number, color: number, segments = 18) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), toonMat(color));
    g.add(mesh); return mesh;
  };

  // Sleek floating fox body, chest and head.
  orb(FUR, 0, 0.93, -0.2, 0.5, 0.55, 0.72, 18);
  orb(LIGHT, 0, 0.93, 0.33, 0.37, 0.43, 0.24, 16);
  orb(FUR, 0, 1.42, 0.42, 0.43, 0.39, 0.4, 18);
  orb(LIGHT, 0, 1.29, 0.77, 0.38, 0.19, 0.43, 16);
  orb(DARK, 0, 1.3, 1.16, 0.105, 0.075, 0.09, 12);

  // Tall fox ears with white tips and blue inner fur.
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 7), toonMat(FUR));
    ear.position.set(side * 0.29, 1.88, 0.36); ear.rotation.z = side * -0.09; g.add(ear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 7), toonMat(LIGHT));
    tip.position.set(side * 0.3, 2.06, 0.38); tip.rotation.z = side * -0.09; g.add(tip);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 7), toonMat(SHADE));
    inner.position.set(side * 0.29, 1.82, 0.57); inner.scale.z = 0.35; g.add(inner);
  }

  // Purple spectral mask, red eyes and the small tongue from the illustration.
  for (const side of [-1, 1]) {
    orb(SPIRIT, side * 0.23, 1.47, 0.73, 0.24, 0.18, 0.12, 14);
    orb(0xe5524b, side * 0.2, 1.46, 0.84, 0.085, 0.075, 0.035, 12);
    orb(DARK, side * 0.2, 1.46, 0.875, 0.035, 0.055, 0.02, 10);
  }
  tube([
    new THREE.Vector3(-0.3, 1.39, 0.77), new THREE.Vector3(0, 1.24, 0.86),
    new THREE.Vector3(0.32, 1.36, 0.77),
  ], 0.075, SPIRIT, 14);
  orb(0xe66d70, 0, 1.08, 0.93, 0.09, 0.16, 0.05, 12);

  // Four tapered floating legs with pale paws.
  for (const [x, z, forward] of [
    [-0.28, 0.2, true], [0.28, 0.2, true], [-0.32, -0.52, false], [0.32, -0.52, false],
  ] as [number, number, boolean][]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.13, forward ? 0.66 : 0.52, 8), toonMat(FUR));
    leg.position.set(x, forward ? 0.48 : 0.63, z); leg.rotation.z = x * 0.35; g.add(leg);
    orb(forward ? LIGHT : SHADE, x * 1.05, forward ? 0.15 : 0.38, z + 0.06, 0.12, 0.1, 0.18, 12);
  }

  // The characteristic purple cloak draped across the haunches.
  orb(SPIRIT, -0.32, 1.18, -0.47, 0.44, 0.32, 0.48, 16);
  orb(SPIRIT_HI, 0.28, 1.17, -0.48, 0.45, 0.3, 0.46, 16);
  for (const side of [-1, 1]) orb(DARK, side * 0.3, 1.37, -0.21, 0.19, 0.08, 0.25, 12);

  // One tall flame-tail and two wind-swept wisps make the Ghost typing readable
  // from every battle-camera angle without a transparent billboard.
  tube([
    new THREE.Vector3(0, 1.27, -0.72), new THREE.Vector3(-0.1, 1.8, -0.78),
    new THREE.Vector3(0.18, 2.27, -0.72), new THREE.Vector3(0.03, 2.68, -0.62),
    new THREE.Vector3(0.32, 2.86, -0.48),
  ], 0.2, SPIRIT_HI, 24);
  tube([
    new THREE.Vector3(-0.25, 1.15, -0.66), new THREE.Vector3(-0.75, 1.05, -0.66),
    new THREE.Vector3(-1.08, 1.22, -0.5),
  ], 0.12, SPIRIT, 18);
  tube([
    new THREE.Vector3(0.28, 1.12, -0.65), new THREE.Vector3(0.82, 0.98, -0.62),
    new THREE.Vector3(1.13, 1.12, -0.45),
  ], 0.11, SPIRIT_HI, 18);

  g.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}

// ── Blob shadow (shared geometry+material, cloned cheaply) ──────────────────
let blobGeo: THREE.CircleGeometry | null = null;
let blobMat: THREE.MeshBasicMaterial | null = null;

export function makeBlobShadow(radius: number): THREE.Mesh {
  if (!blobGeo) blobGeo = new THREE.CircleGeometry(1, 20);
  if (!blobMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(20,24,40,0.42)');
    g.addColorStop(1, 'rgba(20,24,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    blobMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  }
  const m = new THREE.Mesh(blobGeo, blobMat);
  // Geometry/material (and its texture) are intentionally shared by every
  // character. Scene cleanup must not dispose them out from under the next map.
  m.userData.sharedGeo = true;
  m.userData.sharedMat = true;
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(radius);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// ── Trees ───────────────────────────────────────────────────────────────────
export interface InstancedProp {
  meshes: THREE.InstancedMesh[];
  /** Original transforms, shared by every mesh part of an instance. */
  placements: ReadonlyArray<{ x: number; z: number; s: number; rot: number }>;
  /** Place one instance; call finalize() when done. */
  place(x: number, z: number, s: number, rot: number): void;
  /** Tilt one placed instance around its rooted position (used by grass rustle). */
  setSway(index: number, pitch: number, roll: number): void;
  /** Upload changed instance matrices after a batch of setSway calls. */
  commit(): void;
  finalize(): void;
  count: number;
}

interface InstancedPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  y: number;
  /** Local offsets/scale let organic props use clustered silhouettes while
   * retaining the single instanced draw call per component. */
  x?: number;
  z?: number;
  scale?: number;
}

function makeInstanced(parts: InstancedPart[], max: number): InstancedProp {
  const meshes = parts.map(p => {
    const im = new THREE.InstancedMesh(p.geo, p.mat, max);
    im.count = 0;
    im.frustumCulled = false;
    return im;
  });
  const dummy = new THREE.Object3D();
  const placements: { x: number; z: number; s: number; rot: number }[] = [];
  let n = 0;
  const writeTransform = (index: number, pitch = 0, roll = 0) => {
    const p = placements[index];
    if (!p) return;
    for (let i = 0; i < meshes.length; i++) {
      const part = parts[i];
      const lx = (part.x ?? 0) * p.s, lz = (part.z ?? 0) * p.s;
      const sin = Math.sin(p.rot), cos = Math.cos(p.rot);
      dummy.position.set(
        p.x + lx * cos + lz * sin,
        part.y * p.s,
        p.z - lx * sin + lz * cos,
      );
      dummy.scale.setScalar(p.s * (part.scale ?? 1));
      dummy.rotation.set(pitch, p.rot, roll);
      dummy.updateMatrix();
      meshes[i].setMatrixAt(index, dummy.matrix);
    }
  };
  return {
    meshes,
    placements,
    count: 0,
    place(x, z, s, rot) {
      if (n >= max) return;
      placements.push({ x, z, s, rot });
      writeTransform(n);
      n++;
      this.count = n;
    },
    setSway(index, pitch, roll) { writeTransform(index, pitch, roll); },
    commit() { for (const m of meshes) m.instanceMatrix.needsUpdate = true; },
    finalize() {
      for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    },
  };
}

/** Round leafy tree (temperate zones). */
export function makeTrees(max: number, canopy = 0x3f9e3a, trunk = 0x6d4c33): InstancedProp {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.7, 10);
  const rootGeo = new THREE.CylinderGeometry(0.17, 0.22, 0.12, 10);
  const crown = new THREE.DodecahedronGeometry(0.46, 1); crown.scale(1, 0.82, 1);
  const puff = new THREE.DodecahedronGeometry(0.34, 1); puff.scale(1, 0.86, 1);
  const highlight = mixColor(canopy, 0xffffdc, 0.22);
  const shade = mixColor(canopy, 0x183d22, 0.24);
  return makeInstanced([
    { geo: rootGeo, mat: toonMat(mixColor(trunk, 0x3c2418, 0.22)), y: 0.06 },
    { geo: trunkGeo, mat: toonMat(trunk), y: 0.36 },
    { geo: crown, mat: toonMat(shade), y: 0.93, scale: 1.12 },
    { geo: puff, mat: toonMat(canopy), y: 1.12, x: -0.3, z: 0.02 },
    { geo: puff, mat: toonMat(canopy), y: 1.1, x: 0.3, z: 0.05, scale: 0.94 },
    { geo: puff, mat: toonMat(mixColor(canopy, 0xffffff, 0.08)), y: 1.12, z: -0.28, scale: 0.9 },
    { geo: puff, mat: toonMat(highlight), y: 1.38, x: 0.03, z: -0.02, scale: 0.86 },
  ], max);
}

/** Conifer (snow / highland zones) — snow-laden: each green tier carries a thin
 *  white snow cap and a bright snow crown, so the pines read as snow-covered
 *  evergreens (Samho / Baekdu highlands). */
export function makePines(max: number, needles = 0x2e6b46, trunk = 0x5a4030): InstancedProp {
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.13, 0.62, 10);
  const c1 = new THREE.ConeGeometry(0.58, 0.82, 12);
  const c2 = new THREE.ConeGeometry(0.44, 0.76, 12);
  const c3 = new THREE.ConeGeometry(0.3, 0.64, 12);
  // Flatter white caps sitting on each tier's shoulders like settled snow.
  const s1 = new THREE.ConeGeometry(0.6, 0.24, 12);
  const s2 = new THREE.ConeGeometry(0.46, 0.22, 12);
  const s3 = new THREE.ConeGeometry(0.32, 0.2, 12);
  const snowMat = () => toonMat(0xf4f8ff);
  return makeInstanced([
    { geo: trunkGeo, mat: toonMat(trunk), y: 0.25 },
    { geo: c1, mat: toonMat(needles), y: 0.75 },
    { geo: s1, mat: snowMat(), y: 0.99 },
    { geo: c2, mat: toonMat(mixColor(needles, 0xffffff, 0.10)), y: 1.25 },
    { geo: s2, mat: snowMat(), y: 1.46 },
    { geo: c3, mat: toonMat(mixColor(needles, 0xffffff, 0.22)), y: 1.7 },
    { geo: s3, mat: snowMat(), y: 1.88 },
  ], max);
}

/** A wide low-poly toon mountain range used as a scenic 3D backdrop behind a
 *  town's edge (replaces flat painted 2D mountains). Faceted rock peaks with snow
 *  caps and forested foothills toward the town side. 1 unit = 1 tile; built to fill
 *  a `width`×`depth` footprint. Deterministic (seeded by peak index). */
export function makeMountainRange(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const rock = toonMat(0x8a7a6a), rockDark = toonMat(0x6b5f54);
  const snow = toonMat(0xeef3f8), forest = toonMat(0x3f7a45);
  // Run the peaks along the LONGER axis so the range fills tall/narrow plots (an
  // east-edge range) as well as wide/shallow ones (a north-edge range).
  const horizontal = width >= depth;
  const along = horizontal ? width : depth;
  const across = horizontal ? depth : width;
  const peaks = Math.max(1, Math.round(along / 5));
  const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const place = (mesh: THREE.Mesh, a: number, y: number, o: number) => {
    mesh.position.set(horizontal ? a : o, y, horizontal ? o : a);
  };
  for (let i = 0; i < peaks; i++) {
    const t = peaks === 1 ? 0.5 : i / (peaks - 1);
    const a = (t - 0.5) * along * 0.9;
    const r1 = hash(i + 1), r2 = hash(i + 7), r3 = hash(i + 13);
    const h = 2.6 + r1 * 2.8;            // 2.6–5.4 tiles tall
    const rad = 1.3 + r2 * 1.1;
    const o = (r3 - 0.5) * across * 0.5;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), i % 2 ? rock : rockDark);
    place(cone, a, h / 2, o); cone.rotation.y = r1 * Math.PI;
    g.add(cone);
    const capH = h * 0.34;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.44, capH, 7), snow);
    place(cap, a, h - capH / 2, o); cap.rotation.y = cone.rotation.y;
    g.add(cap);
    const fh = 0.9 + r2 * 0.8;           // a forested foothill tucked beside each peak
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.85, fh, 7), forest);
    place(hill, a + (r2 - 0.5) * rad, fh / 2, o + (r3 - 0.5) * rad * 1.4);
    g.add(hill);
  }
  return g;
}

/**
 * Open-air Sacred Peak temple inspired by a high-altitude stone sanctuary:
 * warm limestone paving, a low circular altar, slender perimeter columns and
 * a distant faceted mountain skyline. It intentionally has no enclosing walls
 * or roof, so the player and the Hwanung cast remain visible while the space
 * still reads as a monumental 3D shrine.
 */
export function makeSacredPeakTemple(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const LIMESTONE = 0xd7c5a2, LIMESTONE_DK = 0xa9977c, EDGE = 0x8d7c6b;
  const GOLD = 0xe7bf66, GOLD_DK = 0xa9823d, SKY_ROCK = 0x655d70, SKY_LIGHT = 0x8b7891;
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const slab = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) =>
    mesh(new THREE.BoxGeometry(w, h, d), toonMat(color), x, y, z);

  // Broad stepped platform: a clear readable floor replaces the old dark tile
  // mass and gives the whole map the wide courtyard silhouette from the concept.
  slab(width + 1.0, 0.18, depth + 1.0, EDGE, 0, 0.09, 0);
  slab(width + 0.6, 0.22, depth + 0.6, LIMESTONE_DK, 0, 0.29, 0);
  slab(width + 0.1, 0.12, depth + 0.1, LIMESTONE, 0, 0.46, 0);

  // Large central solar altar. The low profile prevents it from swallowing the
  // 3D Hwanung model while the gold inset makes the arrival point unmistakable.
  const altarRadius = Math.min(width, depth) * 0.2;
  mesh(new THREE.CylinderGeometry(altarRadius + 0.24, altarRadius + 0.34, 0.18, 12), toonMat(LIMESTONE_DK), 0, 0.61, 0);
  mesh(new THREE.CylinderGeometry(altarRadius, altarRadius + 0.08, 0.18, 12), toonMat(LIMESTONE), 0, 0.79, 0);
  mesh(new THREE.TorusGeometry(altarRadius * 0.78, 0.035, 6, 24), toonMat(GOLD), 0, 0.9, 0)
    .rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    slab(0.08, 0.035, altarRadius * 0.72, GOLD_DK,
      Math.cos(a) * altarRadius * 0.46, 0.9, Math.sin(a) * altarRadius * 0.46)
      .rotation.y = a;
  }

  // Monumental but sightline-safe columns. Only the perimeter rises; the center
  // and the approach remain open so actors are never hidden behind black towers.
  const column = (x: number, z: number, h: number, accent = LIMESTONE) => {
    slab(0.66, 0.16, 0.66, LIMESTONE_DK, x, 0.58, z);
    const shaft = mesh(new THREE.CylinderGeometry(0.18, 0.25, h, 8), toonMat(accent), x, 0.66 + h / 2, z);
    shaft.rotation.y = Math.PI / 8;
    slab(0.72, 0.16, 0.72, LIMESTONE_DK, x, 0.66 + h + 0.08, z);
    const cap = mesh(new THREE.ConeGeometry(0.34, 0.42, 5), toonMat(GOLD_DK), x, 0.66 + h + 0.35, z);
    cap.rotation.y = Math.PI / 4;
  };
  const sideX = width / 2 - 0.62, frontZ = depth / 2 - 0.68, backZ = -depth / 2 + 0.68;
  column(-sideX, frontZ, 2.25); column(sideX, frontZ, 2.25);
  column(-sideX, backZ, 2.75, 0xc6b89f); column(sideX, backZ, 2.75, 0xc6b89f);
  column(-sideX, 0, 2.45); column(sideX, 0, 2.45);
  for (const x of [-width * 0.2, width * 0.2]) column(x, backZ, 2.55, 0xc6b89f);

  // Low rear sanctuary wall and a broken lintel frame the altar without making a
  // solid temple volume. The warm gold line gives the far edge a deliberate AAA
  // landmark silhouette from the follow camera.
  slab(width * 0.56, 0.7, 0.24, LIMESTONE_DK, 0, 0.83, backZ + 0.15);
  slab(width * 0.66, 0.12, 0.34, GOLD_DK, 0, 1.24, backZ + 0.15);
  slab(width * 0.62, 0.18, 0.18, LIMESTONE, 0, 2.15, backZ + 0.15);
  slab(width * 0.7, 0.13, 0.22, GOLD, 0, 2.03, backZ + 0.15);

  // Faceted mountain silhouettes sit beyond the open colonnade. They are kept
  // low enough to read as a backdrop rather than another camera-blocking wall.
  const peaks = [
    { x: -width * 0.58, h: 3.3, r: 1.45, c: SKY_ROCK },
    { x: -width * 0.18, h: 4.2, r: 1.75, c: SKY_LIGHT },
    { x: width * 0.22, h: 3.7, r: 1.55, c: SKY_ROCK },
    { x: width * 0.62, h: 4.7, r: 1.9, c: SKY_LIGHT },
  ];
  for (const p of peaks) {
    const mountain = mesh(new THREE.ConeGeometry(p.r, p.h, 7), toonMat(p.c), p.x, p.h / 2, -depth / 2 - 1.9);
    mountain.rotation.y = p.x * 0.37;
    const snow = mesh(new THREE.ConeGeometry(p.r * 0.38, p.h * 0.3, 7), toonMat(0xd8d8df), p.x, p.h * 0.86, -depth / 2 - 1.91);
    snow.rotation.y = mountain.rotation.y;
  }

  return g;
}

/** Rocks / boulders. */
export function makeRocks(max: number, color = 0x8d8578): InstancedProp {
  const g = new THREE.IcosahedronGeometry(0.34, 1);
  g.scale(1.3, 0.72, 1.02);
  const cap = new THREE.DodecahedronGeometry(0.18, 0);
  cap.scale(1.25, 0.45, 0.9);
  return makeInstanced([
    { geo: g, mat: toonMat(color), y: 0.22 },
    { geo: cap, mat: toonMat(mixColor(color, 0xffffff, 0.18)), y: 0.39, x: -0.07, z: -0.02 },
  ], max);
}

/** Tall-grass tufts, Pokémon-style: a dense rounded bush of bright blades on
 *  three crossed alpha planes, with a darker base and lighter sun-lit tips. */
export function makeGrassTufts(max: number, tone = 0x49b23a, snowy = false): InstancedProp {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 56;
  const ctx = c.getContext('2d')!;
  const base = new THREE.Color(tone);
  const dark = base.clone().multiplyScalar(0.62);
  const tip  = base.clone().lerp(new THREE.Color(0xffffff), snowy ? 0.72 : 0.35);
  const rgb = (col: THREE.Color) => `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  // Base mound so the clump reads as a solid tuft, not floating blades.
  ctx.fillStyle = rgb(dark);
  ctx.beginPath(); ctx.ellipse(32, 52, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Dense blades fanning up into a rounded bush; back rows darker, front brighter.
  const blade = (x: number, topY: number, sway: number, w: number, shade: THREE.Color) => {
    ctx.strokeStyle = rgb(shade); ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, 54);
    ctx.quadraticCurveTo(x + sway * 0.5, (54 + topY) / 2, x + sway, topY); ctx.stroke();
  };
  const snowTips: [number, number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 21;                          // 0..1 across the clump
    const x = 8 + t * 48 + (i % 2) * 2;
    const front = i % 3 === 0;                 // front blades brighter + taller
    const topY = 6 + Math.abs(t - 0.5) * 26 + (front ? -4 : 4);   // rounded top
    const sway = (i % 2 ? 1 : -1) * (5 + (i % 4) * 3);
    blade(x, topY, sway, front ? 4.2 : 3.4, front ? tip.clone().lerp(base, 0.4) : (i % 2 ? base : dark.clone().lerp(base, 0.5)));
    if (snowy && (front || i % 4 === 1)) snowTips.push([x + sway, topY + 1, front ? 3.4 : 2.6]);
  }
  if (snowy) {
    // Snow catches on blade tips and settles in a thin bank around the roots.
    ctx.fillStyle = 'rgba(247,252,255,0.94)';
    for (const [x, y, r] of snowTips) {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(238,247,252,0.88)';
    ctx.beginPath(); ctx.ellipse(32, 51, 24, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide });
  const p1 = new THREE.PlaneGeometry(1.15, 1.0);
  const p2 = p1.clone(); p2.rotateY(Math.PI / 3);
  const p3 = p1.clone(); p3.rotateY(-Math.PI / 3);
  return makeInstanced([
    { geo: p1, mat, y: 0.48 },
    { geo: p2, mat, y: 0.48 },
    { geo: p3, mat, y: 0.48 },
  ], max);
}

/** Flower patches: small colored dots on crossed planes. */
export function makeFlowers(max: number, petal = 0xe8b64a): InstancedProp {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(petal);
  ctx.strokeStyle = '#3f7d2f'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = 5 + i * 7;
    ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 2, 18); ctx.stroke();
    ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    ctx.beginPath(); ctx.arc(x + 2, 15, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath(); ctx.arc(x + 2, 15, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const p1 = new THREE.PlaneGeometry(0.6, 0.5);
  const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
  return makeInstanced([{ geo: p1, mat, y: 0.24 }, { geo: p2, mat, y: 0.24 }], max);
}

export function mixColor(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

// ── Placed decorative props (single 3D objects pinned to a tile) ─────────────

/** The single four-storey 노스단 headquarters from the original 2D facade.
 *  It deliberately remains one uninterrupted building volume: dark inset
 *  walls, four bands of red windows, a central crimson gate and the two long
 *  faction banners are lifted directly from the painted version. */
/**
 * The Onnuri Pokémon League hall — a 3D reproduction of LeaguePlazaScene's painted
 * hanok palace (drawPalace): a stone woldae platform with a central stair, a dark
 * hall wall fronted by vermilion pillars, dancheong bands, gold-studded double
 * doors, a gilt signboard, and a two-tier (중층) hip roof.
 *
 * It is deliberately built as ONE continuous vertical mass: the second tier is a
 * real clerestory WALL sitting on the lower roof (not a free-floating roof), so the
 * whole thing reads as a single grand hall rather than two stacked buildings.
 * Built to the plot's own width/depth; front (doors) faces +Z toward the courtyard.
 */
export function makeHanokPalace(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const RED_WALL = 0x6e1f1a, PILLAR = 0xb23a2c, STONE = 0xd0c7b3, STONE_DK = 0xbcb29c;
  const ROOF_LO = 0x33524a, ROOF_HI = 0x3a5e53, RIDGE = 0x223833, GOLD = 0xddb24a, DOOR = 0x241208;
  const bodyH = Math.max(3.6, Math.min(5.4, width * 0.24));
  const bodyD = depth * 0.72;
  const frontZ = bodyD / 2;

  // A frustum roof (truncated 4-sided pyramid) so the tier above has a flat top to
  // sit on — the flat top is what ties the two tiers into one building.
  const addRoof = (baseW: number, baseD: number, topRatio: number, h: number, yBottom: number, color: number, ridgeFrac = 0.5) => {
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(topRatio, 1, h, 4), toonMat(color));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(baseW / Math.SQRT2, 1, baseD / Math.SQRT2);
    roof.position.y = yBottom + h / 2;
    g.add(roof);
    const topY = yBottom + h;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(baseW * ridgeFrac, 0.24, 0.34), toonMat(RIDGE));
    ridge.position.set(0, topY - 0.06, 0); g.add(ridge);
    for (const rx of [-baseW * ridgeFrac / 2, baseW * ridgeFrac / 2]) {
      const chimi = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), toonMat(0x1a2a26));
      chimi.position.set(rx, topY, 0); g.add(chimi);
    }
    return topY;
  };
  // A dark wall fronted by vermilion pillars + a dancheong band — the shared look of
  // both storeys, so the clerestory clearly belongs to the same building.
  const addStorey = (w: number, d: number, h: number, yBottom: number, nCol: number) => {
    const fz = d / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(RED_WALL));
    wall.position.y = yBottom + h / 2; g.add(wall);
    for (let i = 0; i <= nCol; i++) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.34), toonMat(PILLAR));
      pillar.position.set(-w / 2 + (w * i) / nCol, yBottom + h / 2, fz + 0.02); g.add(pillar);
    }
    const bandPalette = [0x2b6ea8, 0x2f9c5a, 0xc7402f, 0xe0b24a];
    const segW = (w + 0.4) / 4;
    for (let s = 0; s < 4; s++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.28, 0.12), toonMat(bandPalette[s]));
      band.position.set(-((w + 0.4) / 2) + segW * (s + 0.5), yBottom + h - 0.18, fz + 0.14); g.add(band);
    }
  };

  // Stone platform (woldae) with a lower apron, the hall sits on top.
  const woldaeH = 0.6;
  const apron = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, 0.34, depth + 1.6), toonMat(STONE_DK));
  apron.position.y = 0.17; g.add(apron);
  const woldae = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, woldaeH, depth + 0.6), toonMat(STONE));
  woldae.position.y = 0.34 + woldaeH / 2; g.add(woldae);
  const platTop = 0.34 + woldaeH;
  // Central staircase down the front.
  for (let s = 0; s < 3; s++) {
    const h = platTop * (1 - s / 3);
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, 0.5), toonMat(s % 2 ? STONE_DK : STONE));
    step.position.set(0, h / 2, depth / 2 + 0.3 + s * 0.5); g.add(step);
  }

  // First storey (the tall main hall).
  addStorey(width, bodyD, bodyH, platTop, 8);

  // Gold-studded double doors at the centre front of the first storey.
  const doorH = Math.min(2.2, bodyH * 0.62), doorW = 1.9;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.2), toonMat(DOOR));
  door.position.set(0, platTop + doorH / 2, frontZ + 0.12); g.add(door);
  const studMat = toonMat(0xe0b24a);
  for (let yy = 0; yy < 4; yy++) for (const sx of [-0.45, 0.45]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), studMat);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(sx, platTop + 0.35 + yy * (doorH - 0.5) / 3, frontZ + 0.23); g.add(stud);
  }

  // Lower (skirt) roof — its flat top carries the clerestory.
  const eaveY = platTop + bodyH;
  const loBaseW = width + 2.4, loBaseD = depth + 1.6, loTopRatio = 0.52, loH = 1.4;
  const loTopY = addRoof(loBaseW, loBaseD, loTopRatio, loH, eaveY - 0.25, ROOF_LO, 0.5);

  // Second storey (clerestory) — sits ON the lower roof's flat top, tying the tiers
  // together so the hall reads as a single building.
  const clW = loBaseW * loTopRatio - 0.6, clD = loBaseD * loTopRatio - 0.4, clH = bodyH * 0.44;
  addStorey(clW, clD, clH, loTopY - 0.1, 5);

  // Upper (crowning) roof over the clerestory.
  addRoof(clW + 1.8, clD + 1.4, 0.22, 1.4, loTopY - 0.1 + clH - 0.1, ROOF_HI, 0.42);

  // Signboard (현판) hung on the first storey under the lower eave.
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.16), toonMat(GOLD));
  boardFrame.position.set(0, eaveY + 0.05, frontZ + 0.2); g.add(boardFrame);
  const boardFace = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.66, 0.1), toonMat(0x1b110a));
  boardFace.position.set(0, eaveY + 0.05, frontZ + 0.29); g.add(boardFace);

  return g;
}

/**
 * A grand northern-capital palace — a wide granite hall raised on a stone woldae,
 * a full front colonnade under a gold cornice, flanking corner towers, and a
 * crowning central pavilion topped with a gold spire. Built entirely from toon
 * primitives (no GLB) so its full majesty renders on every device instead of the
 * flat grey box a disabled/absent landmark GLB falls back to. Front faces +Z;
 * feet at y=0; sized to fill a `width`×`depth` plot.
 */
export function makeGrandPalace(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const GRANITE = 0x6c6f77, GRANITE_DK = 0x53565e, STONE = 0x9297a2, STONE_DK = 0x777b84;
  const ROOF = 0x2e323b, ROOF_HI = 0x3b404a, GOLD = 0xd8b44a, DOOR = 0x181209, NAVY = 0x24314d;
  const bodyD = Math.max(2.6, depth * 0.82);
  const frontZ = bodyD / 2;
  const bodyH = Math.max(4.5, Math.min(6.6, width * 0.26));
  const mesh = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color));
    m.position.set(x, y, z); g.add(m); return m;
  };

  // ── Woldae (raised stone platform) + apron, with a balustrade and grand stair ──
  mesh(width + 1.8, 0.34, depth + 1.6, STONE_DK, 0, 0.17, 0);
  const platH = 0.8;
  mesh(width + 0.9, platH, depth + 0.9, STONE, 0, 0.34 + platH / 2, 0);
  const platTop = 0.34 + platH;
  for (let i = 0; i <= 12; i++) mesh(0.16, 0.5, 0.16, STONE_DK, -width / 2 + (width * i) / 12, platTop + 0.25, frontZ + 0.55);
  for (let s = 0; s < 4; s++) { const h = platTop * (1 - s / 4); mesh(width * 0.34, h, 0.5, s % 2 ? STONE_DK : STONE, 0, h / 2, frontZ + 0.55 + s * 0.5); }

  // ── Main granite hall with an inset facade ──
  mesh(width * 0.92, bodyH, bodyD, GRANITE, 0, platTop + bodyH / 2, 0);
  mesh(width * 0.7, bodyH * 0.84, 0.2, GRANITE_DK, 0, platTop + bodyH * 0.5, frontZ + 0.02);

  // ── Full front colonnade (fluted columns with bases + capitals) ──
  const nCol = 11;
  for (let i = 0; i < nCol; i++) {
    const cx = -width * 0.44 + width * 0.88 * (i / (nCol - 1));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, bodyH * 0.9, 12), toonMat(STONE));
    col.position.set(cx, platTop + bodyH * 0.45 + 0.1, frontZ + 0.14); g.add(col);
    mesh(0.76, 0.24, 0.5, STONE_DK, cx, platTop + 0.12, frontZ + 0.14);
    mesh(0.76, 0.26, 0.5, STONE_DK, cx, platTop + bodyH * 0.9, frontZ + 0.14);
  }
  // Entablature beam + gold cornice crowning the columns.
  mesh(width * 0.94, 0.5, bodyD + 0.4, GRANITE_DK, 0, platTop + bodyH + 0.05, 0);
  mesh(width * 0.97, 0.16, bodyD + 0.55, GOLD, 0, platTop + bodyH + 0.33, 0);

  // ── Wide low hip roof over the hall ──
  const roofBase = platTop + bodyH + 0.42;
  g.add(hipRoof(width * 1.0, bodyD + 1.3, 1.4, roofBase, ROOF));

  // ── Flanking corner towers (grand wide silhouette) ──
  for (const sx of [-1, 1]) {
    const tx = sx * width * 0.42, tw = Math.max(1.4, width * 0.1), tH = bodyH * 1.28;
    mesh(tw, tH, bodyD * 0.72, GRANITE, tx, platTop + tH / 2, 0);
    mesh(tw + 0.3, 0.14, bodyD * 0.72 + 0.3, GOLD, tx, platTop + tH, 0);
    g.add(hipRoof(tw + 1.0, bodyD * 0.72 + 0.8, 1.0, platTop + tH, ROOF_HI));
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), toonMat(GOLD));
    fin.position.set(tx, platTop + tH + 1.15, 0); g.add(fin);
  }

  // ── Crowning central pavilion + grand gold spire ──
  const pavW = width * 0.34, pavD = bodyD * 0.82, pavH = bodyH * 0.62;
  const pavBase = roofBase + 0.9;
  mesh(pavW, pavH, pavD, GRANITE, 0, pavBase + pavH / 2, 0);
  mesh(pavW * 0.8, pavH * 0.5, 0.16, NAVY, 0, pavBase + pavH * 0.55, pavD / 2 + 0.02);
  g.add(hipRoof(pavW + 1.6, pavD + 1.2, 1.5, pavBase + pavH, ROOF_HI));
  const spireBase = pavBase + pavH + 1.5;
  mesh(0.5, 0.5, 0.5, GOLD, 0, spireBase + 0.1, 0);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.28, 1.6, 8), toonMat(GOLD));
  spire.position.set(0, spireBase + 1.0, 0); g.add(spire);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), toonMat(GOLD));
  orb.position.set(0, spireBase + 1.95, 0); g.add(orb);

  // ── Grand central doorway (gold frame + studded doors) + banners + signboard ──
  const doorH = Math.min(2.6, bodyH * 0.6), doorW = 2.0;
  mesh(doorW + 0.4, doorH + 0.4, 0.16, GOLD, 0, platTop + (doorH + 0.4) / 2, frontZ + 0.16);
  mesh(doorW, doorH, 0.2, DOOR, 0, platTop + doorH / 2, frontZ + 0.22);
  const studMat = toonMat(GOLD);
  for (let yy = 0; yy < 5; yy++) for (const sx of [-0.5, 0.5]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), studMat);
    s.rotation.x = Math.PI / 2; s.position.set(sx, platTop + 0.4 + yy * (doorH - 0.6) / 4, frontZ + 0.33); g.add(s);
  }
  for (const sx of [-1, 1]) {
    const bx = sx * doorW * 1.15;
    mesh(0.5, doorH * 1.1, 0.1, NAVY, bx, platTop + doorH * 0.6, frontZ + 0.2);
    mesh(0.5, 0.24, 0.12, GOLD, bx, platTop + doorH * 1.12, frontZ + 0.22);
  }
  mesh(3.2, 0.8, 0.16, GOLD, 0, platTop + doorH + 0.6, frontZ + 0.2);
  mesh(2.9, 0.56, 0.1, 0x1b120a, 0, platTop + doorH + 0.6, frontZ + 0.29);

  return g;
}

/**
 * A coastal palm tree — a gently leaning tan trunk with segment rings and a crown
 * of drooping green fronds (with a couple of coconuts). Toon-styled, feet at y=0.
 * Suits seaside cities like Parangpo. Vary `seed` so a row of palms isn't identical.
 */
export function makePalmTree(seed = 0): THREE.Group {
  const g = new THREE.Group();
  const rnd = (n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const trunkH = 2.6 + rnd(1) * 0.9;
  const lean = (rnd(2) - 0.5) * 0.5;
  const trunkMat = toonMat(0xb08a4a);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - t * 0.05, 0.2 - t * 0.05, trunkH / segs + 0.04, 8), trunkMat);
    seg.position.set(lean * t * trunkH * 0.4, (i + 0.5) * (trunkH / segs), 0);
    seg.rotation.z = -lean * 0.5;
    g.add(seg);
  }
  const topX = lean * trunkH * 0.4, topY = trunkH;
  // Coconuts clustered under the crown.
  const nutMat = toonMat(0x5a3a1e);
  for (const a of [0.3, -0.5, 1.4]) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), nutMat);
    nut.position.set(topX + Math.cos(a) * 0.22, topY - 0.15, Math.sin(a) * 0.22);
    g.add(nut);
  }
  // Crown of fronds — flattened, drooping blades radiating out.
  const frondMat = toonMat(0x2f8a3f);
  const nFronds = 7;
  for (let i = 0; i < nFronds; i++) {
    const a = (i / nFronds) * Math.PI * 2 + rnd(3) * 0.6;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 4), frondMat);
    frond.position.set(topX + Math.cos(a) * 0.75, topY + 0.15, Math.sin(a) * 0.75);
    frond.rotation.z = Math.PI / 2 - 0.5;   // lay it near-horizontal, drooping
    frond.rotation.y = -a;
    frond.scale.set(1, 1, 0.4);   // flatten into a blade
    g.add(frond);
  }
  return g;
}

/** A hip roof (truncated wide pyramid) sized to a footprint, apex at the centre. */
function hipRoof(w: number, d: number, h: number, yBottom: number, color: number): THREE.Mesh {
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1, h, 4), toonMat(color));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.SQRT2, 1, d / Math.SQRT2);
  roof.position.y = yBottom + h / 2;
  return roof;
}

/**
 * Recognizable Pokémon Center — cream hall, red hip roof, white cross, glass front
 * doors. Used as the everywhere-safe procedural building (e.g. the GLB is disabled
 * on mobile to protect the GPU), so the Center is never an unmarked grey box.
 * Front faces +Z toward the street.
 */
export function makePokemonCenter(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(2.6, Math.min(3.8, Math.min(width, depth) * 0.7));
  const frontZ = depth / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), toonMat(0xf4ead6));
  body.position.y = h / 2; g.add(body);
  g.add(hipRoof(width + 0.7, depth + 0.7, Math.min(1.5, width * 0.35), h, 0xcc2a3a));
  // White cross on the facade.
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.14), toonMat(0xffffff));
  crossV.position.set(0, h * 0.62, frontZ + 0.08); g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 0.14), toonMat(0xffffff));
  crossH.position.set(0, h * 0.62, frontZ + 0.08); g.add(crossH);
  // Glass doors + side windows.
  const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, width * 0.28), h * 0.42, 0.12), toonMat(0x6b4a28));
  door.position.set(0, h * 0.21, frontZ + 0.06); g.add(door);
  for (const sx of [-width * 0.3, width * 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, h * 0.24, 0.1), toonMat(0x88ccff));
    win.position.set(sx, h * 0.5, frontZ + 0.06); g.add(win);
  }
  return g;
}

/**
 * Recognizable Poké Mart — cream hall, blue hip roof, yellow signboard, glass doors.
 * Everywhere-safe procedural counterpart to the Mart GLB. Front faces +Z.
 */
export function makePokeMart(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(2.6, Math.min(3.8, Math.min(width, depth) * 0.7));
  const frontZ = depth / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), toonMat(0xeae0cc));
  body.position.y = h / 2; g.add(body);
  g.add(hipRoof(width + 0.7, depth + 0.7, Math.min(1.5, width * 0.35), h, 0x2a6aaa));
  // Yellow signboard band across the top of the facade.
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.5, 0.12), toonMat(0xffe44e));
  sign.position.set(0, h * 0.78, frontZ + 0.08); g.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, width * 0.28), h * 0.42, 0.12), toonMat(0x6b4a28));
  door.position.set(0, h * 0.21, frontZ + 0.06); g.add(door);
  for (const sx of [-width * 0.3, width * 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, h * 0.24, 0.1), toonMat(0x88ccff));
    win.position.set(sx, h * 0.5, frontZ + 0.06); g.add(win);
  }
  return g;
}

export function makeNosdanHQ(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const height = Math.max(5.2, Math.min(7.2, width * 0.36));
  const frontZ = depth / 2;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    toonMat(0x22222e),
  );
  body.position.y = height / 2;
  g.add(body);

  // Slightly raised front panel reproduces the lighter inset rectangle in the
  // 2D building while giving the facade real depth.
  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.48, height - 0.38, 0.16),
    toonMat(0x303040),
  );
  inset.position.set(0, height / 2 - 0.02, frontZ + 0.09);
  g.add(inset);

  // Four floors, separated by the same dark horizontal storey lines.
  const floorH = height / 4;
  for (let floor = 1; floor < 4; floor++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.42, 0.1, 0.22),
      toonMat(0x14141c),
    );
    band.position.set(0, floor * floorH, frontZ + 0.19);
    g.add(band);
  }

  // Three red-lit windows on every floor, matching the original sprite.
  const glow = new THREE.MeshBasicMaterial({ color: 0xff5a6a });
  const windowW = Math.min(1.18, width * 0.075);
  const windowH = Math.min(0.52, floorH * 0.38);
  for (let floor = 0; floor < 4; floor++) {
    const y = floor * floorH + floorH * 0.62;
    for (const x of [-width * 0.2, 0, width * 0.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.12), glow);
      win.position.set(x, y, frontZ + 0.23);
      g.add(win);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(windowW + 0.16, 0.08, 0.18), toonMat(0x161620));
      sill.position.set(x, y - windowH / 2 - 0.07, frontZ + 0.24);
      g.add(sill);
    }
  }

  // Central entrance aligned with the map's single walkable gate tile.
  const doorW = Math.min(2.0, width * 0.15);
  const doorH = Math.min(2.1, height * 0.34);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.22), toonMat(0x5a1024));
  gate.position.set(0, doorH / 2, frontZ + 0.25);
  g.add(gate);
  const gateInset = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.26, doorH - 0.22, 0.1), toonMat(0x8a1a34));
  gateInset.position.set(0, doorH / 2, frontZ + 0.39);
  g.add(gateInset);

  // The two crimson vertical banners and gold round emblems are the strongest
  // identifying marks in the existing 2D art.
  for (const x of [-width * 0.42, width * 0.42]) {
    const bannerH = height - 0.58;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.36, width * 0.035), bannerH, 0.1),
      toonMat(0x8a1020),
    );
    banner.position.set(x, height / 2, frontZ + 0.27);
    g.add(banner);
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), toonMat(0xffd24a));
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(x, height / 2, frontZ + 0.36);
    g.add(emblem);
  }

  // One flat roof and parapet complete the single-building silhouette.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.22, depth + 0.32), toonMat(0x111119));
  roof.position.y = height + 0.11;
  g.add(roof);
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.18, depth + 0.18), toonMat(0x171720));
  base.position.y = 0.09;
  g.add(base);

  return g;
}

/** Snow-dusted alpine pine: a trunk under three stacked needle tiers, each
 *  capped with a little snow cone — a true 3D version of the town's 2D pines. */
export function makePineTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 6), toonMat(0x5a4030));
  trunk.position.y = 0.25;
  g.add(trunk);
  const needles = 0x2e6b46;
  for (const [r, h, y] of [[0.55, 0.7, 0.7], [0.42, 0.6, 1.0], [0.28, 0.5, 1.3]] as [number, number, number][]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), toonMat(needles));
    cone.position.y = y;
    g.add(cone);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.86, h * 0.34, 7), toonMat(0xffffff));
    snow.position.y = y + h * 0.33;
    g.add(snow);
  }
  return g;
}

/** Korean stone lantern (석등): a stacked stone post topped by a warm glowing
 *  light box under a hip roof — the light uses an unlit bright material so it
 *  reads as lit without a per-lantern point light (mobile-friendly). */
export function makeStoneLantern(): THREE.Group {
  const g = new THREE.Group();
  const stone = 0x9a978f, dark = 0x7a776f;
  const add = (mesh: THREE.Mesh, y: number) => { mesh.position.y = y; g.add(mesh); };
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 6), toonMat(dark)), 0.08);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 6), toonMat(stone)), 0.42);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.08, 6), toonMat(dark)), 0.71);
  // Glowing light chamber.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), new THREE.MeshBasicMaterial({ color: 0xffd680 })), 0.9);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 6), toonMat(stone)), 1.14);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), toonMat(dark)), 1.29);
  return g;
}

/** A hand-placed coastal boulder cluster. Unlike the broad colour-based terrain
 * classifier, this only appears where a scene has an authored rock tile. */
export function makeScenicRock(): THREE.Group {
  const g = new THREE.Group();
  const rocks = makeRocks(3, 0x817a70);
  rocks.place(0, 0, 1.25, 0.25);
  rocks.place(-0.28, 0.18, 0.62, 1.4);
  rocks.place(0.3, 0.2, 0.48, 2.2);
  rocks.finalize();
  g.add(...rocks.meshes);
  return g;
}

/** One lush broadleaf tree for authored parks and forest towns. */
export function makeForestTree(): THREE.Group {
  const g = new THREE.Group();
  const trees = makeTrees(1, 0x3f9345, 0x604329);
  trees.place(0, 0, 1.2, 0);
  trees.finalize();
  g.add(...trees.meshes);
  return g;
}

/** A compact flower bed that keeps the underlying walkable tile natural green. */
export function makeFlowerBed(): THREE.Group {
  const g = new THREE.Group();
  const pink = makeFlowers(2, 0xf27fc2);
  pink.place(-0.18, 0, 1.05, 0.2);
  pink.place(0.2, 0.08, 0.9, 1.2);
  pink.finalize();
  g.add(...pink.meshes);
  return g;
}

/** Bioluminescent woodland mushrooms. MeshBasic caps remain softly luminous
 * without adding expensive point lights on mobile. */
export function makeGlowPlants(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = toonMat(0xb8e7d1);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x70f5cf });
  for (const [x, z, s] of [[-0.22, 0.08, 1], [0.18, -0.08, 0.72], [0.04, 0.22, 0.55]] as [number, number, number][]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.28 * s, 7), stemMat);
    stem.position.set(x, 0.14 * s, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), glowMat);
    cap.position.set(x, 0.3 * s, z);
    g.add(stem, cap);
  }
  return g;
}

/** Low wooden footbridge for ponds. The deck sits close to the ground so the
 * Phaser collision grid remains authoritative and characters never appear sunk. */
export function makeWoodBridge(width = 2, depth = 3): THREE.Group {
  const g = new THREE.Group();
  const deckMat = toonMat(0x9a7448), edgeMat = toonMat(0x60452e);
  const planks = Math.max(4, Math.round(depth * 3));
  for (let i = 0; i < planks; i++) {
    const z = -depth / 2 + (i + 0.5) * depth / planks;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, depth / planks * 0.88), deckMat);
    plank.position.set(0, 0.14 + Math.sin((i / (planks - 1)) * Math.PI) * 0.08, z);
    g.add(plank);
  }
  for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, depth), edgeMat);
    beam.position.set(x, 0.11, 0);
    g.add(beam);
  }
  return g;
}

/** A straight run of railway track (gravel bed + wooden sleepers + two steel
 *  rails) `len` world-units long, laid along the X axis and centred on origin.
 *  Low profile so it never blocks the player. */
export function makeRailTrack(len: number): THREE.Group {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.92), toonMat(0x6b6560));
  bed.position.y = 0.04;
  g.add(bed);
  const nTies = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i < nTies; i++) {
    const x = -len / 2 + (i + 0.5) * (len / nTies);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.82), toonMat(0x5a4433));
    tie.position.set(x, 0.1, 0);
    g.add(tie);
  }
  for (const z of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), toonMat(0x9098a0));
    rail.position.set(0, 0.16, z);
    g.add(rail);
  }
  return g;
}

/** Translucent ice sculpture on a pedestal: stacked ice-blue snow-figure
 *  spheres crowned by a faceted crystal — the 3D take on the town's snow
 *  sculptures / Ice Bell landmarks. */
export function makeIceStatue(): THREE.Group {
  const g = new THREE.Group();
  const ice = toonMat(0xbfeaff, { transparent: true, opacity: 0.72 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.3, 8), toonMat(0x9fbfd6));
  ped.position.y = 0.15;
  g.add(ped);
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), ice); b1.position.y = 0.72; g.add(b1);
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), ice); b2.position.y = 1.36; g.add(b2);
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), ice);
  crown.position.y = 1.9; crown.rotation.y = 0.5;
  g.add(crown);
  return g;
}

/** Traditional Korean 옹기 pottery jar — glossy dark-clay body with a narrow
 *  mouth and rolled rim, a wide-bellied fermenting urn. */
export function makePot(): THREE.Group {
  const g = new THREE.Group();
  const clay = 0x4a3324, glaze = 0x6a4a34;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), toonMat(glaze));
  body.scale.set(1, 1.12, 1); body.position.y = 0.36;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), toonMat(clay));
  foot.position.y = 0.04;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.13, 12), toonMat(glaze));
  neck.position.y = 0.66;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), toonMat(clay));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.72;
  g.add(foot, body, neck, rim);
  return g;
}

/** Street lamp: a slim post with a warm glowing lantern head (unlit bright
 *  material so it reads as lit without a per-lamp light — mobile-friendly). */
export function makeStreetlamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = 0x3a3a42;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.16, 8), toonMat(metal));
  base.position.y = 0.08;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), toonMat(metal));
  post.position.y = 0.9;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), toonMat(metal));
  arm.rotation.z = Math.PI / 2; arm.position.set(0, 1.7, 0);
  // Warm glowing lamp head.
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
  glass.position.y = 1.62;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 6), toonMat(metal));
  cap.position.y = 1.8;
  g.add(base, post, arm, glass, cap);
  return g;
}

/** Wooden mine cart heaped with ore, on four steel wheels. */
export function makeMineCart(): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x6a4a2a, metal = 0x39332f, ore = 0x5a5262;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.42), toonMat(wood));
  body.position.y = 0.34;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.46), toonMat(metal));
  rim.position.y = 0.5;
  const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), toonMat(ore));
  heap.scale.set(1.2, 0.6, 0.85); heap.position.y = 0.54;
  for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]] as [number, number][]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), toonMat(metal));
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.1, z); g.add(w);
  }
  g.add(body, rim, heap);
  return g;
}

/** Cherry-blossom tree — a trunk under two soft pink canopy puffs. */
export function makeCherryTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.62, 6), toonMat(0x6d4c33));
  trunk.position.y = 0.31;
  const blossom = 0xffb7d5;
  const lo = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 6), toonMat(blossom));
  lo.scale.set(1, 0.85, 1); lo.position.y = 0.98;
  const hi = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), toonMat(mixColor(blossom, 0xffffff, 0.22)));
  hi.position.y = 1.4;
  g.add(trunk, lo, hi);
  return g;
}

/** Open-front market stall: a wooden counter with goods under a striped awning
 *  on two posts — a street vendor / fish-market stand. */
export function makeStall(): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x9a6a3a, awning = 0xd84a3a;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.5), toonMat(wood));
  counter.position.set(0, 0.2, 0.05);
  const goods = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.4), toonMat(0x9fd0e6));
  goods.position.set(0, 0.46, 0.05);
  for (const x of [-0.42, 0.42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), toonMat(0x6a4a2a));
    post.position.set(x, 0.55, -0.18); g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.56), toonMat(awning));
  roof.position.set(0, 1.0, 0.02); roof.rotation.x = -0.18;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.12, 0.04), toonMat(0xf0f0f0));
  trim.position.set(0, 0.95, 0.28); trim.rotation.x = -0.18;
  g.add(counter, goods, roof, trim);
  return g;
}

/** A vertical cascading waterfall: a tall water sheet with white flow streaks,
 *  a foam pool at the base and a rock ledge at the crest. Built from primitives
 *  (no external asset), so it works offline and reads as falling water. */
export function makeWaterfall(height = 3, width = 1.4): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#cdeeff'); grd.addColorStop(0.16, '#5fc8f0'); grd.addColorStop(1, '#2f9fd8');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const x = 4 + i * 6 + (i % 2) * 2;
    ctx.beginPath(); ctx.moveTo(x, 0);
    for (let y = 0; y <= 128; y += 8) ctx.lineTo(x + Math.sin(y * 0.11 + i) * 2, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sheetMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, height), sheetMat);
  sheet.position.y = height / 2; g.add(sheet);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.06, height), sheetMat);
  back.position.set(0, height / 2, -0.07); g.add(back);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(width * 0.72, 16), new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.04; g.add(foam);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(width * 1.3, 0.3, 0.55), toonMat(0x6a6058));
  ledge.position.y = height + 0.08; g.add(ledge);
  return g;
}

// ── Department-store interior fixtures ─────────────────────────────────────
// These are deliberately procedural: every floor can share a coherent visual
// language without depending on external model downloads, and the 2D fallback
// remains usable when WebGL is unavailable.
export type StoreFixtureKind =
  | 'store-wall' | 'store-counter' | 'store-shelf' | 'store-display'
  | 'store-tmrack' | 'store-table' | 'store-elevator' | 'store-planter'
  | 'store-bench' | 'store-directory' | 'store-sofa' | 'store-vending'
  | 'store-railing';

/** Low-poly fixture sized in world tiles and centred on the origin. */
export function makeStoreFixture(
  kind: StoreFixtureKind,
  width = 1,
  depth = 1,
  color = 0x6a7f9a,
): THREE.Group {
  const g = new THREE.Group();
  const w = Math.max(0.18, width), d = Math.max(0.12, depth);
  const dark = 0x343946, metal = 0xaeb8c4, wood = 0x8b623e;
  const box = (bw: number, bh: number, bd: number, matColor: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), toonMat(matColor));
    m.position.set(x, y, z); g.add(m); return m;
  };

  if (kind === 'store-wall') {
    box(w, 1.3, d, color, 0, 0.65, 0);
    box(w, 0.08, d + 0.04, 0xe1c77c, 0, 1.18, 0);
  } else if (kind === 'store-counter') {
    box(w * 0.96, 0.78, d * 0.86, color, 0, 0.39, 0);
    box(w, 0.12, d, 0xe5d4b0, 0, 0.84, 0);
    box(w * 0.78, 0.08, 0.04, dark, 0, 0.48, d * 0.45);
  } else if (kind === 'store-shelf') {
    for (const x of [-w * 0.46, w * 0.46]) box(0.08, 1.45, d * 0.84, dark, x, 0.73, 0);
    for (const y of [0.16, 0.62, 1.08, 1.46]) box(w, 0.08, d * 0.9, color, 0, y, 0);
    const count = Math.max(3, Math.min(10, Math.round(w * 3)));
    const productColors = [0xf26b5b, 0x5ba8e8, 0xf0c44f, 0x70c98b, 0xb787d7];
    for (let i = 0; i < count; i++) {
      const x = -w * 0.42 + (i + 0.5) * (w * 0.84 / count);
      box(Math.max(0.08, w * 0.55 / count), 0.22, d * 0.46, productColors[i % productColors.length], x, 0.31 + (i % 3) * 0.46, 0);
    }
  } else if (kind === 'store-display' || kind === 'store-tmrack') {
    box(w * 0.82, 0.48, d * 0.82, color, 0, 0.24, 0);
    box(w * 0.94, 0.1, d * 0.94, 0xf0dfbd, 0, 0.53, 0);
    if (kind === 'store-tmrack') {
      for (const [x, c] of [[-0.22, 0x55c8ff], [0, 0xffd85a], [0.22, 0xff6cae]] as [number, number][]) {
        const disc = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 14), toonMat(c));
        disc.position.set(x * Math.min(1, w), 0.86, 0); disc.rotation.x = Math.PI / 2.8; g.add(disc);
      }
    } else {
      const gift = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(0.3, w * 0.24), 0), toonMat(0xff8ab4));
      gift.position.y = 0.84; gift.rotation.y = 0.45; g.add(gift);
      box(0.06, 0.58, 0.06, 0xf4d04e, 0, 0.86, 0);
    }
  } else if (kind === 'store-table') {
    box(w * 0.72, 0.12, d * 0.72, 0xd8b47a, 0, 0.72, 0);
    box(0.13, 0.68, 0.13, dark, 0, 0.35, 0);
    for (const [x, z] of [[-w * 0.43, 0], [w * 0.43, 0], [0, -d * 0.43], [0, d * 0.43]] as [number, number][]) {
      box(0.34, 0.1, 0.34, color, x, 0.42, z);
      box(0.09, 0.4, 0.09, dark, x, 0.2, z);
    }
  } else if (kind === 'store-elevator') {
    box(w, 2.4, d * 0.34, dark, 0, 1.2, -d * 0.33);
    box(0.16, 2.35, d, metal, -w * 0.45, 1.17, 0);
    box(0.16, 2.35, d, metal, w * 0.45, 1.17, 0);
    box(w, 0.2, d, metal, 0, 2.28, 0);
    box(w * 0.43, 2.0, 0.08, 0x7297b8, -w * 0.22, 1.1, d * 0.42);
    box(w * 0.43, 2.0, 0.08, 0x7297b8, w * 0.22, 1.1, d * 0.42);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd85a }));
    lamp.position.set(w * 0.38, 1.45, d * 0.5); g.add(lamp);
  } else if (kind === 'store-planter') {
    box(w * 0.94, 0.42, d * 0.94, color, 0, 0.21, 0);
    box(w * 0.82, 0.08, d * 0.82, 0x4a3324, 0, 0.44, 0);
    const n = Math.max(2, Math.round(w * 2));
    for (let i = 0; i < n; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), toonMat(i % 2 ? 0x4e9b52 : 0x397a45));
      leaf.scale.set(0.8, 1.45, 0.8);
      leaf.position.set(-w * 0.34 + (i + 0.5) * (w * 0.68 / n), 0.75, (i % 2 ? 0.12 : -0.1) * d);
      g.add(leaf);
    }
  } else if (kind === 'store-bench') {
    box(w, 0.12, d * 0.72, wood, 0, 0.48, 0);
    box(w, 0.5, 0.1, color, 0, 0.76, -d * 0.28);
    for (const x of [-w * 0.36, w * 0.36]) box(0.1, 0.48, 0.1, dark, x, 0.24, 0);
  } else if (kind === 'store-directory') {
    box(w * 0.85, 1.35, 0.14, 0x334863, 0, 1.05, 0);
    box(w, 0.12, d * 0.62, metal, 0, 0.08, 0);
    for (let i = 0; i < 6; i++) box(w * 0.62, 0.055, 0.02, i % 2 ? 0xffd76a : 0xcfe8ff, 0, 1.48 - i * 0.18, 0.08);
  } else if (kind === 'store-sofa') {
    box(w, 0.42, d * 0.88, color, 0, 0.31, 0);
    box(w, 0.58, 0.22, color, 0, 0.68, -d * 0.34);
    for (const x of [-w * 0.46, w * 0.46]) box(0.16, 0.42, d, dark, x, 0.42, 0);
  } else if (kind === 'store-vending') {
    box(w * 0.9, 1.72, d * 0.78, color, 0, 0.86, 0);
    box(w * 0.68, 0.82, 0.05, 0xc8efff, 0, 1.12, d * 0.41);
    for (let i = 0; i < 6; i++) box(0.1, 0.18, 0.06, [0x5cc9ff, 0xff6d73, 0xffd04f][i % 3], -0.22 + (i % 3) * 0.22, 1.37 - Math.floor(i / 3) * 0.32, d * 0.46);
    box(w * 0.42, 0.16, 0.05, dark, 0, 0.3, d * 0.42);
  } else if (kind === 'store-railing') {
    box(w, 0.1, Math.max(0.08, d), metal, 0, 0.9, 0);
    const n = Math.max(2, Math.round(w / 0.7));
    for (let i = 0; i <= n; i++) box(0.07, 0.92, Math.max(0.08, d), dark, -w / 2 + i * (w / n), 0.46, 0);
  }
  return g;
}

/** Grey-granite civic obelisk with a stepped base and gold finial. */
export function makeGrandObelisk(): THREE.Group {
  const g = new THREE.Group();
  const granite = toonMat(0x62666f);
  const dark = toonMat(0x454952);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), dark);
  base.position.y = 0.11;
  g.add(base);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.62), granite);
  step.position.y = 0.34;
  g.add(step);
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.65, 4), granite);
  shaft.position.y = 1.78;
  shaft.rotation.y = Math.PI / 4;
  g.add(shaft);
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), toonMat(0xd8b44a));
  finial.position.y = 3.22;
  g.add(finial);
  return g;
}

/** Bronze civic figure on a low granite plinth. */
export function makeBronzeStatue(): THREE.Group {
  const g = new THREE.Group();
  const bronze = toonMat(0x98743a);
  const stone = toonMat(0x4b4f58);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.72), stone);
  plinth.position.y = 0.21;
  g.add(plinth);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.24), bronze);
  legs.position.y = 0.78;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.3), bronze);
  torso.position.y = 1.43;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bronze);
  head.position.y = 1.96;
  g.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6), bronze);
    arm.position.set(side * 0.38, 1.5 + (side > 0 ? 0.08 : 0), 0);
    arm.rotation.z = side * (Math.PI / 2.8);
    g.add(arm);
  }
  return g;
}

/** Walk-through ceremonial arch sized for a two-tile avenue. */
export function makeTriumphalArch(): THREE.Group {
  const g = new THREE.Group();
  const stone = toonMat(0x5b5f68);
  const trim = toonMat(0x3f434b);
  for (const x of [-0.78, 0.78]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.62), trim);
    foot.position.set(x, 0.09, 0);
    g.add(foot);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.15, 0.48), stone);
    pillar.position.set(x, 1.17, 0);
    g.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.48, 0.58), stone);
  beam.position.y = 2.28;
  g.add(beam);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.16, 0.7), trim);
  crown.position.y = 2.6;
  g.add(crown);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), toonMat(0xd8b44a));
  star.position.set(0, 2.3, 0.34);
  g.add(star);
  return g;
}

// ── Water surface ───────────────────────────────────────────────────────────
/** Paint one bright-cyan water tile with curved light ribbons and soft glints. */
function paintWaterTile(sparkleSeed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  // Flat vivid cyan base with a soft vertical brighten toward the top-left.
  const grd = ctx.createLinearGradient(0, 0, 128, 128);
  grd.addColorStop(0, '#38c6f4');
  grd.addColorStop(1, '#1ba3e6');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  // Broad curved ribbons imply a continuous surface instead of pixel chunks.
  ctx.strokeStyle = 'rgba(218,248,255,0.48)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let band = 0; band < 5; band++) {
    const y0 = 16 + band * 24;
    ctx.beginPath();
    for (let x = -8; x <= 136; x += 8) {
      const y = y0 + Math.sin(x * 0.07 + band * 1.7) * 4;
      if (x === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Small highlights keep the surface lively without a pixel-art checker.
  let s = sparkleSeed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  ctx.fillStyle = 'rgba(236,252,255,0.86)';
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * 120) + 4;
    const y = Math.floor(rnd() * 120) + 4;
    ctx.beginPath(); ctx.ellipse(x, y, 3 + rnd() * 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Animated bright-cyan water sheet placed over painted water regions.
 *  Two crossfading sparkle layers drift slowly for a gentle shimmer. */
export function makeWater(width: number, depth: number): { mesh: THREE.Mesh; update(t: number): void } {
  const mkTex = (seed: number) => {
    const t = new THREE.CanvasTexture(paintWaterTile(seed));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.repeat.set(Math.max(1, width / 3.2), Math.max(1, depth / 3.2));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tex = mkTex(0x9e3779b9);
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.94, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return {
    mesh,
    update(t: number) {
      // Slow drift + a subtle vertical bob so the glints twinkle rather than slide.
      tex.offset.x = t * 0.012;
      tex.offset.y = Math.sin(t * 0.5) * 0.03;
      (mat).opacity = 0.9 + Math.sin(t * 1.3) * 0.05;
    },
  };
}

/**
 * A stylized passenger/car ferry — the overnight 남해 연락선. Built from toon
 * primitives so it renders anywhere without an asset file. The bow points toward
 * +Z; the model sits with its waterline at y≈0 (hull below, deck above) so it can
 * be dropped straight onto a sea plane. `length` runs along Z, `beam` along X.
 */
export function makeFerry(length = 9, beam = 3.2): THREE.Group {
  const g = new THREE.Group();
  const hullH = beam * 0.5;
  const halfL = length / 2;

  // ── Hull ── dark navy body, most of it below the waterline.
  const hull = new THREE.Mesh(new THREE.BoxGeometry(beam, hullH, length * 0.82), toonMat(0x1b3b5f));
  hull.position.set(0, -hullH * 0.28, -length * 0.04);
  g.add(hull);
  // Red boot-topping stripe along the waterline.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(beam + 0.04, hullH * 0.16, length * 0.82), toonMat(0xb5352f));
  stripe.position.set(0, hullH * 0.02, -length * 0.04);
  g.add(stripe);
  // Bow wedge — a 4-sided prism narrowing to a point at the bow (+Z).
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.001, hullH * 0.9, beam, 4), toonMat(0x1b3b5f));
  bow.rotation.z = Math.PI / 2;              // point along ±X → then aim down +Z
  bow.rotation.y = Math.PI / 2;
  bow.scale.set(1, length * 0.16, 1);
  bow.position.set(0, -hullH * 0.2, halfL * 0.82);
  g.add(bow);

  // ── Main deck ── pale planked platform on top of the hull.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.98, 0.18, length * 0.86), toonMat(0xd8c39a));
  deck.position.set(0, hullH * 0.22, -length * 0.02);
  g.add(deck);

  // ── Superstructure ── two white cabin tiers set back from the bow.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.8, hullH * 0.7, length * 0.5), toonMat(0xf2f0ea));
  tier1.position.set(0, hullH * 0.22 + hullH * 0.35, -length * 0.12);
  g.add(tier1);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.6, hullH * 0.55, length * 0.34), toonMat(0xf6f5f0));
  tier2.position.set(0, hullH * 0.22 + hullH * 0.7 + hullH * 0.27, -length * 0.14);
  g.add(tier2);
  // Bridge windows — blue bands wrapping each tier.
  for (const [y, w, z] of [
    [hullH * 0.22 + hullH * 0.35, beam * 0.82, length * 0.5],
    [hullH * 0.22 + hullH * 0.7 + hullH * 0.27, beam * 0.62, length * 0.34],
  ] as const) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w, hullH * 0.16, z), toonMat(0x2f6fa8));
    band.position.set(0, y + hullH * 0.08, -length * 0.13);
    g.add(band);
  }

  // ── Funnel ── red stack with a black cap, set aft (−Z).
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.16, beam * 0.19, hullH * 0.75, 12), toonMat(0xc23a30));
  funnel.position.set(0, hullH * 0.22 + hullH * 0.7 + hullH * 0.55, -length * 0.22);
  g.add(funnel);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.18, beam * 0.18, hullH * 0.12, 12), toonMat(0x1c1c22));
  cap.position.set(0, funnel.position.y + hullH * 0.4, funnel.position.z);
  g.add(cap);

  // ── Rails ── thin posts + a top rail down both deck edges.
  const railMat = toonMat(0xece7db);
  const deckY = hullH * 0.22 + 0.09;
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, length * 0.8), railMat);
    rail.position.set(sx * beam * 0.47, deckY + 0.34, -length * 0.02);
    g.add(rail);
    for (let i = -4; i <= 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), railMat);
      post.position.set(sx * beam * 0.47, deckY + 0.17, i * (length * 0.8 / 9) - length * 0.02);
      g.add(post);
    }
  }

  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ── Merged wall/cliff blocks (vertex-colored) ───────────────────────────────
export class WallBuilder {
  private pos: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private tmp = new THREE.Color();

  /** Add one box spanning tile-space [x0,x1)×[z0,z1) with height h, tinted `color`. */
  add(x0: number, z0: number, x1: number, z1: number, h: number, color: number): void {
    const c = this.tmp.set(color);
    const shade = (f: number) => [c.r * f, c.g * f, c.b * f] as const;
    const top = shade(1.08), bevelTone = shade(0.94), front = shade(0.82), side = shade(0.7);
    const base = () => this.pos.length / 3;
    const quad = (
      pts: number[], rgb: readonly [number, number, number],
    ) => {
      const b = base();
      this.pos.push(...pts);
      for (let i = 0; i < 4; i++) this.col.push(rgb[0], rgb[1], rgb[2]);
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    // Chamfered cap: a small sloped shoulder catches the sun and prevents long
    // cliff runs from reading as stacked rectangular blocks.
    const bevel = Math.min(0.14, (x1 - x0) * 0.12, (z1 - z0) * 0.12, h * 0.18);
    const yShoulder = h - bevel;
    const ix0 = x0 + bevel, ix1 = x1 - bevel, iz0 = z0 + bevel, iz1 = z1 - bevel;
    quad([ix0, h, iz0, ix1, h, iz0, ix1, h, iz1, ix0, h, iz1], top);
    quad([x0, yShoulder, z0, x1, yShoulder, z0, ix1, h, iz0, ix0, h, iz0], bevelTone);
    quad([x1, yShoulder, z1, x0, yShoulder, z1, ix0, h, iz1, ix1, h, iz1], bevelTone);
    quad([x0, yShoulder, z1, x0, yShoulder, z0, ix0, h, iz0, ix0, h, iz1], bevelTone);
    quad([x1, yShoulder, z0, x1, yShoulder, z1, ix1, h, iz1, ix1, h, iz0], bevelTone);
    // Vertical faces stop at the shoulder.
    quad([x0, 0, z1, x1, 0, z1, x1, yShoulder, z1, x0, yShoulder, z1], front);
    quad([x1, 0, z0, x0, 0, z0, x0, yShoulder, z0, x1, yShoulder, z0], front);
    quad([x0, 0, z0, x0, 0, z1, x0, yShoulder, z1, x0, yShoulder, z0], side);
    quad([x1, 0, z1, x1, 0, z0, x1, yShoulder, z0, x1, yShoulder, z1], side);
  }

  build(): THREE.Mesh | null {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    return new THREE.Mesh(g, m);
  }
}
