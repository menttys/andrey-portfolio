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
const SECTION_ORANGE = '#E0683C';   // the orange the screen used for SYSTEM LOADING

const SCREEN_W = 1680, SCREEN_H = 795;   // 2.8 x 1.325 units

// satin control plate (full pill), with faint brushed smudges
function createPlateMaterial() {
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

/** the battery gauge, drawn as a violin lying on its side: the body holds the charge, the scroll is the terminal */
function violinBattery(g, x, y, u, charge, line, fill, gap = '#121318') {
  const P = (px, py) => [x + px * u, y + py * u];
  const body = () => {   // lower bout at the tail, pointed corners around the C-bouts, upper bout narrowing into the neck
    g.beginPath();
    for (const s of [1, -1]) {
      g.moveTo(...P(-58, 0));
      g.bezierCurveTo(...P(-58, -14 * s), ...P(-52, -21 * s), ...P(-41, -21 * s));
      g.bezierCurveTo(...P(-31, -21 * s), ...P(-25, -19 * s), ...P(-22, -17 * s));
      g.quadraticCurveTo(...P(-15, -7 * s), ...P(-8, -16 * s));
      g.bezierCurveTo(...P(-5, -18 * s), ...P(0, -19 * s), ...P(6, -19 * s));
      g.bezierCurveTo(...P(16, -19 * s), ...P(21, -11 * s), ...P(21, -3 * s));
      g.lineTo(...P(21, 0));
    }
  };
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // the charge fills the body from the tail end, inset from the outline like a battery cell
  body();
  g.save();
  g.clip();
  g.fillStyle = fill;
  g.fillRect(x - 58 * u, y - 24 * u, 79 * u * charge, 48 * u);
  g.strokeStyle = gap;   // clipped, so only the inner half of this stroke shows: a gap between cell and case
  g.lineWidth = 10 * u;
  body(); g.stroke();
  g.restore();
  g.strokeStyle = line;
  g.lineWidth = 3.5 * u;
  body(); g.stroke();
  // fingerboard, pegbox and scroll: the terminal
  g.fillStyle = line;
  g.fillRect(x + 20 * u, y - 2.8 * u, 27 * u, 5.6 * u);
  g.fillRect(x + 45 * u, y - 4 * u, 9 * u, 8 * u);
  g.beginPath(); g.arc(...P(58, 0), 5.5 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = gap;
  g.beginPath(); g.arc(...P(58.5, -0.5), 1.8 * u, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** `onSelectStep(delta)` moves the section selector; `onBrightness(value)` is told when the dial changes */
export function createGreyUnit({ selection, onSelectStep, onBrightness }) {
  const group = new THREE.Group();

  const rim = castsShadow(new THREE.Mesh(
    slab(3.05, 2.5, 0.5, 0.3, 0.035),
    flatMaterial(0xD9A77C, 0.55, { clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.35 }),
  ));
  rim.position.z = -0.1;
  group.add(rim);

  const concrete = castMaterial('#B4B4B3', 5, { cloud: 0.05, pore: 0.035, chips: 260, chipSize: 3.6, chipColor: 'rgba(22,22,22,0.92)', chipBump: '#303030', bump: 0.006, rough: 0.8, env: 0.45 });
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
    violinBattery(g, 1030 * u, 465 * u, u, 0.72, GREY, PALE);   // was a grey ring: arc(1052u, 465u, r 27u), lineWidth 9u
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
    rimMaterial: rim.material,
    concrete,
    knobs,
    /** show section number `n` (1-based) on the screen */
    setSection(n) { sectionNumber = n; drawScreen(); },
  };
}
