import * as THREE from 'three';

export interface FieldItemModel3D {
  group: THREE.Group;
  setRare(rare: boolean): void;
  update(time: number): void;
}

function material(color: number, emissive = 0, opacity = 1): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    emissive,
    emissiveIntensity: emissive ? .65 : 0,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

/** A production-style overworld pickup: Poké Ball capsule, coloured rarity
 * halo and vertical locator beam. It is generated procedurally, so every field
 * item remains lightweight and available offline. */
export function buildFieldItem3D(color = 0xff6f6f, rare = false): FieldItemModel3D {
  const group = new THREE.Group();
  group.name = 'field-item-pickup';

  const pickup = new THREE.Group();
  pickup.position.y = .42;
  group.add(pickup);

  const radius = rare ? .25 : .21;
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    material(rare ? color : 0xe74350, rare ? color : 0x551019),
  );
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    material(0xf5f7fb, 0x222838),
  );
  pickup.add(top, bottom);

  const band = new THREE.Mesh(new THREE.TorusGeometry(radius * .95, .025, 6, 24), material(0x202532));
  band.rotation.x = Math.PI / 2;
  pickup.add(band);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .035, 14), material(0xffffff, 0x7395bb));
  button.rotation.x = Math.PI / 2;
  button.position.z = radius;
  pickup.add(button);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(rare ? .42 : .33, .018, 6, 36),
    material(color, color, rare ? .82 : .54),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = .05;
  group.add(halo);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.035, .12, rare ? 1.25 : .75, 10, 1, true),
    material(color, color, rare ? .25 : .12),
  );
  beam.position.y = rare ? .7 : .42;
  group.add(beam);

  const sparkles = Array.from({ length: rare ? 6 : 3 }, (_, index) => {
    const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(rare ? .045 : .03, 0), material(0xffffff, color));
    const angle = Math.PI * 2 * index / (rare ? 6 : 3);
    sparkle.position.set(Math.cos(angle) * .38, .45 + (index % 2) * .25, Math.sin(angle) * .38);
    group.add(sparkle);
    return sparkle;
  });

  let rarity = rare;
  const setRare = (next: boolean) => {
    rarity = next;
    beam.visible = next || beam.material.opacity > 0;
  };
  const update = (time: number) => {
    pickup.position.y = .42 + Math.sin(time * 2.5) * (rarity ? .08 : .055);
    pickup.rotation.y = time * (rarity ? 1.25 : .85);
    halo.rotation.z = time * .9;
    const pulse = 1 + Math.sin(time * 3.2) * (rarity ? .13 : .07);
    halo.scale.setScalar(pulse);
    beam.scale.x = beam.scale.z = 1 + Math.sin(time * 2.2) * .12;
    sparkles.forEach((sparkle, index) => {
      sparkle.rotation.y = time * 2 + index;
      sparkle.position.y += Math.sin(time * 2.8 + index) * .0015;
    });
  };

  return { group, setRare, update };
}

