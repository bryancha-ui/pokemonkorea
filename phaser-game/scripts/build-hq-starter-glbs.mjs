import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// GLTFExporter uses the browser FileReader API even when it only emits a binary
// GLB. This tiny compatible implementation keeps the asset build reproducible in
// Node without adding another package to the game.
class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
    }
  }
  async readAsDataURL(blob) {
    try {
      const bytes = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
    }
  }
}
globalThis.FileReader ??= NodeFileReader;

const OUT_DIR = resolve('public/assets/models3d');
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

function material(name, color, options = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
    side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.name = name;
  return m;
}

function finish(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ellipsoid(name, mat, position, scale, segments = 40) {
  const mesh = finish(new THREE.Mesh(
    new THREE.SphereGeometry(1, segments, Math.max(24, Math.round(segments * 0.65))),
    mat,
  ), name);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  return mesh;
}

function cylinder(name, mat, radiusTop, radiusBottom, height, position, segments = 40) {
  const mesh = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 2),
    mat,
  ), name);
  mesh.position.set(...position);
  return mesh;
}

function cylinderBetween(name, mat, a, b, radius, segments = 24) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const mesh = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), segments, 2),
    mat,
  ), name);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, delta.normalize());
  return mesh;
}

function tube(name, mat, points, radius, tubularSegments = 72, radialSegments = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  return finish(new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false),
    mat,
  ), name);
}

function taperedTube(name, mat, points, radiusAt, tubularSegments = 96, radialSegments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, p);
    const radius = radiusAt(t);
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments * Math.PI * 2;
      const offset = frames.normals[i].clone().multiplyScalar(Math.cos(v) * radius)
        .add(frames.binormals[i].clone().multiplyScalar(Math.sin(v) * radius));
      positions.push(p.x + offset.x, p.y + offset.y, p.z + offset.z);
      uvs.push(t, j / radialSegments);
    }
  }
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = finish(new THREE.Mesh(geo, mat), name);
  mesh.userData.curve = curve;
  return mesh;
}

function extrudedShape(name, mat, points, depth = 0.12, bevel = 0.025) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 18,
  });
  geo.translate(0, 0, -depth / 2);
  return finish(new THREE.Mesh(geo, mat), name);
}

function leaf(name, mat, width, height, depth = 0.11) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -height * 0.5);
  shape.bezierCurveTo(-width * 0.62, -height * 0.2, -width * 0.56, height * 0.28, 0, height * 0.5);
  shape.bezierCurveTo(width * 0.56, height * 0.28, width * 0.62, -height * 0.2, 0, -height * 0.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  return finish(new THREE.Mesh(geo, mat), name);
}

function torusBand(name, mat, center, tangent, majorRadius, tubeRadius, scaleY = 1) {
  const mesh = finish(new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 14, 48),
    mat,
  ), name);
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(Z, tangent.clone().normalize());
  mesh.scale.y = scaleY;
  return mesh;
}

function addEye(group, prefix, x, y, z, whiteMat, irisMat, pupilMat, scale = 1) {
  const white = ellipsoid(`${prefix}_EyeWhite`, whiteMat, [x, y, z], [0.105 * scale, 0.145 * scale, 0.052 * scale], 28);
  const iris = ellipsoid(`${prefix}_Iris`, irisMat, [x, y, z + 0.047 * scale], [0.058 * scale, 0.096 * scale, 0.028 * scale], 24);
  const pupil = ellipsoid(`${prefix}_Pupil`, pupilMat, [x, y, z + 0.073 * scale], [0.023 * scale, 0.067 * scale, 0.014 * scale], 20);
  const catchlight = ellipsoid(`${prefix}_Catchlight`, whiteMat, [x - 0.017 * scale, y + 0.034 * scale, z + 0.089 * scale], [0.012, 0.018, 0.008], 14);
  group.add(white, iris, pupil, catchlight);
}

function quatTrack(node, times, deltaEulers) {
  const base = node.quaternion.clone();
  const values = [];
  for (const [x, y, z] of deltaEulers) {
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    const q = base.clone().multiply(delta).normalize();
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values);
}

function vecTrack(node, property, times, values) {
  return new THREE.VectorKeyframeTrack(`${node.name}.${property}`, times, values.flat());
}

/**
 * Four authored object-space animation clips are baked into every GLB. The
 * game's CreatureAnimator adds locomotion and camera-facing movement on the
 * outer normalized root; these clips animate the character's internal acting
 * (breathing, tail/wing anticipation, recoil and defeat silhouette).
 */
function createBattleClips(group, profile) {
  const node = name => group.getObjectByName(name);
  const tracks = [];

  const idleTimes = [0, 0.75, 1.5, 2.25, 3];
  const baseScale = group.scale.toArray();
  const basePosition = group.position.toArray();
  tracks.push(vecTrack(group, 'scale', idleTimes, [
    baseScale,
    [baseScale[0] * 1.006, baseScale[1] * 1.022, baseScale[2] * 1.006],
    baseScale,
    [baseScale[0] * 0.996, baseScale[1] * 0.988, baseScale[2] * 1.004],
    baseScale,
  ]));
  tracks.push(vecTrack(group, 'position', idleTimes, [
    basePosition,
    [basePosition[0], basePosition[1] + 0.018, basePosition[2]],
    basePosition,
    [basePosition[0], basePosition[1] - 0.01, basePosition[2] + 0.008],
    basePosition,
  ]));
  const idleAct = node(profile.idle);
  if (idleAct) tracks.push(quatTrack(idleAct, idleTimes, [
    [0, -profile.idleAmount, 0], [0, 0, profile.idleAmount * 0.55],
    [0, profile.idleAmount, 0], [0, 0, -profile.idleAmount * 0.55], [0, -profile.idleAmount, 0],
  ]));
  const head = node(profile.head);
  if (head) tracks.push(quatTrack(head, idleTimes, [
    [0.015, -0.025, 0], [-0.02, 0.02, 0.012], [0.018, 0.03, 0], [-0.015, -0.018, -0.01], [0.015, -0.025, 0],
  ]));
  const idle = new THREE.AnimationClip('Idle_Breathe', 3, tracks.splice(0));

  const attackTimes = [0, 0.14, 0.34, 0.52, 0.78];
  const attackTracks = [vecTrack(group, 'scale', attackTimes, [
    baseScale,
    [baseScale[0] * 1.08, baseScale[1] * 0.9, baseScale[2] * 1.08],
    [baseScale[0] * 0.96, baseScale[1] * 1.08, baseScale[2] * 1.05],
    [baseScale[0] * 1.02, baseScale[1] * 1.01, baseScale[2] * 1.02],
    baseScale,
  ]), vecTrack(group, 'position', attackTimes, [
    basePosition,
    [basePosition[0], basePosition[1] - 0.06, basePosition[2] - 0.08],
    [basePosition[0], basePosition[1] + 0.14, basePosition[2] + 0.28],
    [basePosition[0], basePosition[1] + 0.035, basePosition[2] + 0.08],
    basePosition,
  ])];
  for (const [name, axis, amount] of profile.attack) {
    const part = node(name);
    if (!part) continue;
    const delta = (v) => axis === 'x' ? [v, 0, 0] : axis === 'y' ? [0, v, 0] : [0, 0, v];
    attackTracks.push(quatTrack(part, attackTimes, [delta(0), delta(-amount * 0.55), delta(amount), delta(amount * -0.18), delta(0)]));
  }
  const attack = new THREE.AnimationClip('Attack_Signature', 0.78, attackTracks);

  const hitTimes = [0, 0.08, 0.18, 0.3, 0.45];
  const hitTracks = [quatTrack(group, hitTimes, [
    [0, 0, 0], [0, 0, -0.14], [0, 0, 0.1], [0, 0, -0.045], [0, 0, 0],
  ]), vecTrack(group, 'position', hitTimes, [
    basePosition,
    [basePosition[0] - 0.13, basePosition[1] + 0.035, basePosition[2] - 0.07],
    [basePosition[0] + 0.07, basePosition[1], basePosition[2] + 0.035],
    [basePosition[0] - 0.025, basePosition[1], basePosition[2]],
    basePosition,
  ])];
  if (head) hitTracks.push(quatTrack(head, hitTimes, [
    [0, 0, 0], [0.16, 0, 0.12], [-0.08, 0, -0.08], [0.03, 0, 0.03], [0, 0, 0],
  ]));
  const hit = new THREE.AnimationClip('Hit_Recoil', 0.45, hitTracks);

  const faintTimes = [0, 0.25, 0.62, 1];
  const faintTracks = [vecTrack(group, 'scale', faintTimes, [
    baseScale,
    [baseScale[0] * 1.03, baseScale[1] * 0.94, baseScale[2] * 1.03],
    [baseScale[0] * 1.08, baseScale[1] * 0.79, baseScale[2] * 1.08],
    [baseScale[0] * 1.1, baseScale[1] * 0.72, baseScale[2] * 1.1],
  ]), vecTrack(group, 'position', faintTimes, [
    basePosition,
    [basePosition[0], basePosition[1] - 0.025, basePosition[2]],
    [basePosition[0] + 0.055, basePosition[1] - 0.09, basePosition[2] - 0.035],
    [basePosition[0] + 0.09, basePosition[1] - 0.16, basePosition[2] - 0.08],
  ])];
  if (head) faintTracks.push(quatTrack(head, faintTimes, [
    [0, 0, 0], [0.18, 0, 0.03], [0.48, 0, 0.08], [0.64, 0, 0.12],
  ]));
  for (const [name, axis, amount] of profile.faint) {
    const part = node(name);
    if (!part) continue;
    const delta = (v) => axis === 'x' ? [v, 0, 0] : axis === 'y' ? [0, v, 0] : [0, 0, v];
    faintTracks.push(quatTrack(part, faintTimes, [delta(0), delta(amount * 0.25), delta(amount * 0.72), delta(amount)]));
  }
  const faint = new THREE.AnimationClip('Faint_Defeat', 1, faintTracks);
  return [idle, attack, hit, faint];
}

function buildThanatoat() {
  const g = new THREE.Group();
  g.name = 'Thanatoat_HQ';
  g.userData = { pokemonKey: 'thanatoat', koreanName: '두루광', frontAxis: '+Z', quality: 'HQ' };
  const ink = material('Thanatoat_Ink', 0x171d2d, { roughness: 0.47 });
  const robe = material('Thanatoat_Robe', 0x303744, { roughness: 0.68 });
  const robeLight = material('Thanatoat_RobeLight', 0x4b5157, { roughness: 0.65 });
  const blue = material('Thanatoat_Blue', 0x087db3, { roughness: 0.42 });
  const blueLight = material('Thanatoat_Face', 0x9bbbe7, { roughness: 0.48 });
  const bone = material('Thanatoat_Collar', 0xf0f3f1, { roughness: 0.72 });
  const gold = material('Thanatoat_Gold', 0xf6c94e, { roughness: 0.35, metalness: 0.18, emissive: 0x4a2700, emissiveIntensity: 0.18 });
  const wisp = material('Thanatoat_Wisp', 0xa9ebff, { opacity: 0.55, emissive: 0x3daccf, emissiveIntensity: 0.75, roughness: 0.2 });

  const robeBody = cylinder('Robe_Core', robe, 0.47, 0.78, 1.62, [0, 1.04, 0], 52);
  robeBody.scale.z = 0.72;
  g.add(robeBody);
  const robeFront = extrudedShape('Robe_FrontPanel', robeLight, [
    [-0.38, 1.72], [-0.7, 1.12], [-0.8, 0.22], [-0.5, 0.08], [-0.12, 0.34],
    [0.2, 0.1], [0.64, 0.25], [0.72, 1.12], [0.38, 1.72],
  ], 0.19, 0.035);
  robeFront.position.z = 0.42;
  g.add(robeFront);

  // Layered wing-sleeves preserve the crane and jeoseung-saja silhouette from
  // the original artwork while staying volumetric from all camera angles.
  for (const side of [-1, 1]) {
    const sleeve = extrudedShape(`WingSleeve_${side < 0 ? 'L' : 'R'}`, ink, [
      [0, 1.62], [side * 0.55, 1.74], [side * 1.25, 1.55], [side * 1.68, 0.84],
      [side * 1.54, 0.35], [side * 1.02, 0.62], [side * 0.48, 1.06],
    ], 0.22, 0.04);
    sleeve.position.z = -0.03;
    g.add(sleeve);
    for (let i = 0; i < 5; i++) {
      const feather = leaf(`CraneFeather_${side}_${i}`, i % 2 ? robe : ink, 0.23 + i * 0.025, 0.74 + i * 0.08, 0.13);
      feather.position.set(side * (0.48 + i * 0.22), 1.48 - i * 0.08, 0.11 - i * 0.025);
      feather.rotation.z = side * (-0.9 + i * 0.12);
      g.add(feather);
    }
  }

  const neck = taperedTube('Crane_Neck', blue, [[0, 1.48, 0.1], [-0.07, 1.95, 0.12], [0.03, 2.52, 0.14], [0, 2.86, 0.2]], t => 0.17 - t * 0.035, 80, 24);
  g.add(neck);
  const collarL = extrudedShape('Collar_L', bone, [[-0.42, 1.62], [-0.05, 1.37], [0, 1.68], [-0.25, 1.87]], 0.11, 0.02);
  const collarR = extrudedShape('Collar_R', bone, [[0.42, 1.62], [0.05, 1.37], [0, 1.68], [0.25, 1.87]], 0.11, 0.02);
  collarL.position.z = collarR.position.z = 0.49;
  g.add(collarL, collarR);
  for (const side of [-1, 1]) {
    const bow = leaf(`Bow_${side}`, robeLight, 0.24, 0.5, 0.12);
    bow.position.set(side * 0.19, 1.3, 0.55);
    bow.rotation.z = side * 1.02;
    g.add(bow);
  }

  g.add(ellipsoid('Crane_Head', blue, [0, 2.98, 0.22], [0.43, 0.34, 0.41]));
  g.add(ellipsoid('Face_Mask', blueLight, [0, 2.92, 0.49], [0.34, 0.27, 0.23], 36));
  const eyeMat = material('Thanatoat_EyeGlow', 0xffd84d, { emissive: 0xd88800, emissiveIntensity: 0.9, roughness: 0.25 });
  const pupilMat = material('Thanatoat_Pupil', 0x132038, { roughness: 0.3 });
  for (const x of [-0.17, 0.17]) {
    const eye = ellipsoid(`Eye_${x < 0 ? 'L' : 'R'}`, eyeMat, [x, 3.02, 0.69], [0.066, 0.11, 0.045], 24);
    const pupil = ellipsoid(`EyePupil_${x < 0 ? 'L' : 'R'}`, pupilMat, [x, 3.02, 0.73], [0.025, 0.074, 0.018], 20);
    g.add(eye, pupil);
  }
  const beak = finish(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.74, 24), gold), 'Golden_Beak');
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.89, 0.89);
  g.add(beak);

  const brim = cylinder('Gat_Brim', ink, 0.76, 0.82, 0.075, [0, 3.29, 0.13], 64);
  brim.scale.z = 0.86;
  const crown = cylinder('Gat_Crown', ink, 0.32, 0.44, 0.38, [0, 3.49, 0.08], 48);
  const ribbon = cylinder('Gat_Ribbon', blue, 0.45, 0.45, 0.07, [0, 3.36, 0.08], 52);
  g.add(brim, crown, ribbon);
  const ribbonTail = tube('Gat_RibbonTail', blue, [[0.35, 3.39, 0.23], [0.58, 3.53, 0.2], [0.48, 3.68, 0.12], [0.33, 3.57, 0.16]], 0.045, 42, 12);
  g.add(ribbonTail);

  const staffA = [-1.27, 0.58, 0.67];
  const staffB = [1.08, 2.34, 0.67];
  g.add(cylinderBetween('Soul_Staff', ink, staffA, staffB, 0.038, 24));
  for (let i = 0; i < 8; i++) {
    const plume = leaf(`Staff_Feather_${i}`, i % 2 ? robeLight : ink, 0.18 + (i % 3) * 0.03, 0.48 + (i % 2) * 0.15, 0.12);
    plume.position.set(-0.87 + Math.cos(i * 0.82) * 0.19, 0.82 + Math.sin(i * 0.82) * 0.16, 0.62 + i * 0.012);
    plume.rotation.z = -1.2 + i * 0.31;
    g.add(plume);
  }
  const soulCrystal = finish(new THREE.Mesh(new THREE.OctahedronGeometry(0.105, 1), wisp), 'Soul_Crystal');
  soulCrystal.position.set(-1.13, 1.15, 0.69);
  g.add(soulCrystal);
  g.add(tube('Soul_Wisp', wisp, [[-1.15, 1.18, 0.7], [-1.36, 1.42, 0.73], [-1.24, 1.67, 0.72], [-1.43, 1.88, 0.7]], 0.035, 54, 12));

  for (const side of [-1, 1]) {
    g.add(cylinderBetween(`Leg_${side}`, blue, [side * 0.18, 0.43, -0.02], [side * 0.2, 0.12, 0.06], 0.055, 18));
    const shoe = ellipsoid(`Curled_Shoe_${side}`, ink, [side * 0.23, 0.08, 0.2], [0.2, 0.09, 0.32], 30);
    shoe.rotation.y = side * 0.13;
    g.add(shoe);
  }
  g.add(tube('Ground_Wisp_L', wisp, [[-0.48, 0.2, -0.15], [-0.84, 0.08, 0], [-1.03, 0.27, 0.08]], 0.05, 46, 12));
  g.add(tube('Ground_Wisp_R', wisp, [[0.4, 0.17, -0.14], [0.76, 0.08, -0.02], [0.92, 0.24, 0.08]], 0.043, 42, 12));
  return g;
}

function buildBanderado() {
  const g = new THREE.Group();
  g.name = 'Banderado_HQ';
  g.userData = { pokemonKey: 'banderado', koreanName: '활빈다람', frontAxis: '+Z', quality: 'HQ' };
  const green = material('Banderado_LeafGreen', 0x77b84e, { roughness: 0.56 });
  const greenDark = material('Banderado_DeepGreen', 0x356b3d, { roughness: 0.64 });
  const greenLight = material('Banderado_LeafHighlight', 0xa5d466, { roughness: 0.52 });
  const brown = material('Banderado_FurBrown', 0x7a4e32, { roughness: 0.67 });
  const darkBrown = material('Banderado_DarkBrown', 0x3c2923, { roughness: 0.6 });
  const cream = material('Banderado_Cream', 0xf3ead6, { roughness: 0.72 });
  const blueGray = material('Banderado_BlueGray', 0xa9b5cf, { roughness: 0.55 });
  const eyeWhite = material('Banderado_EyeWhite', 0xfafafa, { roughness: 0.35 });
  const iris = material('Banderado_Iris', 0x8da0bd, { emissive: 0x1b2d46, emissiveIntensity: 0.25, roughness: 0.25 });
  const pupil = material('Banderado_Pupil', 0x21191b, { roughness: 0.25 });

  // Giant crescent squirrel tail. It sits behind the body (negative Z), so its
  // oversized silhouette is readable without hiding the face in battle.
  const tailPoints = [[0.18, 0.72, -0.48], [0.72, 1.18, -0.66], [1.08, 1.92, -0.72], [0.95, 2.78, -0.65], [0.38, 3.34, -0.52], [-0.22, 3.08, -0.38]];
  const tailRadius = t => 0.22 + Math.sin(Math.PI * Math.min(1, t * 1.08)) * 0.48 - Math.max(0, t - 0.86) * 0.55;
  const tail = taperedTube('Giant_Bushy_Tail', green, tailPoints, tailRadius, 120, 30);
  g.add(tail);
  const tailCurve = tail.userData.curve;
  for (const [i, t] of [0.24, 0.53, 0.77].entries()) {
    const center = tailCurve.getPointAt(t);
    const tangent = tailCurve.getTangentAt(t);
    g.add(torusBand(`Tail_Band_${i}`, darkBrown, center, tangent, tailRadius(t) * 0.97, 0.075, 1.02));
  }
  const tailTip = tailCurve.getPointAt(0.98);
  const tailTangent = tailCurve.getTangentAt(0.98);
  const ringDisc = cylinder('Tail_WoodRing', brown, 0.32, 0.32, 0.08, [tailTip.x, tailTip.y, tailTip.z], 42);
  ringDisc.quaternion.setFromUnitVectors(Y, tailTangent);
  g.add(ringDisc);
  const ring = finish(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 12, 42), darkBrown), 'Tail_GrowthRing');
  ring.position.copy(tailTip).add(tailTangent.clone().multiplyScalar(0.045));
  ring.quaternion.setFromUnitVectors(Z, tailTangent);
  g.add(ring);

  g.add(ellipsoid('Torso', greenDark, [0, 1.45, 0], [0.48, 0.72, 0.38]));
  g.add(ellipsoid('Chest_Cream', cream, [0, 1.42, 0.34], [0.29, 0.48, 0.12], 34));
  g.add(ellipsoid('Head', brown, [0, 2.25, 0.08], [0.46, 0.42, 0.4]));
  g.add(ellipsoid('Face_Mask', cream, [0, 2.27, 0.4], [0.39, 0.25, 0.12], 34));
  for (const x of [-0.18, 0.18]) addEye(g, x < 0 ? 'L' : 'R', x, 2.31, 0.51, eyeWhite, iris, pupil, 1);
  const nose = ellipsoid('Nose', darkBrown, [0, 2.14, 0.57], [0.07, 0.05, 0.045], 20);
  g.add(nose);
  const smileL = tube('Smile_L', darkBrown, [[-0.01, 2.1, 0.575], [-0.08, 2.05, 0.58], [-0.14, 2.08, 0.575]], 0.012, 24, 8);
  const smileR = smileL.clone(); smileR.name = 'Smile_R'; smileR.scale.x = -1;
  g.add(smileL, smileR);
  for (const side of [-1, 1]) {
    const ear = ellipsoid(`Ear_${side}`, darkBrown, [side * 0.4, 2.42, 0.03], [0.19, 0.14, 0.11], 28);
    ear.rotation.z = side * 0.25;
    g.add(ear);
  }

  const hatBrim = cylinder('Acorn_Hat_Brim', darkBrown, 0.59, 0.64, 0.1, [0, 2.57, 0.03], 54);
  hatBrim.scale.z = 0.75;
  const hatCrown = ellipsoid('Acorn_Hat_Crown', brown, [0, 2.75, 0], [0.43, 0.31, 0.37], 44);
  const stem = cylinder('Acorn_Hat_Stem', brown, 0.045, 0.06, 0.23, [0.05, 3.01, -0.01], 20);
  stem.rotation.z = -0.35;
  g.add(hatBrim, hatCrown, stem);
  for (let i = 0; i < 3; i++) {
    const plume = leaf(`Hat_Feather_${i}`, cream, 0.12, 0.46 - i * 0.05, 0.07);
    plume.position.set(-0.39 - i * 0.06, 2.79 + i * 0.07, 0.17 - i * 0.01);
    plume.rotation.z = -0.52 - i * 0.2;
    g.add(plume);
  }

  for (const side of [-1, 1]) {
    const bow = leaf(`Neck_Leaf_${side}`, greenLight, 0.19, 0.5, 0.1);
    bow.position.set(side * 0.17, 1.91, 0.42);
    bow.rotation.z = side * 0.93;
    g.add(bow);
    const arm = cylinderBetween(`Arm_${side}`, brown, [side * 0.32, 1.7, 0.04], [side * 0.55, 1.28, 0.28], 0.105, 24);
    const cuff = ellipsoid(`Leaf_Cuff_${side}`, greenLight, [side * 0.55, 1.25, 0.3], [0.22, 0.18, 0.15], 28);
    const fist = ellipsoid(`Acorn_Fist_${side}`, darkBrown, [side * 0.58, 1.13, 0.37], [0.2, 0.21, 0.18], 30);
    g.add(arm, cuff, fist);
    const blade = leaf(`Forearm_LeafBlade_${side}`, greenLight, 0.16, 0.57, 0.08);
    blade.position.set(side * 0.72, 1.37, 0.25);
    blade.rotation.z = side * -0.72;
    g.add(blade);

    const thigh = ellipsoid(`Leaf_Thigh_${side}`, green, [side * 0.27, 0.8, 0.02], [0.31, 0.5, 0.28], 36);
    const shin = cylinderBetween(`Shin_${side}`, blueGray, [side * 0.28, 0.62, 0.02], [side * 0.3, 0.22, 0.12], 0.11, 24);
    const foot = ellipsoid(`Foot_${side}`, darkBrown, [side * 0.31, 0.16, 0.23], [0.18, 0.12, 0.28], 28);
    g.add(thigh, shin, foot);
    const kneeLeaf = leaf(`Knee_Leaf_${side}`, greenLight, 0.13, 0.38, 0.07);
    kneeLeaf.position.set(side * 0.49, 0.77, 0.12);
    kneeLeaf.rotation.z = side * -0.75;
    g.add(kneeLeaf);
  }
  const cloak = leaf('Leaf_Cloak', green, 0.58, 1.16, 0.17);
  cloak.position.set(0, 1.38, -0.28);
  cloak.rotation.z = Math.PI;
  g.add(cloak);
  return g;
}

function buildPipetiger() {
  const g = new THREE.Group();
  g.name = 'Pipetiger_HQ';
  g.userData = { pokemonKey: 'pipetiger', koreanName: '염흥왕', frontAxis: '+Z', quality: 'HQ' };
  const orange = material('Pipetiger_BurntOrange', 0xe76522, { roughness: 0.68 });
  const orangeDark = material('Pipetiger_ShadowOrange', 0xb94318, { roughness: 0.7 });
  const charcoal = material('Pipetiger_Charcoal', 0x202125, { roughness: 0.58 });
  const cream = material('Pipetiger_Cream', 0xf4ead4, { roughness: 0.78 });
  const cyan = material('Pipetiger_CyanEye', 0x3ad9f0, { emissive: 0x087d9e, emissiveIntensity: 0.95, roughness: 0.18 });
  const white = material('Pipetiger_EyeWhite', 0xfaf8ed, { roughness: 0.32 });
  const pipeWood = material('Pipetiger_PipeWood', 0x3b281d, { roughness: 0.5 });
  const ember = material('Pipetiger_Ember', 0xff9a25, { emissive: 0xff4300, emissiveIntensity: 1.5, roughness: 0.25 });
  const smoke = material('Pipetiger_Smoke', 0xf3f5f4, { opacity: 0.43, emissive: 0xdde8ea, emissiveIntensity: 0.14, roughness: 0.9 });

  // Body runs along Z, with +Z as the battle-facing direction.
  g.add(ellipsoid('Powerful_Body', orange, [0, 1.08, -0.12], [0.76, 0.62, 1.2], 52));
  g.add(ellipsoid('Shoulder_Mass', orangeDark, [0, 1.28, 0.64], [0.73, 0.66, 0.72], 48));
  g.add(ellipsoid('Tiger_Head', orange, [0, 1.65, 1.05], [0.59, 0.54, 0.58], 48));
  g.add(ellipsoid('Muzzle', cream, [0, 1.48, 1.5], [0.37, 0.27, 0.24], 38));
  g.add(ellipsoid('Nose', charcoal, [0, 1.55, 1.72], [0.12, 0.08, 0.07], 26));
  for (const side of [-1, 1]) {
    const ear = finish(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.075, 16, 40, Math.PI * 1.7), charcoal), `Round_Ear_${side}`);
    ear.position.set(side * 0.44, 2.01, 0.92);
    ear.rotation.x = Math.PI / 2;
    ear.rotation.z = side * -0.2;
    g.add(ear);
    addEye(g, side < 0 ? 'L' : 'R', side * 0.23, 1.72, 1.54, white, cyan, charcoal, 1.12);
  }

  // White forehead blaze and layered mane are actual geometry, not a flat
  // texture, so the face stays iconic in profile and at small battle sizes.
  const blaze = leaf('Forehead_Blaze', cream, 0.31, 1.02, 0.09);
  blaze.position.set(0, 1.99, 1.47);
  blaze.rotation.z = Math.PI;
  g.add(blaze);
  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * Math.PI * 2;
    const mane = leaf(`Mane_Tuft_${i}`, cream, 0.19 + (i % 3) * 0.035, 0.56 + (i % 2) * 0.12, 0.13);
    mane.position.set(Math.cos(angle) * 0.54, 1.38 + Math.sin(angle) * 0.42, 0.83 + (Math.cos(angle) > 0 ? 0.03 : -0.08));
    mane.rotation.z = -angle - Math.PI / 2;
    g.add(mane);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const cheek = leaf(`Cheek_Tuft_${side}_${i}`, cream, 0.16, 0.47 - i * 0.05, 0.1);
      cheek.position.set(side * (0.38 + i * 0.08), 1.54 - i * 0.13, 1.36 - i * 0.03);
      cheek.rotation.z = side * (-1.05 + i * 0.22);
      g.add(cheek);
    }
  }

  // Four weighty legs and cream toes.
  const legSpecs = [
    [-0.5, 0.72, 0.62], [0.5, 0.72, 0.62], [-0.5, 0.7, -0.78], [0.5, 0.7, -0.78],
  ];
  legSpecs.forEach(([x, y, z], i) => {
    const leg = cylinder(`Leg_${i}`, i < 2 ? orangeDark : orange, 0.24, 0.29, 0.72, [x, y, z], 34);
    leg.scale.z = 0.9;
    const paw = ellipsoid(`Paw_${i}`, cream, [x, 0.25, z + 0.16], [0.34, 0.2, 0.43], 36);
    g.add(leg, paw);
    for (let toe = -1; toe <= 1; toe++) {
      g.add(ellipsoid(`Toe_${i}_${toe}`, cream, [x + toe * 0.095, 0.27, z + 0.49], [0.085, 0.08, 0.105], 22));
    }
    for (let stripe = 0; stripe < 2; stripe++) {
      const band = finish(new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.055, 12, 38), charcoal), `LegStripe_${i}_${stripe}`);
      band.position.set(x, 0.84 + stripe * 0.18, z);
      band.rotation.x = Math.PI / 2;
      band.scale.y = 0.9;
      g.add(band);
    }
  });

  // Raised curling charcoal stripes give the coat depth while avoiding a huge
  // baked texture. They are placed symmetrically on both flanks and shoulders.
  const stripeSets = [
    [[-0.67, 1.55, 0.54], [-0.72, 1.35, 0.38], [-0.69, 1.18, 0.22]],
    [[-0.74, 1.56, 0.05], [-0.79, 1.29, -0.02], [-0.73, 1.05, -0.12]],
    [[-0.65, 1.47, -0.47], [-0.73, 1.24, -0.56], [-0.64, 1.02, -0.63]],
    [[-0.48, 1.38, -0.93], [-0.53, 1.2, -1.02], [-0.42, 1.03, -1.04]],
  ];
  for (const [i, points] of stripeSets.entries()) {
    for (const side of [-1, 1]) {
      const mirrored = points.map(([x, y, z]) => [Math.abs(x) * side, y, z]);
      g.add(tube(`FlankStripe_${side}_${i}`, charcoal, mirrored, 0.055, 34, 10));
    }
  }
  for (const side of [-1, 1]) {
    const eyeStripe = leaf(`Eye_Stripe_${side}`, charcoal, 0.105, 0.42, 0.06);
    eyeStripe.position.set(side * 0.29, 1.77, 1.57);
    eyeStripe.rotation.z = side * -0.6;
    g.add(eyeStripe);
  }

  const tailPoints = [[0, 1.04, -1.06], [0.62, 1.05, -1.45], [1.04, 0.94, -1.72], [1.18, 1.18, -1.9], [1.05, 1.42, -1.78]];
  const tailRadius = t => 0.24 - 0.07 * t;
  const tail = taperedTube('Ringed_Tail', orange, tailPoints, tailRadius, 84, 24);
  g.add(tail);
  const tailCurve = tail.userData.curve;
  for (const [i, t] of [0.2, 0.42, 0.64, 0.84].entries()) {
    g.add(torusBand(`Tail_Stripe_${i}`, charcoal, tailCurve.getPointAt(t), tailCurve.getTangentAt(t), tailRadius(t) * 0.98, 0.052));
  }
  g.add(ellipsoid('Tail_DarkTip', charcoal, [1.05, 1.43, -1.78], [0.2, 0.25, 0.22], 30));

  // Long folk-tale smoking pipe held at the left side of the mouth.
  const pipeStart = [-0.12, 1.48, 1.69];
  const pipeEnd = [-1.28, 1.24, 1.86];
  g.add(cylinderBetween('Smoking_Pipe_Stem', pipeWood, pipeStart, pipeEnd, 0.045, 24));
  const bowl = cylinder('Smoking_Pipe_Bowl', pipeWood, 0.19, 0.15, 0.27, [-1.33, 1.27, 1.88], 32);
  bowl.rotation.z = -0.12;
  g.add(bowl);
  const coal = cylinder('Glowing_Ember', ember, 0.145, 0.145, 0.035, [-1.34, 1.42, 1.9], 28);
  g.add(coal);
  g.add(tube('Pipe_Smoke', smoke, [[-1.34, 1.46, 1.9], [-1.48, 1.76, 1.92], [-1.27, 2.02, 1.91], [-1.44, 2.3, 1.9], [-1.25, 2.55, 1.88]], 0.035, 72, 12));
  return g;
}

async function exportGlb(group, filename, profile) {
  const scene = new THREE.Scene();
  scene.name = `${group.name}_Scene`;
  scene.add(group);
  scene.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const animations = createBattleClips(group, profile);
  const glb = await exporter.parseAsync(scene, {
    binary: true,
    trs: false,
    onlyVisible: true,
    includeCustomExtensions: false,
    maxTextureSize: 2048,
    animations,
  });
  const bytes = Buffer.from(glb);
  await writeFile(resolve(OUT_DIR, filename), bytes);
  return bytes.byteLength;
}

await mkdir(OUT_DIR, { recursive: true });
const builds = [
  ['thanatoat.glb', buildThanatoat(), {
    idle: 'Gat_RibbonTail', head: 'Crane_Head', idleAmount: 0.075,
    attack: [['Soul_Staff', 'z', 0.52], ['WingSleeve_R', 'z', -0.24], ['WingSleeve_L', 'z', 0.18]],
    faint: [['WingSleeve_R', 'z', 0.26], ['WingSleeve_L', 'z', -0.26], ['Soul_Staff', 'z', -0.38]],
  }],
  ['banderado.glb', buildBanderado(), {
    idle: 'Giant_Bushy_Tail', head: 'Head', idleAmount: 0.085,
    attack: [['Giant_Bushy_Tail', 'y', 0.48], ['Arm_R', 'x', -0.7], ['Forearm_LeafBlade_R', 'z', -0.72]],
    faint: [['Giant_Bushy_Tail', 'z', -0.48], ['Acorn_Hat_Brim', 'x', 0.42], ['Arm_L', 'x', 0.38]],
  }],
  ['pipetiger.glb', buildPipetiger(), {
    idle: 'Ringed_Tail', head: 'Tiger_Head', idleAmount: 0.065,
    attack: [['Tiger_Head', 'x', -0.38], ['Smoking_Pipe_Stem', 'z', 0.34], ['Forehead_Blaze', 'x', -0.18]],
    faint: [['Ringed_Tail', 'z', -0.52], ['Smoking_Pipe_Stem', 'z', -0.42], ['Forehead_Blaze', 'x', 0.28]],
  }],
];
for (const [filename, model, profile] of builds) {
  const size = await exportGlb(model, filename, profile);
  console.log(`${filename}\t${(size / 1024 / 1024).toFixed(2)} MiB`);
}
