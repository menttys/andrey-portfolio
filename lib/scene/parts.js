/* Small physical parts the units are assembled from: materials, decals, screens and knobs. */
import * as THREE from 'three';
import { roundedPlane, slab as slabGeometry } from './geometry.js';

export function castsShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const flatMaterial = (color, roughness = 0.6, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, envMapIntensity: 0.55, ...extra });

/** a transparent printed layer lying just above a surface */
export function decal(parent, tex, w, h, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** flush display: thin dark gasket, emissive panel, faint glass sheen. Returns the panel mesh. */
export function mountScreen(parent, w, h, radius, x, y, z, tex) {
  const gasket = new THREE.Mesh(roundedPlane(w + 0.035, h + 0.035, radius + 0.018), flatMaterial(0x050506, 0.5, { envMapIntensity: 0.15 }));
  gasket.position.set(x, y, z + 0.002);
  gasket.receiveShadow = true;
  parent.add(gasket);

  const panel = new THREE.Mesh(roundedPlane(w, h, radius), new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false }));
  panel.position.set(x, y, z + 0.004);
  parent.add(panel);

  const glass = new THREE.Mesh(roundedPlane(w, h, radius), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.012, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6,
  }));
  glass.position.set(x, y, z + 0.006);
  parent.add(glass);

  return panel;
}

/** smooth machined knob: straight wall, soft shoulder, shallow dished top, pill indicator.
    `userData.cap` is the turning part, `userData.body` the surface the pointer hits. */
export function createKnob(r, h, o) {
  const group = new THREE.Group();

  if (o.ring) {
    const ring = castsShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.09, r * 1.11, 0.05, 72),
      flatMaterial(0x0e0f10, 0.7, { envMapIntensity: 0.2 }),
    ));
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.025;
    group.add(ring);
  }

  const P = (a, b) => new THREE.Vector2(a, b);
  const profile = [
    P(0, 0), P(r, 0), P(r, h - 0.045), P(r - 0.004, h - 0.028), P(r - 0.014, h - 0.013), P(r - 0.03, h - 0.004), P(r - 0.048, h),
    P(r - 0.064, h - 0.003), P(r * 0.62, h - 0.016), P(r * 0.3, h - 0.022), P(0, h - 0.024),
  ];
  const material = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: o.rough, clearcoat: o.coat, clearcoatRoughness: 0.25, envMapIntensity: o.env });

  const cap = new THREE.Group();
  group.add(cap);
  group.userData.cap = cap;

  const body = castsShadow(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), material));
  body.rotation.x = Math.PI / 2;
  cap.add(body);
  group.userData.body = body;

  const pill = new THREE.Mesh(roundedPlane(r * 0.13, r * 0.3, r * 0.065), new THREE.MeshBasicMaterial({ color: o.mark, toneMapped: false }));
  pill.position.set(0, r * 0.5, h - 0.012);
  const indicator = new THREE.Group();
  indicator.rotation.z = o.angle;
  indicator.add(pill);
  cap.add(indicator);

  return group;
}

/** A mixing-desk fader lying along x: a dark slot with a cap that slides `travel` along it. Turn the group for a
    vertical one. `userData.cap` is the sliding part; `userData.bodies` are the surfaces the pointer hits.
    `o`: cap `color`, `mark` (the line across it), `across` (the cap's size across the slot), `rough`, `coat`, `env`. */
export function createFader(travel, o) {
  const group = new THREE.Group();
  const along = 0.17, across = o.across, height = 0.1, bevel = 0.022, top = height + bevel * 2;

  const slot = new THREE.Mesh(roundedPlane(travel + along * 0.7, 0.05, 0.025), flatMaterial(0x08090a, 0.6, { envMapIntensity: 0.12 }));
  slot.position.z = 0.002;
  slot.receiveShadow = true;
  group.add(slot);

  const cap = new THREE.Group();
  group.add(cap);
  const material = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: o.rough, clearcoat: o.coat, clearcoatRoughness: 0.25, envMapIntensity: o.env });
  const body = castsShadow(new THREE.Mesh(slabGeometry(along, across, 0.035, height, bevel), material));
  body.position.z = top / 2 + 0.003;
  cap.add(body);
  // the printed line that reads the position
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.022, across * 0.72), new THREE.MeshBasicMaterial({ color: o.mark, toneMapped: false }));
  line.position.z = top + 0.005;
  cap.add(line);

  // a wider, unseen strip over the slot, so a pointer between the cap and the slot's end still lands on the fader
  const reach = new THREE.Mesh(new THREE.PlaneGeometry(travel + along, across), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  reach.position.z = 0.003;
  group.add(reach);

  group.userData.cap = cap;
  group.userData.travel = travel;
  group.userData.bodies = [body, reach];
  return group;
}
