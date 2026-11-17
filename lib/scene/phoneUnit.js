/* The phone unit: the two desktop units merged into one, shown instead of them at phone widths (see index.js).
   The green unit's shell and size; a shorter screen that carries both readouts, smaller (the paper-colour waveform
   and the type weight on top, the section number and the weight counter underneath); and, like a mixing desk,
   four faders in place of the four knobs:
     on the grey unit's satin plate along the bottom, left to right:  page section, brightness
     on the green column down the right, left to right:               paper colour, type weight */
import * as THREE from 'three';
import { slab, fitUV } from './geometry.js';
import { canvasTexture } from './textures.js';
import { budget } from './budget.js';
import { castsShadow, decal, mountScreen, createFader } from './parts.js';
import { SECTION_NAMES } from './sections.js';
import { fitText, monoText, hatch, darkPanel, DISPLAY, ORANGE, OLIVE, LIME, PALE } from './draw.js';
import { createPlateMaterial, SECTION_ORANGE } from './greyUnit.js';
import {
  addGreenShell, addControlColumn, createPaperFlood, drawWaveform, drawWeightLadder,
  COLUMN_X, TINTS, GREY_ZONE, zoneOf, WINDOW_MID, WINDOW_RANGE, WEIGHT_RANGE,
} from './greenUnit.js';

const FRONT = 0.2;
const SCREEN = { w: 2.705, h: 1.5, x: -0.4325, y: 0.335 };
const PLATE = { w: 2.705, h: 0.58, y: -0.795 };
const PLATE_TOP = FRONT + 0.066;
const REF_W = 1105, REF_H = 613;          // the screen is laid out in these reference px
const SCREEN_W = 1658, SCREEN_H = 919;    // and painted at 1.5x

const WINDOW_STEP = 28, WEIGHT_STEP = 2;
const BRIGHT = { min: 0.3, max: 1.15, step: 0.05 };
const stopsOf = (range, step) => Math.round((range.max - range.min) / step) + 1;

const PLATE_FADERS = { travel: 0.9, across: 0.3, xs: [-0.66, 0.66] };       // x from the plate's centre
const COLUMN_FADERS = { travel: 1.55, across: 0.28, xs: [-0.19, 0.19] };    // x from the column's centre

// printed scales beside the slots: one tick per stop where there are few, end and centre ticks where there are many
function ticks(g, x0, x1, y, n, long, color) {
  g.strokeStyle = color;
  g.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * i / (n - 1), end = i === 0 || i === n - 1;
    g.lineWidth = end ? 3.4 : 2.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - (end ? long : long * 0.7)); g.stroke();
  }
}

function createPlateInk(sectionStops) {
  const s = 600, tex = canvasTexture(PLATE.w * s, PLATE.h * s, budget.screenScale), g = tex.ctx;
  const cx = PLATE.w * s / 2, cy = PLATE.h * s / 2, half = PLATE_FADERS.travel * s / 2, ink = 'rgba(70,74,82,0.75)';
  const [sections, bright] = PLATE_FADERS.xs.map((x) => cx + x * s);
  ticks(g, sections - half, sections + half, cy - 0.105 * s, sectionStops, 0.045 * s, ink);
  ticks(g, bright - half, bright + half, cy - 0.105 * s, 5, 0.045 * s, ink);
  tex.texture.needsUpdate = true;
  return tex;
}

function createColumnInk() {
  const s = 600, tex = canvasTexture(0.8 * s, 2.25 * s, budget.screenScale), g = tex.ctx;
  const cx = 0.4 * s, cy = 1.125 * s, half = COLUMN_FADERS.travel * s / 2;
  // one scale down the middle, read by both faders
  g.save();
  g.translate(cx, cy);
  g.rotate(-Math.PI / 2);
  ticks(g, -half, half, 0.03 * s, 9, 0.06 * s, 'rgba(190,200,140,0.6)');
  g.restore();
  tex.texture.needsUpdate = true;
  return tex;
}

/** `onSelect(i)` goes to page section i; `onBrightness(value)` is told when the brightness fader moves */
export function createPhoneUnit({ selection, canvas, camera, onSelect, onBrightness }) {
  const group = new THREE.Group();
  const rim = addGreenShell(group);

  /* ---------- screen ---------- */
  const screenTex = canvasTexture(SCREEN_W, SCREEN_H, budget.screenScale);
  const state = { section: 1, num: 60, win: 0 };

  function drawScreen() {
    const g = screenTex.ctx, u = SCREEN_W / REF_W;
    darkPanel(g, SCREEN_W, SCREEN_H);

    // top left: the paper-colour waveform, a little over half its size on the green unit
    g.save();
    g.translate(56 * u, 22 * u); g.scale(0.56, 0.56); g.translate(-70 * u, -50 * u);
    drawWaveform(g, u, state.win);
    g.restore();

    // top right: the type weight ladder
    monoText(g, 'TYPE WEIGHT', 668 * u, 62 * u, 26 * u, LIME, 700);
    g.save();
    g.translate(668 * u, 96 * u); g.scale(0.85, 0.85); g.translate(-685 * u, -700 * u);
    drawWeightLadder(g, u, state.num);
    g.restore();

    hatch(g, 56 * u, 292 * u, 21, 24 * u, 36 * u, PALE, 3.2 * u);
    fitText(g, 'PORTFOLIO', 680 * u, 288 * u, 365 * u, 24 * u, DISPLAY, 400, PALE);

    // bottom: the section number and its name, and the weight counter wearing its own weight
    fitText(g, String(state.section).padStart(2, '0'), 56 * u, 566 * u, 300 * u, 200 * u, DISPLAY, 600, ORANGE, -4);
    const [line1, line2] = SECTION_NAMES[state.section - 1] || SECTION_NAMES[0];
    monoText(g, line1, 392 * u, 394 * u, 30 * u, SECTION_ORANGE, 700);
    if (line2) monoText(g, line2, 392 * u, 430 * u, 30 * u, SECTION_ORANGE, 700);
    monoText(g, 'Tuned by hand', 392 * u, 566 * u, 22 * u, PALE, 500);
    fitText(g, String(state.num).padStart(2, '0'), 704 * u, 566 * u, 340 * u, 200 * u, DISPLAY, state.num * 10, OLIVE, -4);
    screenTex.texture.needsUpdate = true;
  }
  drawScreen();
  const screen = mountScreen(group, SCREEN.w, SCREEN.h, 0.34, SCREEN.x, SCREEN.y, FRONT, screenTex);

  /* ---------- the grey unit's satin plate along the bottom, and the green column down the right ---------- */
  const plateGeometry = slab(PLATE.w, PLATE.h, PLATE.h / 2, 0.05, 0.016, 4);
  fitUV(plateGeometry, PLATE.w, PLATE.h);
  const plate = castsShadow(new THREE.Mesh(plateGeometry, createPlateMaterial()));
  plate.position.set(SCREEN.x, PLATE.y, FRONT + 0.025);
  group.add(plate);
  decal(group, createPlateInk(selection.n), PLATE.w, PLATE.h, SCREEN.x, PLATE.y, PLATE_TOP + 0.002);

  const columnTop = addControlColumn(group);
  decal(group, createColumnInk(), 0.8, 2.25, COLUMN_X, 0, columnTop + 0.002);

  /* ---------- what the faders do ---------- */
  function setBrightness(at) {
    const value = Math.round((BRIGHT.min + at * BRIGHT.step) * 100) / 100;
    screen.material.color.setScalar(value);
    onBrightness(value);
  }

  // paper colour: the fader slides the 30S window along the waveform, and the page takes the band under it
  let tint = GREY_ZONE;
  const flood = createPaperFlood({ canvas, camera });
  function setWindow(at, fader) {
    state.win = WINDOW_RANGE.min + at * WINDOW_STEP;
    drawScreen();
    const zone = zoneOf(WINDOW_MID + state.win);
    if (zone !== tint) { tint = zone; flood(TINTS[zone], fader.f.userData.cap); }
  }

  // type weight: sets the page's variable-font weight, and redraws once that weight's font has loaded
  function setWeight(at) {
    const num = WEIGHT_RANGE.min + at * WEIGHT_STEP;
    state.num = num;
    drawScreen();
    document.documentElement.style.setProperty('--wght', num * 10);
    document.fonts.load(`${num * 10} 100px Unbounded`).then(() => { if (state.num === num) drawScreen(); }).catch(() => {});
  }

  /* ---------- faders ---------- */
  const faders = [];
  const addFader = (spec, x, y, z, vertical, look, control) => {
    const f = createFader(spec.travel, { across: spec.across, ...look });
    f.position.set(x, y, z);
    if (vertical) f.rotation.z = Math.PI / 2;
    group.add(f);
    faders.push({ f, ...control });
  };
  const dark = { color: 0x1D1F28, rough: 0.42, coat: 0.5, env: 0.22, mark: '#F06A35' };    // the grey unit's knobs
  const pale = { color: 0xCBCBC9, rough: 0.36, coat: 0.5, env: 0.5, mark: '#4F6A1C' };      // the green unit's

  addFader(PLATE_FADERS, SCREEN.x + PLATE_FADERS.xs[0], PLATE.y, PLATE_TOP, false, dark,
    { stops: selection.n, at: 0, change: (at) => onSelect(at) });
  addFader(PLATE_FADERS, SCREEN.x + PLATE_FADERS.xs[1], PLATE.y, PLATE_TOP, false, dark,
    { stops: stopsOf(BRIGHT, BRIGHT.step), at: Math.round((1 - BRIGHT.min) / BRIGHT.step), change: setBrightness });
  addFader(COLUMN_FADERS, COLUMN_X + COLUMN_FADERS.xs[0], 0, columnTop, true, pale,
    { stops: stopsOf(WINDOW_RANGE, WINDOW_STEP), at: Math.round(-WINDOW_RANGE.min / WINDOW_STEP), change: setWindow });
  addFader(COLUMN_FADERS, COLUMN_X + COLUMN_FADERS.xs[1], 0, columnTop, true, pale,
    { stops: stopsOf(WEIGHT_RANGE, WEIGHT_STEP), at: (60 - WEIGHT_RANGE.min) / WEIGHT_STEP, change: setWeight });

  return {
    group,
    rim,
    faders,
    /** show section number `n` (1-based) on the screen */
    setSection(n) { state.section = n; drawScreen(); },
  };
}
