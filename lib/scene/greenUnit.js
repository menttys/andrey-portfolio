/* The green unit (right): a waveform that doubles as the paper-colour selector, a type-weight readout and two knobs.
   The top knob slides the 30S window along the waveform; the page takes the colour band under it.
   The bottom knob sets the weight of the page's display type. */
import * as THREE from 'three';
import { slab } from './geometry.js';
import { castMaterial, canvasTexture, seededRandom } from './textures.js';
import { budget } from './budget.js';
import { castsShadow, decal, mountScreen, createKnob } from './parts.js';
import { fitText, monoText, hatch, darkPanel, DISPLAY, OLIVE, LIME, PALE, WAVE } from './draw.js';

const FRONT = 0.2;
const COLUMN_X = 1.42;
const SCREEN_W = 1658, SCREEN_H = 1344;   // 2.76 x 2.24 units

// The waveform doubles as a colour selector: five bands, warm to cool, with the original grey in the middle where
// the 30S window rests. TINTS is the paper tone each band gives the page; INK is the same tone lifted for the dark screen.
const ZONE_X0 = 70, ZONE_X1 = 1036, WINDOW_MID = 556;
const TINTS = ['#EAD4C7', '#EBE5C2', '#D8D8D7', '#C9E3D6', '#DAD1EB'];   // peach, butter, grey, mint, lilac
const INK = ['hsl(22 72% 80%)', 'hsl(52 70% 76%)', WAVE, 'hsl(150 42% 74%)', 'hsl(262 60% 82%)'];
const GREY_ZONE = 2;
const zoneOf = (x) => Math.min(4, Math.max(0, Math.floor((x - ZONE_X0) / (ZONE_X1 - ZONE_X0) * 5)));

const WINDOW_RANGE = { min: -392, max: 364 };   // the window stops at the ends of the waveform
const WEIGHT_RANGE = { min: 20, max: 90 };      // the readout is the weight over ten: 20 = ExtraLight 200 ... 90 = Black 900
const WEIGHT_NAMES = { 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };

export function createGreenUnit({ canvas, camera }) {
  const group = new THREE.Group();

  const rim = castsShadow(new THREE.Mesh(
    slab(3.94, 2.54, 0.52, 0.3, 0.035),
    new THREE.MeshPhysicalMaterial({ color: 0xD3D8C9, roughness: 0.3, transparent: true, opacity: 0.88, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.6 }),
  ));
  rim.position.z = -0.1;
  group.add(rim);

  const resin = castMaterial('#445219', 17, { cloud: 0.045, pore: 0.03, chips: 150, chipSize: 3.6, chipColor: 'rgba(196,205,140,0.85)', chipBump: '#b8b8b8', bump: 0.004, rough: 0.55, coat: 0.1, env: 0.28 });
  group.add(castsShadow(new THREE.Mesh(slab(3.81, 2.41, 0.46, 0.34, 0.03), resin)));

  /* ---------- screen ---------- */
  const screenTex = canvasTexture(SCREEN_W, SCREEN_H, budget.screenScale);
  const state = { num: 60, win: 0 };   // big readout, and the selection window's offset in reference px

  function drawWaveform(g, u) {
    const random = seededRandom(12);
    const x0 = 70 * u, x1 = 1036 * u, mid = 232 * u, bars = 70;

    for (let i = 0; i < bars; i++) {
      const k = i / (bars - 1), x = x0 + k * (x1 - x0);
      const envelope = 0.25 + 0.75 * Math.abs(Math.sin(k * 9.5 + 0.6) * Math.cos(k * 3.1 - 0.4));
      const height = (10 + envelope * (40 + random() * 150)) * u;
      const zone = zoneOf(x / u);
      const accent = i % 5 === 2;
      g.globalAlpha = accent ? 0.78 : 1;
      g.fillStyle = zone === GREY_ZONE && accent ? '#9FA6D0' : INK[zone];
      g.fillRect(x - 2.2 * u, mid - height / 2, 4.4 * u, height);
    }

    // the 30S selection window, with the bars inside it redrawn dimmer
    const s0 = (466 + state.win) * u, s1 = (646 + state.win) * u;
    g.fillStyle = 'rgba(24,26,16,0.82)';
    g.fillRect(s0, 72 * u, s1 - s0, 335 * u);
    for (let i = 0; i < bars; i++) {
      const k = i / (bars - 1), x = x0 + k * (x1 - x0);
      if (x < s0 + 6 || x > s1 - 6) continue;
      const height = (30 + ((i * 53) % 7) * 22) * u;
      const zone = zoneOf(x / u);
      g.globalAlpha = zone === GREY_ZONE ? 1 : 0.85;
      g.fillStyle = zone === GREY_ZONE ? '#B9BED8' : INK[zone];
      g.fillRect(x - 2.2 * u, mid - height / 2, 4.4 * u, height);
    }
    g.globalAlpha = 1;

    // the selector takes the tone it sits on; the grey band keeps the original lime
    const zone = zoneOf(WINDOW_MID + state.win);
    g.fillStyle = zone === GREY_ZONE ? LIME : INK[zone];
    [s0, s1].forEach((sx) => {
      g.fillRect(sx - 1.6 * u, 62 * u, 3.2 * u, 345 * u);
      g.beginPath(); g.moveTo(sx - 11 * u, 50 * u); g.lineTo(sx + 11 * u, 50 * u); g.lineTo(sx, 66 * u); g.fill();
    });

    // the window's label reads out the paper tone it has selected
    fitText(g, TINTS[zone], (WINDOW_MID - 72 + state.win) * u, 114 * u, 144 * u, 21 * u, DISPLAY, 400, zone === GREY_ZONE ? '#C9CCEC' : INK[zone], 2);
  }

  // a weight ladder: one A per Unbounded weight, 200 to 900; the one nearest the dial is lit, a caret marks the exact value
  function drawWeightLadder(g, u) {
    const weight = state.num * 10, nearest = Math.round(weight / 100) * 100;
    for (let i = 0; i < 8; i++) {
      const w = 200 + i * 100, x = (705 + i * 44) * u;   // natural proportions: the heavier the A, the wider it sits
      g.globalAlpha = w === nearest ? 1 : 0.42;
      g.fillStyle = w === nearest ? LIME : PALE;
      g.font = `${w} ${40 * u}px ${DISPLAY}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText('A', x, 742 * u);
      g.textAlign = 'left';
    }
    g.globalAlpha = 1;

    const caretX = (705 + (weight - 200) / 100 * 44) * u;
    g.fillStyle = LIME;
    g.beginPath(); g.moveTo(caretX - 8 * u, 772 * u); g.lineTo(caretX + 8 * u, 772 * u); g.lineTo(caretX, 760 * u); g.fill();
    g.fillStyle = 'rgba(169,170,174,0.35)';
    g.fillRect(690 * u, 776 * u, 338 * u, 2 * u);

    monoText(g, 'Unbounded', 685 * u, 818 * u, 28 * u, PALE, 500);
    monoText(g, `${WEIGHT_NAMES[nearest]} · ${weight}`, 685 * u, 853 * u, 28 * u, PALE, 500);
  }

  function drawScreen() {
    const g = screenTex.ctx, u = SCREEN_W / 1105;
    darkPanel(g, SCREEN_W, SCREEN_H);
    drawWaveform(g, u);
    hatch(g, 76 * u, 494 * u, 21, 24 * u, 36 * u, PALE, 3.2 * u);
    fitText(g, 'PALESTRA', 680 * u, 488 * u, 350 * u, 26 * u, DISPLAY, 400, PALE);
    fitText(g, String(state.num).padStart(2, '0'), 60 * u, 860 * u, 556 * u, 290 * u, DISPLAY, state.num * 10, OLIVE, -4);   // the readout wears its own weight
    monoText(g, 'TYPE', 685 * u, 596 * u, 36 * u, LIME, 700);
    monoText(g, 'WEIGHT', 685 * u, 637 * u, 36 * u, LIME, 700);
    drawWeightLadder(g, u);
    screenTex.texture.needsUpdate = true;
  }
  drawScreen();
  mountScreen(group, 2.705, 2.17, 0.34, -0.4325, 0, FRONT, screenTex);

  /* ---------- knob column: a shallow raised pill in the same resin, a shade deeper ---------- */
  const columnMaterial = castMaterial('#3F4D17', 41, { cloud: 0.03, pore: 0.025, chips: 30, chipSize: 3.4, chipColor: 'rgba(196,205,140,0.8)', chipBump: '#b0b0b0', bump: 0.003, rough: 0.52, coat: 0.12, env: 0.28 });
  const column = castsShadow(new THREE.Mesh(slab(0.8, 2.25, 0.4, 0.03, 0.012, 4), columnMaterial));
  column.position.set(COLUMN_X, 0, FRONT + 0.015);
  group.add(column);
  const columnTop = FRONT + 0.042;

  const inkTex = canvasTexture(480, 1350, budget.screenScale);   // 0.8 x 2.25 at 600 px/unit
  {
    const g = inkTex.ctx, s = 600, cx = 240, cy = 675;
    g.strokeStyle = 'rgba(190,200,140,0.5)';
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy - 0.73 * s, 0.4 * s, Math.PI / 2 - 0.75, Math.PI / 2 + 0.75); g.stroke();
    g.beginPath(); g.arc(cx, cy + 0.73 * s, 0.4 * s, -Math.PI / 2 - 0.75, -Math.PI / 2 + 0.75); g.stroke();
    fitText(g, 'FURLAN', cx - 128, cy + 13, 256, 26, DISPLAY, 500, 'rgba(206,214,160,0.92)', 9);
    inkTex.texture.needsUpdate = true;
  }
  decal(group, inkTex, 0.8, 2.25, COLUMN_X, 0, columnTop + 0.002);

  /* ---------- paper tone: pastel tones at the paper's own lightness, so ink, shadows and the devices read the same on
     every one; 2 is the original grey ---------- */
  let tint = GREY_ZONE;
  const wash = document.getElementById('wash');

  // the new tone spreads over the page from the knob that chose it
  function flood(color, knob) {
    const center = new THREE.Vector3();
    knob.getWorldPosition(center);
    center.project(camera);
    const box = canvas.getBoundingClientRect();
    const x = box.left + (center.x + 1) / 2 * box.width, y = box.top + (1 - center.y) / 2 * box.height;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 4;

    const layer = document.createElement('i');
    layer.style.cssText = `background:${color};--x:${x}px;--y:${y}px;--r:${radius}px`;
    wash.appendChild(layer);
    layer.getBoundingClientRect();   // flush styles so the transition runs
    layer.classList.add('on');
    document.documentElement.style.setProperty('--paper', color);
    // once a tone has covered the page, the layers under it are no longer seen
    layer.addEventListener('transitionend', () => { while (wash.firstChild !== layer) wash.firstChild.remove(); }, { once: true });
  }

  // colour selector: each click slides the 30S window along the waveform, and the page takes the band under it
  function stepWindow(direction, knob) {
    const next = Math.min(WINDOW_RANGE.max, Math.max(WINDOW_RANGE.min, state.win + direction * 28));
    if (next === state.win) return false;
    state.win = next;
    drawScreen();
    const zone = zoneOf(WINDOW_MID + next);
    if (zone !== tint) { tint = zone; flood(TINTS[zone], knob.k); }
    return true;
  }

  // type weight: sets the page's variable-font weight, and redraws once that weight's font has loaded
  function stepWeight(direction) {
    const next = Math.min(WEIGHT_RANGE.max, Math.max(WEIGHT_RANGE.min, state.num + direction * 2));
    if (next === state.num) return false;
    state.num = next;
    drawScreen();
    document.documentElement.style.setProperty('--wght', next * 10);
    document.fonts.load(`${next * 10} 100px Unbounded`).then(() => { if (state.num === next) drawScreen(); }).catch(() => {});
    return true;
  }

  const knobs = [];
  const addKnob = (y, angle, step) => {
    const k = createKnob(0.235, 0.24, { color: 0xCBCBC9, rough: 0.36, coat: 0.5, env: 0.5, mark: '#4F6A1C', angle, ring: true });
    k.position.set(COLUMN_X, y, columnTop);
    group.add(k);
    knobs.push({ k, step });
  };
  addKnob(0.73, 2.2, stepWindow);
  addKnob(-0.73, 0.75, stepWeight);

  return { group, rim, knobs };
}
