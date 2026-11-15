/* The hero scene: the two 3D devices, the open-to-work unit, the inked captions and the header weather line.
   Ported from the approved prototype (prototype/saved/2026-11-14-github-commits/home.html), with three.js 0.128
   from npm instead of the CDN.

   startScene() runs once on the client after the page's markup is mounted. It rejects if the 3D can't start (no
   WebGL, or the browser refuses the memory), and calls `onFail` if the browser takes the WebGL context away later,
   so the page can show a still image instead. How much memory it may use is set in budget.js. Aborting `signal`
   tears everything down (listeners, frames, timers, observers, renderers and the page styles the knobs set), so a
   remount or a hot reload starts clean.

   Modules:
     stage / view        renderer, scene, camera and key light; framing and the render loop
     greyUnit / greenUnit / openToWork    the three devices
     pose / motion       resting on the paper, idle float and touch response
     knobControls / touchTilt / picker    pointer input
     sectionSlider       what the first knob does to the page
     headerCaption / weather / sectionInk    text inked onto the page */
import { createLifecycle } from './lifecycle.js';
import { createStage } from './stage.js';
import { loadFonts } from './draw.js';
import { createSelection } from './sections.js';
import { createGreyUnit } from './greyUnit.js';
import { createGreenUnit } from './greenUnit.js';
import { createOpenToWork } from './openToWork.js';
import { readTilts, restOnPaper } from './pose.js';
import { createMotion } from './motion.js';
import { createPicker } from './picker.js';
import { createKnobControls } from './knobControls.js';
import { createTouchTilt } from './touchTilt.js';
import { createSectionSlider } from './sectionSlider.js';
import { createHeaderCaption } from './headerCaption.js';
import { startHeaderLine } from './weather.js';
import { inkSectionHeads } from './sectionInk.js';
import { createView, createLoop } from './view.js';
import { GL_MODE } from './budget.js';

// the page dims or brightens under the brightness knob: 0.3 -> 42% black, 1.15 -> 7.5% white
function dimPage(brightness) {
  const dim = document.getElementById('dim');
  if (!dim) return;
  dim.classList.toggle('up', brightness > 1);
  dim.style.opacity = brightness < 1 ? (1 - brightness) * 0.6 : (brightness - 1) * 0.5;
}

// the extras (the small status unit, the inked captions) are not worth losing the devices over
function optional(name, build) {
  try { return build(); } catch (error) { console.warn(`[scene] ${name} skipped:`, error); return null; }
}

/** @param {AbortSignal} signal @param {{ onFail?: (error: unknown) => void }} [options] */
export async function startScene(signal, { onFail = () => {} } = {}) {
  if (GL_MODE === 'off') throw new Error('3D turned off with ?gl=off');
  const lifecycle = createLifecycle(signal);

  const canvas = document.getElementById('gl');
  if (!canvas) return;
  const { renderer, scene, camera } = createStage(canvas, lifecycle);
  lifecycle.onContextLost(renderer, () => onFail(new Error('WebGL context lost')));

  await loadFonts();
  if (signal.aborted) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const selection = createSelection();

  /* ---------- the devices ---------- */
  let slider, openToWork = null;
  const left = createGreyUnit({
    selection,
    onSelectStep: (direction) => slider.select(selection.at + direction),
    onBrightness: (v) => { openToWork?.setBright(v); dimPage(v); },
  });
  const right = createGreenUnit({ canvas, camera });
  scene.add(left.group, right.group);
  openToWork = optional('open to work', () => createOpenToWork({ lifecycle, reduce, rimMaterial: left.rimMaterial, concrete: left.concrete }));

  /* ---------- text inked onto the page ---------- */
  optional('section ink', () => inkSectionHeads(lifecycle, renderer));
  const header = optional('header caption', () => createHeaderCaption({ camera, canvas, renderer }));
  if (header) startHeaderLine(header, lifecycle);

  /* ---------- composition (matches the reference frame) ---------- */
  const tilts = readTilts();
  restOnPaper({ scene, group: left.group, rim: left.rim, x: -2.08, turn: tilts.left, tip: tilts.tip, w: 3.05, h: 2.5, radius: 0.5 });
  restOnPaper({ scene, group: right.group, rim: right.rim, x: 1.68, turn: tilts.right, tip: tilts.tip, w: 3.94, h: 2.54, radius: 0.52 });

  /* ---------- input and animation ---------- */
  const devices = [left.group, right.group];
  const motion = createMotion(devices, reduce);
  const picker = createPicker({ canvas, camera, groups: devices });
  const wake = () => loop.wake();

  slider = createSectionSlider({
    canvas, camera, devices, selection, lifecycle, reduce, wake,
    onSelect: (i) => left.setSection(i + 1),
  });
  const knobControls = createKnobControls({
    canvas, stage: canvas.parentElement, camera, picker, lifecycle, reduce, wake,
    knobs: [...left.knobs, ...right.knobs],
  });
  createTouchTilt({ picker, motion, pickKnob: knobControls.pick, lifecycle, reduce, wake });

  const frame = createView({ canvas, renderer, scene, camera, onResize: () => header?.resize() });
  const loop = createLoop({
    canvas, lifecycle, reduce, frame,
    advance(dt) {
      const floating = motion.advance(dt);
      const touching = motion.settle(dt);
      motion.apply();
      const turning = knobControls.step(dt);
      const sliding = slider.step(dt);
      return floating || touching || turning || sliding;
    },
  });

  motion.apply();
  frame();
  loop.wake();
}
