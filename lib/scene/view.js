/* Framing the devices to the stage box, and the render and animation loop. */
import * as THREE from 'three';

/* How much of the scene the stage box shows, in scene units: both units side by side, or the one phone unit, framed
   so it fills most of the width but never more than ~96px a unit on a wide phone. */
const BOTH = { width: 8.9, height: 4.9 };
const ONE = { width: 4.55, height: 3.05, pxPerUnit: 96 };

/** Returns `frame()`: resizes and re-aims the camera when the canvas changed, then renders. `single`: one unit is shown. */
export function createView({ canvas, renderer, scene, camera, onResize, single = false }) {
  const size = { w: 0, h: 0, ch: 0 };

  function frame() {
    // frame the devices to the stage box, then let the view run on below it to the canvas's full height
    const w = canvas.clientWidth, h = canvas.parentElement.clientHeight, ch = canvas.clientHeight;
    if (!w || !h) return;
    if (w === size.w && h === size.h && ch === size.ch) { renderer.render(scene, camera); return; }

    size.w = w; size.h = h; size.ch = ch;
    renderer.setSize(w, ch, false);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, 0, w, ch);
    const fit = single ? { width: Math.max(ONE.width, w / ONE.pxPerUnit), height: ONE.height } : BOTH;
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
