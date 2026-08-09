import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getModel, hasModel, modelLoadStatus, primeManifest } from './engine3d/GlbModels';
import { MoveFX3D } from './engine3d/MoveFX3D';

declare global {
  interface Window {
    __modelQa?: { ready: boolean; errors: string[]; deferred2D: string[]; models: Array<{ key: string; meshes: number; triangles: number; authoredMaps: number; clips: string[] }> };
  }
}

const qa: NonNullable<Window['__modelQa']> = window.__modelQa = { ready: false, errors: [], deferred2D: [], models: [] };
const scene = new THREE.Scene();
const fxRoot = new THREE.Group();
const moveFx = new MoveFX3D(fxRoot);
scene.add(fxRoot);
scene.background = new THREE.Color(0x08111b);
scene.fog = new THREE.Fog(0x08111b, 9, 14);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 2.15, 8.2);
camera.lookAt(0, 1.35, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
document.body.prepend(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.environmentIntensity = 0.3;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xbbe8ff, 0x151921, 0.8));
const keyLight = new THREE.DirectionalLight(0xffefd6, 1.65);
keyLight.position.set(-3.5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);
const rim = new THREE.DirectionalLight(0x5aa8ff, 1.05);
rim.position.set(4, 3.5, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6.8, 96),
  new THREE.MeshStandardMaterial({ color: 0x142433, roughness: 0.82, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.8, 64),
    new THREE.MeshBasicMaterial({ color: [0x5fd9ff, 0x79e06a, 0xff874f][i], transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set((i - 1) * 2.65, 0.012, 0);
  scene.add(ring);
}

const mixers: THREE.AnimationMixer[] = [];
const actors: THREE.Object3D[] = [];
const animationSets: Array<{ mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; current?: THREE.AnimationAction }> = [];
const texturedQa = new URLSearchParams(location.search).has('textured');
const specs = texturedQa
  ? [
      { key: 'yeomtaeja', x: -2.65 },
      { key: 'camerghoost', x: 0 },
      { key: 'snoqueen', x: 2.65 },
    ]
  : [
      { key: 'thanatoat', x: -2.65 },
      { key: 'banderado', x: 0 },
      { key: 'pipetiger', x: 2.65 },
    ];

function normalize(model: THREE.Object3D, x: number): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(2.65 / size.y);
  model.updateMatrixWorld(true);
  const normalized = new THREE.Box3().setFromObject(model);
  const center = normalized.getCenter(new THREE.Vector3());
  model.position.set(x - center.x, -normalized.min.y, -center.z);
  model.updateMatrixWorld(true);
}

async function waitFor(predicate: () => boolean, timeoutMs = 90_000): Promise<void> {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeoutMs) throw new Error('model loader timeout');
    await new Promise(resolve => setTimeout(resolve, 80));
  }
}

primeManifest();

await Promise.all(specs.map(async (spec) => {
  try {
    await waitFor(() => hasModel(spec.key) || modelLoadStatus(spec.key) === 'failed');
    const immediate = getModel(spec.key);
    if (immediate === null && modelLoadStatus(spec.key) === 'loading') qa.deferred2D.push(spec.key);
    await waitFor(() => ['ready', 'failed'].includes(modelLoadStatus(spec.key)));
    if (modelLoadStatus(spec.key) !== 'ready') throw new Error('game registry rejected local GLB');
    const loaded = getModel(spec.key);
    if (!loaded) throw new Error('game registry returned no model after ready');
    const actor = loaded.group;
    normalize(actor, spec.x);
    let meshes = 0;
    let triangles = 0;
    let authoredMaps = 0;
    actor.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      const indexCount = mesh.geometry.index?.count;
      const vertexCount = mesh.geometry.getAttribute('position')?.count ?? 0;
      triangles += Math.floor((indexCount ?? vertexCount) / 3);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(material => material?.userData.pkAuthoredBaseColorMap)) authoredMaps++;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    scene.add(actor);
    actors.push(actor);
    const mixer = new THREE.AnimationMixer(actor);
    mixers.push(mixer);
    const idle = loaded.animations.find(clip => /idle|breath/i.test(clip.name));
    const animationSet = { mixer, clips: loaded.animations, current: idle ? mixer.clipAction(idle) : undefined };
    animationSet.current?.play();
    animationSets.push(animationSet);
    qa.models.push({ key: spec.key, meshes, triangles, authoredMaps, clips: loaded.animations.map(clip => clip.name) });
  } catch (error) {
    qa.errors.push(`${spec.key}: ${String(error)}`);
  }
}));

qa.models.sort((a, b) => specs.findIndex(s => s.key === a.key) - specs.findIndex(s => s.key === b.key));
qa.ready = true;
const status = document.querySelector('#status');
const totalTriangles = () => qa.models.reduce((sum, model) => sum + model.triangles, 0);
const totalClips = () => qa.models.reduce((sum, model) => sum + model.clips.length, 0);
if (status) status.textContent = qa.errors.length
  ? `오류 ${qa.errors.length}건 · ${qa.errors.join(' / ')}`
  : texturedQa
    ? `${qa.models.length}/3 Higgsfield 로컬 모델 정상 · 원본 색상 맵 ${qa.models.reduce((sum, model) => sum + model.authoredMaps, 0)}개 보존`
    : `${qa.models.length}/3 게임 로더 정상 · 2D 대기 ${qa.deferred2D.length}/3 · ${(totalTriangles() / 1_000_000).toFixed(2)}M triangles · PBR 색상 맵 ${qa.models.reduce((sum, model) => sum + model.authoredMaps, 0)}개 · 내장 클립 ${totalClips()}개`;

let activeClip = 0;
setInterval(() => {
  activeClip = (activeClip + 1) % 4;
  animationSets.forEach(set => {
    const nextClip = set.clips[activeClip];
    if (!nextClip) return;
    set.current?.fadeOut(0.12);
    const next = set.mixer.clipAction(nextClip).reset();
    next.setLoop(activeClip === 0 ? THREE.LoopRepeat : THREE.LoopOnce, activeClip === 0 ? Infinity : 1);
    next.clampWhenFinished = activeClip !== 0;
    next.fadeIn(0.12).play();
    set.current = next;
  });
  if (status && !qa.errors.length && !texturedQa) {
    const clip = qa.models.find(model => model.clips[activeClip])?.clips[activeClip];
    status.textContent = `${qa.models.length}/3 게임 로더 정상 · 2D 대기 ${qa.deferred2D.length}/3 · ${(totalTriangles() / 1_000_000).toFixed(2)}M triangles · PBR 색상 맵 ${qa.models.reduce((sum, model) => sum + model.authoredMaps, 0)}개 · ${clip ? `${clip} 재생 중` : '런타임 절차 애니메이션 대상'}`;
  }
  if (activeClip === 1) {
    moveFx.playSpecial(new THREE.Vector3(-2.65, 1.35, 0.35), new THREE.Vector3(-1.55, 0.48, 0.75), 'ghost', 'Soul-Ferry Deluge', 0x8266db, 105, 1);
    moveFx.physicalImpact(new THREE.Vector3(0, 0.22, 0.75), 'grass', 'Outlaw Leafstorm', 0x64bb45, 105, 1);
    moveFx.playSpecial(new THREE.Vector3(2.65, 1.25, 0.45), new THREE.Vector3(1.55, 0.58, 0.8), 'fire', 'Royal Kiln Roar', 0xff652f, 110, 1);
  }
}, 2200);

const clock = new THREE.Clock();
let elapsed = 0;
function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  mixers.forEach(mixer => mixer.update(dt));
  moveFx.update(dt);
  actors.forEach((actor, i) => { actor.rotation.y = Math.sin(elapsed * 0.24 + i * 0.8) * 0.14; });
  renderer.render(scene, camera);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
