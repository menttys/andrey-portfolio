/* The "open to work" status unit in the intro row.
   Same build as the grey unit at a fraction of the size: tan rim, cast concrete body, a flush screen and a status
   light instead of knobs, so nothing on it reads as a control. Its own small renderer, camera and paper shadow; the
   same key light, tilt and slow float. The grey unit's brightness knob dims its screen with the big one. */
import * as THREE from 'three';
import { slab } from './geometry.js';
import { canvasTexture } from './textures.js';
import { castsShadow, flatMaterial, mountScreen } from './parts.js';
import { paperShadow } from './paperShadow.js';
import { createLitRenderer, roomEnvironment, createKeyLight } from './stage.js';
import { PAPER_Z } from './pose.js';
import { budget } from './budget.js';
import { darkPanel, setLetterSpacing, LIME, MONO } from './draw.js';

const WIDTH = 3.3, HEIGHT = 1.12, FRONT = 0.178;
const SCREEN_W = 2.36, SCREEN_H = 0.66;
const LIGHT_X = 1.2;
const TIP = THREE.MathUtils.degToRad(-10);
const TILT = THREE.MathUtils.degToRad(-12);
const TAU = Math.PI * 2;

// OPEN TO WORK in the lime of the green unit's DETECTING SIGNAL, with a blinking block cursor
function createScreenText() {
  const tex = canvasTexture(1416, 396, budget.screenScale);
  let cursorOn = true;
  function draw() {
    const g = tex.ctx, w = 1416, h = 396;
    darkPanel(g, w, h);
    g.font = `700 150px ${MONO}`;
    g.textBaseline = 'alphabetic';
    setLetterSpacing(g, '4px');
    const m = g.measureText('OPEN TO WORK');
    const cap = m.actualBoundingBoxAscent || 110, baseline = h / 2 + cap / 2;
    g.fillStyle = LIME;
    g.fillText('OPEN TO WORK', 84, baseline);
    setLetterSpacing(g, '0px');
    if (cursorOn) g.fillRect(84 + m.width + 26, baseline - cap, 70, cap);
    tex.texture.needsUpdate = true;
  }
  draw();
  return { tex, setCursor(on) { if (on !== cursorOn) { cursorOn = on; draw(); } } };
}

// a lime lens in a dark seat, with a soft halo
function createStatusLight(group) {
  const seat = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), flatMaterial(0x050506, 0.5, { envMapIntensity: 0.15 }));
  seat.position.set(LIGHT_X, 0, FRONT + 0.002);
  group.add(seat);

  const lensMaterial = new THREE.MeshPhysicalMaterial({ color: 0x2a3008, emissive: new THREE.Color(LIME), emissiveIntensity: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), lensMaterial);
  lens.scale.z = 0.4;
  lens.position.set(LIGHT_X, 0, FRONT + 0.004);
  group.add(lens);

  const haloTex = canvasTexture(128, 128);
  const gradient = haloTex.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(214,226,74,0.55)');
  gradient.addColorStop(0.35, 'rgba(214,226,74,0.18)');
  gradient.addColorStop(1, 'rgba(214,226,74,0)');
  haloTex.ctx.fillStyle = gradient;
  haloTex.ctx.fillRect(0, 0, 128, 128);
  haloTex.texture.needsUpdate = true;
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: haloTex.texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  halo.position.set(LIGHT_X, 0, FRONT + 0.05);
  group.add(halo);

  return { lensMaterial, halo };
}

/** Returns `{ setBright(v) }`, or null when the page has no #otw canvas. */
export function createOpenToWork({ lifecycle, reduce, rimMaterial, concrete }) {
  const canvas = document.getElementById('otw');
  if (!canvas) return null;

  const renderer = createLitRenderer(canvas, lifecycle);
  lifecycle.onContextLost(renderer, () => { canvas.style.visibility = 'hidden'; });
  const scene = new THREE.Scene();
  scene.environment = roomEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(11, 1, 0.1, 400);
  scene.add(createKeyLight({ ...budget.smallShadow, halfWidth: 3, halfHeight: 2 }));

  const group = new THREE.Group();
  scene.add(group);
  const rim = castsShadow(new THREE.Mesh(slab(WIDTH, HEIGHT, 0.4, 0.26, 0.03), rimMaterial));
  rim.position.z = -0.1;
  group.add(rim);
  group.add(castsShadow(new THREE.Mesh(slab(WIDTH - 0.12, HEIGHT - 0.12, 0.36, 0.3, 0.028), concrete)));

  const text = createScreenText();
  const screen = mountScreen(group, SCREEN_W, SCREEN_H, 0.22, -0.32, 0, FRONT, text.tex);
  const light = createStatusLight(group);
  let brightness = 1;

  // pose: the hero's tilt, resting on the paper, with the same paper shadow
  group.rotation.set(TIP, TILT, 0, 'YXZ');
  group.updateMatrixWorld(true);
  const back = new THREE.Box3().setFromObject(rim);
  const rest = new THREE.Vector3(-(back.min.x + back.max.x) / 2, -(back.min.y + back.max.y) / 2, PAPER_Z - back.min.z);
  const shadow = paperShadow(
    scene, 0, WIDTH * Math.cos(TILT), HEIGHT * Math.cos(TIP), 0.4,
    WIDTH * Math.sin(Math.abs(TILT)), TILT < 0 ? 1 : -1, HEIGHT * Math.sin(Math.abs(TIP)), 0.42,
  );
  const uniforms = shadow.material.uniforms;

  // the canvas runs past the unit's box on every side as room for the shadow and the float
  let width = 0, height = 0;
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const box = canvas.parentElement, unitsPerPx = WIDTH / box.clientWidth, visibleHeight = h * unitsPerPx;
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const ox = (w / 2 - (-canvas.offsetLeft + box.clientWidth / 2)) * unitsPerPx;
    const oy = -(h / 2 - (-canvas.offsetTop + box.clientHeight / 2)) * unitsPerPx;
    camera.position.set(ox, oy - distance * 0.02, distance);
    camera.lookAt(ox, oy - 0.02, 0);
    camera.updateProjectionMatrix();
  }

  const startTime = performance.now();
  let raf = 0;
  function render(now) {
    raf = 0;
    fit();
    const t = (now - startTime) / 1000, still = reduce.matches;

    // a slow float and rock, with the shadow fed the same height and tilt
    const rx = still ? 0 : 0.003 * Math.sin(TAU * t / 9.7 + 0.4);
    const ry = still ? 0 : 0.0024 * Math.sin(TAU * t / 12.3 + 1.1);
    const hover = (still ? 0 : 0.024 * 0.5 * (1 - Math.cos(TAU * t / 6.9 + 1.3))) + Math.abs(rx) * HEIGHT / 2 + Math.abs(ry) * WIDTH / 2;
    group.rotation.set(TIP + rx, TILT + ry, 0, 'YXZ');
    group.position.set(rest.x, rest.y, rest.z + hover);
    uniforms.hov.value = hover;
    uniforms.lift.value = WIDTH * Math.sin(Math.abs(TILT + ry));
    uniforms.liftY.value = HEIGHT * Math.sin(Math.abs(TIP + rx));

    // the status light breathes slowly, like a standby lamp; the cursor blinks
    const breath = still ? 1 : 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(TAU * t / 2.6));
    light.lensMaterial.emissiveIntensity = breath * brightness;
    light.halo.material.opacity = breath * Math.min(1, brightness);
    text.setCursor(still || Math.floor(t / 0.55) % 2 === 0);

    renderer.render(scene, camera);
    if (!still) raf = lifecycle.requestFrame(render);
  }
  function wake() { if (!raf) raf = lifecycle.requestFrame(render); }

  lifecycle.on(reduce, 'change', wake);
  lifecycle.observeResize(canvas, wake);
  wake();

  return {
    setBright(v) {
      brightness = v;
      screen.material.color.setScalar(v);
      wake();
    },
  };
}
