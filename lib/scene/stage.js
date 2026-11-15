/* The hero's renderer, scene, camera and key light, plus the pieces the small status unit shares with it. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { budget } from './budget.js';

export const KEY_POSITION = new THREE.Vector3(-1.6, 6.5, 11);

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, budget.maxPixelRatio);

/** a renderer set up for the lit, shadow-casting devices */
export function createLitRenderer(canvas, lifecycle, extra = {}) {
  const renderer = lifecycle.track(new THREE.WebGLRenderer({ canvas, antialias: budget.antialias, alpha: true, ...extra }));
  renderer.setPixelRatio(pixelRatio());
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  return renderer;
}

/** the soft studio reflections every material picks up */
export function roomEnvironment(renderer) {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = generator.fromScene(room, 0.04).texture;
  // the generator's own render targets and the room's meshes are only needed to bake the texture
  generator.dispose();
  room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return texture;
}

// a big soft key from the upper left: short shadows on the faces, a broad soft one on the paper
export function createKeyLight({ mapSize, radius, halfWidth, halfHeight }) {
  const light = new THREE.DirectionalLight(0xffffff, 1.55);
  light.position.copy(KEY_POSITION);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.radius = radius;
  light.shadow.bias = -0.0005;
  Object.assign(light.shadow.camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight, near: 1, far: 40 });
  return light;
}

export function createStage(canvas, lifecycle) {
  const renderer = createLitRenderer(canvas, lifecycle);
  const scene = new THREE.Scene();
  scene.environment = roomEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(11, 1, 0.1, 400);
  const key = createKeyLight({ ...budget.mainShadow, halfWidth: 7, halfHeight: 5 });
  scene.add(key);
  return { renderer, scene, camera, key };
}
