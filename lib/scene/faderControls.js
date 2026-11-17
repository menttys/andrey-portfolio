/* Sliding the faders on the phone unit: drag (mouse or finger), hover and press feedback, and the ease into a stop.
   Each fader is `{ f, stops, at, change(at, fader) }`: `f` is a createFader() group, `stops` how many positions it
   has, `at` the one it is set to (0 at the left or bottom end). The cap follows the pointer and the value clicks to
   the nearest stop as it passes; let go and the cap eases onto that stop. A drag is relative, so a touch that lands
   beside the cap never makes the value jump. */
import * as THREE from 'three';

const TOUCH_REACH = 26;   // px from a fader's slot that a fingertip still takes it

const isTouch = (e) => e.pointerType === 'touch' || e.pointerType === 'pen' || (typeof Touch !== 'undefined' && e instanceof Touch);
const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function createFaderControls({ canvas, stage, camera, faders, picker, lifecycle, reduce, wake }) {
  faders.forEach((o) => {
    o.shown = o.at / (o.stops - 1);   // where the cap is drawn, 0..1 along the slot
    o.lift = 0;
    o.liftTo = 0;
    place(o);
  });
  const bodies = faders.flatMap((o) => o.f.userData.bodies);

  let hover = null;
  let drag = null;

  function place(o) {
    const cap = o.f.userData.cap;
    cap.position.x = (o.shown - 0.5) * o.f.userData.travel;
    cap.position.z = o.lift;
  }

  // the slot's two ends on screen, in client pixels
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  function ends(o) {
    const half = o.f.userData.travel / 2, box = canvas.getBoundingClientRect();
    const px = (v) => { v.project(camera); v.set(box.left + (v.x + 1) / 2 * box.width, box.top + (1 - v.y) / 2 * box.height, 0); };
    o.f.localToWorld(a.set(-half, 0, 0)); px(a);
    o.f.localToWorld(b.set(half, 0, 0)); px(b);
    return { ax: a.x, ay: a.y, dx: b.x - a.x, dy: b.y - a.y };
  }

  // where the pointer is along the slot (0..1 between its ends, unclamped), and how far off it, in px
  function along(o, e) {
    const { ax, ay, dx, dy } = ends(o), len2 = dx * dx + dy * dy;
    const t = ((e.clientX - ax) * dx + (e.clientY - ay) * dy) / len2;
    const tc = clamp01(t);
    return { t, off: Math.hypot(e.clientX - (ax + dx * tc), e.clientY - (ay + dy * tc)) };
  }

  function pick(e) {
    const hit = picker.hit(e, bodies);
    if (hit) return faders.find((o) => o.f.userData.bodies.includes(hit.object));
    if (!isTouch(e)) return null;
    let nearest = null, reach = TOUCH_REACH;
    faders.forEach((o) => {
      const { off } = along(o, e);
      if (off < reach) { nearest = o; reach = off; }
    });
    return nearest;
  }

  function setHover(o) {
    if (hover === o) return;
    if (hover && hover !== drag) hover.liftTo = 0;
    hover = o;
    if (o && o !== drag) o.liftTo = 0.006;
    stage.classList.toggle('knob-hover', !!o);
    wake();
  }

  const setDragging = (on) => {
    stage.classList.toggle('knob-drag', on);
    document.documentElement.classList.toggle('knob-drag', on);
  };

  function dragTo(e) {
    drag.shown = clamp01(along(drag, e).t - drag.grab);
    const at = Math.round(drag.shown * (drag.stops - 1));
    if (at !== drag.at) { drag.at = at; drag.change(at, drag); }
    wake();
  }

  lifecycle.onWindow('pointermove', (e) => {
    if (drag) { dragTo(e); return; }
    if (e.pointerType === 'mouse') {
      // over the unit the pinned layer takes the pointer, so content hidden behind it can't be hovered or clicked
      stage.style.pointerEvents = picker.overDevice(e) ? 'auto' : '';
      setHover(pick(e));
    }
  }, { passive: true });

  lifecycle.onWindow('pointerdown', (e) => {
    const o = pick(e);
    if (!o || e.button > 0) return;
    e.preventDefault();
    drag = o;
    drag.grab = along(o, e).t - o.shown;   // keep the cap where it is under the finger
    drag.liftTo = -0.008;
    setDragging(true);
    wake();
  }, true);

  function release(e) {
    if (!drag) return;
    drag.liftTo = drag === hover ? 0.006 : 0;
    drag = null;
    setDragging(false);
    if (e.pointerType !== 'mouse') setHover(null);
    wake();
  }
  lifecycle.onWindow('pointerup', release);
  lifecycle.onWindow('pointercancel', release);
  lifecycle.on(document, 'mouseleave', () => {
    if (!drag) { setHover(null); stage.style.pointerEvents = ''; }
  });

  // a finger that lands on a fader slides it instead of scrolling the page
  lifecycle.onWindow('touchstart', (e) => {
    if (e.touches.length === 1 && pick(e.touches[0])) e.preventDefault();
  }, { passive: false });

  return {
    /** the fader under a pointer event, if any */
    pick,

    /** move fader `o` to stop `at` from outside (the cap eases there) */
    set(o, at) { o.at = at; wake(); },

    /** ease the caps onto their stops; true while anything is still moving */
    step(dt) {
      let busy = false;
      const k = 1 - Math.exp(-dt * (reduce.matches ? 60 : 22));
      faders.forEach((o) => {
        const to = o.at / (o.stops - 1);
        if (drag !== o) o.shown += (to - o.shown) * k;
        o.lift += (o.liftTo - o.lift) * k;
        if ((drag !== o && Math.abs(to - o.shown) > 1e-4) || Math.abs(o.liftTo - o.lift) > 1e-5) busy = true;
        place(o);
      });
      return busy || !!drag;
    },
  };
}
