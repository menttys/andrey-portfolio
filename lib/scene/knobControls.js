/* Turning the knobs: drag, wheel and touch input, hover and press feedback, and the detent animation.
   Each knob is `{ k, step(direction, knob) }` plus optional `detent`, `min` and `max`. `step` returns false at a stop,
   where the knob holds. */
import * as THREE from 'three';

const DETENT = Math.PI / 12;   // 24 clicks a turn
const WHEEL_CLICK = 40;        // wheel travel that makes one click
const WHEEL_LOCK_MS = 380;

const snapToDetent = (turn, detent) => Math.round(turn / detent) * detent;

export function createKnobControls({ canvas, stage, camera, knobs, picker, lifecycle, reduce, wake }) {
  knobs.forEach((o) => {
    o.turn = 0;         // where the knob is set (radians)
    o.shown = 0;        // where the cap is drawn, easing towards `turn`
    o.lift = 0;
    o.liftTo = 0;
    o.home = o.k.userData.cap.position.z;
  });
  const bodies = knobs.map((o) => o.k.userData.body);

  let hover = null;
  let drag = null;

  function pick(e) {
    const hit = picker.hit(e, bodies);
    return hit ? knobs.find((o) => o.k.userData.body === hit.object) : null;
  }

  // the pointer's angle and distance around the knob's centre, in screen space
  function angleAround(knob, e) {
    const center = new THREE.Vector3();
    knob.k.getWorldPosition(center);
    center.project(camera);
    const box = canvas.getBoundingClientRect();
    const cx = box.left + (center.x + 1) / 2 * box.width, cy = box.top + (1 - center.y) / 2 * box.height;
    return { angle: Math.atan2(-(e.clientY - cy), e.clientX - cx), radius: Math.hypot(e.clientX - cx, e.clientY - cy) };
  }

  function setHover(knob) {
    if (hover === knob) return;
    if (hover && hover !== drag) hover.liftTo = 0;
    hover = knob;
    if (knob && knob !== drag) knob.liftTo = 0.006;
    stage.classList.toggle('knob-hover', !!knob);
    wake();
  }

  const setDragging = (on) => {
    stage.classList.toggle('knob-drag', on);
    document.documentElement.classList.toggle('knob-drag', on);
  };

  function dragTo(e) {
    const p = angleAround(drag, e);
    if (p.radius > 6) {   // near the centre the angle is noise
      const delta = Math.atan2(Math.sin(p.angle - drag.angle), Math.cos(p.angle - drag.angle));
      drag.angle = p.angle;
      const before = drag.turn, detent = drag.detent || DETENT;
      drag.turn += delta;
      if (drag.min !== undefined) drag.turn = Math.min(drag.max, Math.max(drag.min, drag.turn));   // the end stops
      // the value follows the clicks crossed; clockwise (negative angle) counts up, as on hardware
      const clicks = Math.round(-drag.turn / detent) - Math.round(-before / detent);
      if (clicks !== 0 && !drag.step(clicks, drag)) drag.turn = before;   // at a stop: the knob holds
    }
    wake();
  }

  lifecycle.onWindow('pointermove', (e) => {
    if (drag) { dragTo(e); return; }
    if (e.pointerType === 'mouse') {
      // over a device the pinned layer takes the pointer, so content hidden behind it can't be hovered or clicked
      stage.style.pointerEvents = picker.overDevice(e) ? 'auto' : '';
      setHover(pick(e));
    }
  }, { passive: true });

  lifecycle.onWindow('pointerdown', (e) => {
    const knob = pick(e);
    if (!knob || e.button > 0) return;
    e.preventDefault();
    drag = knob;
    drag.angle = angleAround(knob, e).angle;
    drag.liftTo = -0.01;   // press: the cap sinks a hair into its seat
    setDragging(true);
    wake();
  }, true);

  function release(e) {
    if (!drag) return;
    drag.turn = snapToDetent(drag.turn, drag.detent || DETENT);   // settle into the nearest click
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

  // a wheel or trackpad over a knob clicks it round one detent at a time, instead of scrolling the page
  let wheelSum = 0, wheelLockedUntil = 0;
  lifecycle.onWindow('wheel', (e) => {
    const knob = pick(e);
    if (!knob) { wheelSum = 0; return; }
    e.preventDefault();
    const now = performance.now();
    if (now < wheelLockedUntil) return;   // one click per flick: a trackpad's glide doesn't skip sections
    wheelSum += e.deltaMode ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(wheelSum) < WHEEL_CLICK) return;
    const direction = Math.sign(wheelSum);
    wheelSum = 0;
    wheelLockedUntil = now + WHEEL_LOCK_MS;
    const detent = knob.detent || DETENT;
    if (knob.step(direction, knob)) knob.turn = snapToDetent(knob.turn, detent) - direction * detent;   // down / towards you turns it clockwise
    wake();
  }, { passive: false });

  // on touch, a finger that lands on a knob turns it instead of scrolling the page
  lifecycle.onWindow('touchstart', (e) => {
    if (e.touches.length === 1 && pick(e.touches[0])) e.preventDefault();
  }, { passive: false });

  return {
    /** the knob under a pointer event, if any */
    pick,

    /** ease the caps into their detents; true while anything is still moving */
    step(dt) {
      let busy = false;
      const k = 1 - Math.exp(-dt * (reduce.matches ? 60 : 22));
      knobs.forEach((o) => {
        // while held the cap tracks the finger exactly; let go and it eases into the detent
        o.shown = drag === o ? o.turn : o.shown + (o.turn - o.shown) * k;
        o.lift += (o.liftTo - o.lift) * k;
        if (Math.abs(o.turn - o.shown) > 1e-4 || Math.abs(o.liftTo - o.lift) > 1e-5) busy = true;
        const cap = o.k.userData.cap;
        cap.rotation.z = o.shown;
        cap.position.z = o.home + o.lift;
      });
      return busy || !!drag;
    },
  };
}
