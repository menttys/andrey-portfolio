/* The grey unit (left): concrete body, section readout, a satin control plate and two knobs.
   The first knob selects the page section; the second is a brightness dial for the screens. */
import * as THREE from 'three';
import { slab, fitUV } from './geometry.js';
import { castMaterial, canvasTexture, seededRandom } from './textures.js';
import { budget } from './budget.js';
import { castsShadow, flatMaterial, decal, mountScreen, createKnob } from './parts.js';
import { SECTION_NAMES } from './sections.js';
import { fitText, monoText, hatch, darkPanel, DISPLAY, ORANGE, GREY, PALE } from './draw.js';

const FRONT = 0.2;
const PLATE_TOP = FRONT + 0.066;
const PLATE_Y = -0.69;
export const SECTION_ORANGE = '#E0683C';   // the orange the screen used for SYSTEM LOADING

const SCREEN_W = 1680, SCREEN_H = 795;   // 2.8 x 1.325 units

// satin control plate (full pill), with faint brushed smudges
export function createPlateMaterial() {
  const tex = canvasTexture(1024, 512, budget.screenScale);
  const g = tex.ctx, random = seededRandom(31);
  g.fillStyle = '#C3C4C6';
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 90; i++) {
    const x = random() * 1024, w = 60 + random() * 160, alpha = 0.008 + random() * 0.016;
    const gradient = g.createLinearGradient(x, 0, x + w, 0);
    const col = random() > 0.55 ? '0,0,0' : '255,255,255';
    gradient.addColorStop(0, `rgba(${col},0)`);
    gradient.addColorStop(0.5, `rgba(${col},${alpha})`);
    gradient.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gradient;
    g.fillRect(x, random() * 200, w, 200 + random() * 312);
  }
  tex.texture.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: tex.texture, roughness: 0.42, metalness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.6 });
}

// engraved arcs, the section scale and the wordmark, printed on the plate
function createPlateInk(selection) {
  const tex = canvasTexture(1668, 480, budget.screenScale);   // 2.78 x 0.8 at 600 px/unit
  const g = tex.ctx, s = 600, cx = 834, cy = 240;

  g.strokeStyle = 'rgba(70,74,82,0.75)';
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  g.beginPath(); g.arc(cx + 1.0 * s, cy, 0.4 * s, Math.PI - 0.72, Math.PI + 0.72); g.stroke();

  // the section selector's scale: one printed tick per page section, on a thin arc, in the same ink as the wordmark.
  // Cap angle t points the pill along (-sin t, cos t) on the plate, which is (-sin t, -cos t) on this canvas.
  const kx = cx - 1.0 * s;
  const canvasAngle = (t) => Math.atan2(-Math.cos(t), -Math.sin(t));
  const last = selection.a0 - selection.step * (selection.n - 1);
  g.lineWidth = 2;
  g.beginPath(); g.arc(kx, cy, 0.285 * s, canvasAngle(selection.a0), canvasAngle(last), true); g.stroke();

  g.lineWidth = 3.4;
  g.lineCap = 'butt';
  for (let i = 0; i < selection.n; i++) {
    const t = selection.a0 - i * selection.step;
    const dx = -Math.sin(t), dy = -Math.cos(t);
    const outer = i === 0 || i === selection.n - 1 ? 0.33 : 0.318;
    g.beginPath();
    g.moveTo(kx + dx * 0.285 * s, cy + dy * 0.285 * s);
    g.lineTo(kx + dx * outer * s, cy + dy * outer * s);
    g.stroke();
  }

  fitText(g, 'ANDREY', cx - 150, cy + 15, 300, 30, DISPLAY, 500, 'rgba(58,62,70,0.9)', 10);
  tex.texture.needsUpdate = true;
  return tex;
}

/** the violin icon, traced from the reference artwork: closed outlines on a 100-unit grid centred on (0, 0), filled even-odd */
const VIOLIN_PATHS = [[[-5.3,12.2],[-6.3,12.3],[-7.2,12.9],[-7.4,14.1],[-6.3,15.8],[-6.3,16.7],[-11.2,22.5],[-12.3,25.0],[-12.4,26.7],[-11.8,28.5],[-10.8,29.6],[-9.4,30.3],[-7.3,30.1],[-6.4,29.2],[-6.7,27.6],[-8.6,26.8],[-9.1,26.3],[-9.1,25.5],[-7.4,23.0],[-4.1,19.4],[-2.9,16.8],[-2.8,15.0],[-3.4,13.5],[-4.1,12.8]],[[-18.6,11.2],[-19.3,12.1],[-19.4,13.1],[-17.6,15.5],[-13.6,19.3],[-12.4,19.6],[-11.3,19.2],[-10.7,18.0],[-11.2,16.4],[-16.5,11.3],[-17.4,10.8]],[[-12.4,5.1],[-13.4,3.7],[-14.2,3.3],[-17.3,3.3],[-19.3,4.4],[-23.2,7.8],[-25.2,9.1],[-26.1,9.1],[-27.6,6.7],[-28.9,6.8],[-29.8,7.9],[-29.8,9.6],[-29.0,11.1],[-28.0,11.9],[-26.5,12.4],[-24.4,12.3],[-22.1,11.1],[-16.4,6.5],[-14.2,7.7],[-13.1,7.4],[-12.4,6.5]],[[47.0,-48.2],[44.0,-49.7],[40.9,-49.8],[38.2,-48.6],[35.9,-45.8],[35.2,-45.9],[32.8,-48.0],[31.3,-48.1],[30.7,-47.9],[29.9,-47.0],[29.8,-45.8],[30.3,-44.7],[32.3,-42.6],[32.3,-41.8],[31.7,-41.1],[30.6,-40.8],[27.3,-43.1],[26.1,-43.1],[25.2,-42.4],[24.9,-41.7],[25.0,-40.4],[27.2,-37.6],[26.1,-34.1],[13.5,-22.0],[12.1,-21.7],[8.7,-23.7],[3.2,-25.5],[-1.9,-25.5],[-5.6,-24.5],[-8.8,-22.7],[-10.9,-20.7],[-14.1,-15.8],[-15.4,-14.5],[-18.6,-13.0],[-19.4,-12.3],[-19.6,-10.1],[-17.8,-7.5],[-17.5,-6.3],[-18.3,-4.5],[-20.5,-2.2],[-23.1,-0.8],[-25.8,-0.3],[-27.2,-0.8],[-30.0,-3.3],[-31.6,-3.2],[-32.6,-2.5],[-34.3,0.3],[-35.4,1.4],[-40.6,3.9],[-44.2,6.6],[-47.0,10.0],[-48.9,14.1],[-49.7,18.4],[-49.4,23.4],[-47.9,28.4],[-46.0,32.1],[-43.1,36.4],[-38.4,41.5],[-33.8,45.3],[-29.9,47.6],[-25.3,49.5],[-21.4,50.3],[-16.5,50.2],[-12.8,49.2],[-9.5,47.5],[-6.0,44.6],[-3.7,41.4],[-1.2,36.1],[3.3,32.7],[3.3,30.5],[1.2,28.2],[0.5,26.3],[0.9,23.5],[2.7,20.5],[4.2,19.0],[6.1,18.1],[8.0,18.5],[10.0,20.1],[12.1,20.0],[13.3,18.7],[14.6,15.7],[20.9,11.1],[22.8,8.9],[24.4,6.3],[25.5,2.8],[25.5,-2.7],[24.4,-7.3],[21.8,-12.0],[21.9,-13.3],[34.5,-26.2],[38.1,-27.4],[41.0,-25.1],[42.0,-25.0],[43.1,-25.4],[43.8,-27.1],[43.4,-28.3],[41.3,-30.7],[41.3,-31.4],[42.0,-32.3],[42.9,-32.4],[46.1,-29.8],[47.4,-29.9],[48.4,-30.7],[48.6,-32.5],[46.3,-35.7],[49.2,-38.7],[50.0,-40.4],[50.1,-43.0],[49.3,-45.4]],[[-25.8,23.5],[-23.1,26.1],[-22.8,27.0],[-29.7,31.4],[-35.5,37.1],[-36.1,37.2],[-36.4,37.0],[-36.2,36.1],[-31.0,30.6],[-26.5,23.4]],[[7.0,-19.7],[8.7,-18.6],[8.8,-17.7],[-8.9,-0.9],[-9.6,0.5],[-9.4,1.9],[-2.5,8.9],[-1.4,9.6],[-0.1,9.6],[2.8,7.0],[15.4,-6.4],[18.2,-8.9],[19.1,-8.2],[19.7,-7.1],[21.3,-1.8],[21.2,2.1],[20.1,5.2],[17.5,8.2],[12.9,11.3],[10.2,14.0],[9.3,14.2],[6.1,13.6],[4.0,14.1],[1.5,15.7],[-0.6,17.8],[-2.8,21.3],[-3.6,24.5],[-3.7,27.1],[-2.5,30.5],[-2.5,31.2],[-5.2,34.3],[-7.6,39.5],[-8.7,41.1],[-11.3,43.6],[-13.8,45.1],[-17.9,46.1],[-23.2,45.7],[-27.8,43.9],[-31.6,41.5],[-32.2,40.8],[-32.1,39.9],[-26.6,34.3],[-18.1,29.4],[-17.0,27.7],[-17.4,26.1],[-24.5,18.8],[-26.0,17.6],[-27.5,17.5],[-29.4,19.1],[-32.9,25.8],[-34.7,28.3],[-39.2,32.8],[-40.0,33.0],[-40.9,32.1],[-43.0,28.8],[-45.1,22.8],[-45.2,16.8],[-43.7,12.9],[-42.0,10.4],[-39.7,8.4],[-33.2,5.2],[-30.3,2.7],[-26.4,3.9],[-23.9,3.9],[-20.5,2.8],[-17.3,0.8],[-14.7,-1.9],[-13.5,-4.3],[-13.2,-6.9],[-13.8,-9.3],[-13.6,-10.3],[-11.5,-12.1],[-8.3,-17.0],[-5.4,-19.8],[-2.8,-21.0],[1.0,-21.4],[4.6,-20.7]],[[29.7,-30.2],[30.5,-29.2],[29.9,-27.8],[1.2,2.5],[-0.8,4.1],[-2.5,2.9],[-4.0,1.3],[-3.9,0.3],[28.9,-30.4]],[[43.9,-45.1],[45.6,-43.1],[45.8,-41.8],[45.4,-40.9],[41.3,-37.9],[35.8,-31.7],[34.6,-31.7],[32.0,-34.3],[31.9,-35.6],[38.4,-41.1],[41.2,-45.2],[42.9,-45.5]]];
const VIOLIN_NECK_HOLE = 6;   // the inner hole of the fingerboard outline: left out so the neck prints solid
function violinIcon(g, x, y, size, color) {
  const k = size / 100;
  g.save();
  g.translate(x, y);
  g.rotate(-Math.PI / 4);   // the artwork leans 45 degrees; stand it upright with the scroll on top
  g.fillStyle = color;
  g.beginPath();
  VIOLIN_PATHS.forEach((path, n) => {
    if (n === VIOLIN_NECK_HOLE) return;
    path.forEach(([px, py], i) => (i ? g.lineTo(px * k, py * k) : g.moveTo(px * k, py * k)));
    g.closePath();
  });
  g.fill('evenodd');
  g.restore();
}

/** the tan rim and the cast concrete: the grey unit's, and the small open-to-work unit's too */
export function createGreyCast() {
  return {
    rimMaterial: flatMaterial(0xD9A77C, 0.55, { clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.35 }),
    concrete: castMaterial('#B4B4B3', 5, { cloud: 0.05, pore: 0.035, chips: 260, chipSize: 3.6, chipColor: 'rgba(22,22,22,0.92)', chipBump: '#303030', bump: 0.006, rough: 0.8, env: 0.45 }),
  };
}

/** `onSelectStep(delta)` moves the section selector; `onBrightness(value)` is told when the dial changes */
export function createGreyUnit({ selection, onSelectStep, onBrightness }) {
  const group = new THREE.Group();

  const { rimMaterial, concrete } = createGreyCast();
  const rim = castsShadow(new THREE.Mesh(slab(3.05, 2.5, 0.5, 0.3, 0.035), rimMaterial));
  rim.position.z = -0.1;
  group.add(rim);

  group.add(castsShadow(new THREE.Mesh(slab(2.92, 2.38, 0.45, 0.34, 0.03), concrete)));

  /* ---------- screen: the big section number, its name and the PORTFOLIO mark ---------- */
  const screenTex = canvasTexture(SCREEN_W, SCREEN_H, budget.screenScale);
  let sectionNumber = 1;

  function drawScreen() {
    const g = screenTex.ctx, u = SCREEN_W / 1120;   // u: reference pixels -> canvas pixels
    darkPanel(g, SCREEN_W, SCREEN_H);
    hatch(g, 82 * u, 126 * u, 21, 24 * u, 36 * u, PALE, 3.2 * u);
    fitText(g, 'PORTFOLIO', 686 * u, 120 * u, 370 * u, 26 * u, DISPLAY, 400, PALE);
    fitText(g, String(sectionNumber).padStart(2, '0'), 56 * u, 485 * u, 556 * u, 284 * u, DISPLAY, 600, ORANGE, -4);

    const [line1, line2] = SECTION_NAMES[sectionNumber - 1] || SECTION_NAMES[0];
    monoText(g, line1, 692 * u, 226 * u, 36 * u, SECTION_ORANGE, 700);
    if (line2) monoText(g, line2, 692 * u, 266 * u, 36 * u, SECTION_ORANGE, 700);

    monoText(g, 'Tuned by hand', 692 * u, 452 * u, 28 * u, PALE, 500);
    monoText(g, 'tdnv OPEMG', 692 * u, 488 * u, 28 * u, PALE, 500);
    g.strokeStyle = GREY;
    g.lineWidth = 9 * u;
    g.beginPath(); g.arc(1052 * u, 465 * u, 27 * u, 0, Math.PI * 2); g.stroke();
    violinIcon(g, 1052 * u, 378 * u, 64 * u, GREY);   // upright, above the ring
    screenTex.texture.needsUpdate = true;
  }
  drawScreen();
  const screen = mountScreen(group, 2.70, 1.26, 0.34, 0, 0.45, FRONT, screenTex);

  /* ---------- control plate and printed ink ---------- */
  const plateGeometry = slab(2.70, 0.8, 0.4, 0.05, 0.016, 4);
  fitUV(plateGeometry, 2.70, 0.8);
  const plate = castsShadow(new THREE.Mesh(plateGeometry, createPlateMaterial()));
  plate.position.set(0, PLATE_Y, FRONT + 0.025);
  group.add(plate);
  decal(group, createPlateInk(selection), 2.78, 0.8, 0, PLATE_Y, PLATE_TOP + 0.002);

  /* ---------- knobs: endless encoders with detents; each click steps a value on the screen ---------- */
  let brightness = 1;
  function stepBrightness(direction) {
    const next = Math.min(1.15, Math.max(0.3, Math.round((brightness + direction * 0.05) * 100) / 100));
    if (next === brightness) return false;
    brightness = next;
    screen.material.color.setScalar(next);
    onBrightness(next);
    return true;
  }

  const knobs = [];
  const addKnob = (x, angle, control) => {
    const k = createKnob(0.235, 0.24, { color: 0x1D1F28, rough: 0.42, coat: 0.5, env: 0.22, mark: '#F06A35', angle });
    k.position.set(x, PLATE_Y, PLATE_TOP);
    group.add(k);
    knobs.push({ k, ...control });
  };
  addKnob(-1.0, selection.a0, {
    step: onSelectStep,
    detent: selection.step,
    min: -selection.step * (selection.n - 1),
    max: 0,
  });
  addKnob(1.0, 0.5, { step: stepBrightness });

  return {
    group,
    rim,
    rimMaterial,
    concrete,
    knobs,
    /** show section number `n` (1-based) on the screen */
    setSection(n) { sectionNumber = n; drawScreen(); },
  };
}
