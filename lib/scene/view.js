/* Framing the devices to the stage box, and the render and animation loop. */
import * as THREE from 'three';

/* How much of the scene the stage box shows, in scene units: both units side by side, or one unit on a phone, framed
   so it fills most of the width (its knobs come out about 40px across at 390px wide) but never more than ~96px a unit
   on a wide phone or a small tablet. On a phone `inset` keeps the bottom of the stage for the unit buttons. */
const BOTH = { width: 8.9, height: 4.9 };
const ONE = { width: 4.55, height: 3.05, pxPerUnit: 96 };

/** Returns `frame()`: resizes and re-aims the camera when the canvas changed, then renders.
    `single()` says whether one unit is shown; `inset()` is the px at the stage's foot the framing leaves free. */
export function createView({ canvas, renderer, scene, camera, onResize, single = () => false, inset = () => 0 }) {
  const size = { w: 0, h: 0, ch: 0, one: false };

  function frame() {
    // frame the devices to the stage box, then let the view run on below it to the canvas's full height
    const one = single();
    const w = canvas.clientWidth, h = canvas.parentElement.clientHeight - (one ? inset() : 0), ch = canvas.clientHeight;
    if (!w || h <= 0) return;
    if (w === size.w && h === size.h && ch === size.ch && one === size.one) { renderer.render(scene, camera); return; }

    size.w = w; size.h = h; size.ch = ch; size.one = one;
    renderer.setSize(w, ch, false);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, 0, w, ch);
    const fit = one ? { width: Math.max(ONE.width, w / ONE.pxPerUnit), height: ONE.height } : BOTH;
    const visibleHeight = Math.max(fit.height, fit.width / camera.aspect);
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, -distance * 0.02, distance);
    camera.lookAt(0, -0.02, 0);
    camera.updateProjectionMatrix();
    onResize();
    renderer.render(scene, camera);
  }
  return frame;
}

/* One loop: runs while the hero is on screen and something moves; sleeps otherwise.
   `advance(dt)` moves everything and returns true while it still needs frames. */
export function createLoop({ canvas, lifecycle, reduce, advance, frame }) {
  let visible = true, raf = 0, last = 0;

  function tick(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const needsMore = advance(dt);
    frame();
    if (visible && needsMore) raf = lifecycle.requestFrame(tick);
    else last = 0;
  }

  function wake() {
    if (!raf && visible) raf = lifecycle.requestFrame(tick);
  }

  lifecycle.on(reduce, 'change', wake);
  lifecycle.observeVisibility(canvas, ([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
  lifecycle.observeResize(canvas.parentElement, () => { frame(); wake(); });

  return { wake };
}
