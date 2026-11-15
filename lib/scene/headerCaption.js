/* The caption in the page header: text, an optional small icon and an optional tail (the temperature or the time),
   inked through the GPU exactly like the old caption decal (same texture, mipmaps and filtering), so the ink softens
   into the paper the same way instead of the crisper look of a plain 2D canvas. It goes through the hero's renderer
   (see inkTarget.js) and lands in #topcap as a 2D canvas, so it needs no WebGL context of its own. */
import * as THREE from 'three';
import { canvasTexture } from './textures.js';
import { icons } from './icons.js';
import { setLetterSpacing, MONO, PAPER_INK } from './draw.js';
import { pixelRatio } from './stage.js';
import { renderToCanvas } from './inkTarget.js';

export const MONTH = 'Portfolio / 11.26';

const FONT = `400 34px ${MONO}`;
const TEXTURE_H = 64;
const GAP = 16;
const ICON_W = 38;

// The caption keeps the on-screen size the one under the devices had: a 512 x 64 drawing whose width spans these two
// scene points (a hidden reference, projected through the camera).
const REF_LEFT = new THREE.Vector3(-3.9, -1.95, -0.31);
const REF_RIGHT = new THREE.Vector3(-2.3, -1.95, -0.31);

const measureContext = document.createElement('canvas').getContext('2d');
function measure(spec) {
  measureContext.font = FONT;
  setLetterSpacing(measureContext, '2px');
  const iconW = spec.icon ? ICON_W : 0;
  const textW = measureContext.measureText(spec.text).width;
  const tailW = spec.tail ? measureContext.measureText(spec.tail).width : 0;
  return { iconW, textW, tailW, total: textW + (iconW ? GAP + iconW : 0) + (tailW ? GAP + tailW : 0) };
}

/** Returns `{ set(full, short), resize() }`, or null when the page has no #topcap canvas.
    `full` is used where it fits between the name and the mark, `short` (default: just the month) where it doesn't. */
export function createHeaderCaption({ camera, canvas: stageCanvas, renderer }) {
  const element = document.getElementById('topcap');
  if (!element) return null;

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
  scene.add(mesh);
  const ortho = new THREE.OrthographicCamera(-0.8, 0.8, 0.1, -0.1, 0.1, 10);
  ortho.position.z = 1;

  // draw a spec into a fresh texture and put it on the plane; returns its width in texture px
  function paint(spec) {
    const { iconW, textW, tailW, total } = measure(spec);
    const width = Math.max(512, 2 ** Math.ceil(Math.log2(total + 24)));
    const tex = canvasTexture(width, TEXTURE_H), g = tex.ctx;
    g.fillStyle = g.strokeStyle = PAPER_INK;
    g.lineWidth = 2.4;
    g.lineCap = g.lineJoin = 'round';
    g.font = FONT;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    setLetterSpacing(g, '2px');

    let x = (width - total) / 2;
    g.fillText(spec.text, x, 34);
    x += textW;
    if (iconW) {   // icons are drawn on a 26px grid and set a little larger, so they sit at the height of the capitals
      x += GAP;
      g.save();
      g.translate(x + iconW / 2, 32);
      g.scale(1.32, 1.32);
      g.lineWidth = 2.1;
      icons[spec.icon](g, 0, 0);
      g.restore();
      x += iconW;
    }
    if (tailW) { x += GAP; g.fillText(spec.tail, x, 34); }
    tex.texture.needsUpdate = true;

    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.map = tex.texture;
    mesh.material.needsUpdate = true;
    mesh.scale.x = width / 320;
    ortho.left = -width / 640;
    ortho.right = width / 640;
    ortho.updateProjectionMatrix();
    return width;
  }

  let full = { text: MONTH }, short = { text: MONTH };
  let shown = null, shownWidth = 0;

  function resize() {
    const a = REF_LEFT.clone().project(camera), b = REF_RIGHT.clone().project(camera);
    const k = Math.abs(b.x - a.x) / 2 * stageCanvas.clientWidth / 512;   // CSS px per texture px, as the 512-wide caption had
    if (!(k > 0 && k < 16)) return;   // 0, or absurd before the camera is aimed at the stage

    const room = element.parentElement.clientWidth - 24;
    const want = measure(full).total * k > room ? short : full;
    if (want !== shown) { shownWidth = paint(want); shown = want; }

    const w = shownWidth * k, h = TEXTURE_H * k;
    element.style.width = w.toFixed(1) + 'px';
    element.style.height = h.toFixed(1) + 'px';
    const dpr = pixelRatio();
    renderToCanvas(renderer, scene, ortho, w * dpr, h * dpr, element);
  }

  return {
    resize,
    set(fullSpec, shortSpec) {
      full = fullSpec;
      short = shortSpec || { text: MONTH, icon: fullSpec.icon, tail: fullSpec.tail };
      shown = null;
      element.parentElement.setAttribute('aria-label', [fullSpec.text, fullSpec.tail].filter(Boolean).join(' '));
      resize();
    },
  };
}
