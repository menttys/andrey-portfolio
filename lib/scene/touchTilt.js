/* A unit that is hovered or pressed leans under the pointer (see motion.js for the springs).
   A knob takes its own press, so the unit stays steady under the hand. */

export function createTouchTilt({ picker, motion, pickKnob, lifecycle, reduce, wake }) {
  let pressed = null;   // the unit being held
  let over = null;      // the unit under a mouse pointer

  lifecycle.onWindow('pointermove', (e) => {
    if (reduce.matches) return;
    const d = picker.deviceAt(e);
    if (pressed) {
      if (d && motion.floatOf(d.group) === pressed) motion.aim(pressed, 'press', d.u, d.v);
      wake();
      return;
    }
    if (e.pointerType !== 'mouse') return;

    const f = d ? motion.floatOf(d.group) : null;
    if (over && over !== f) motion.aim(over, null);
    if (f) {
      if (over !== f) {   // a small start as the pointer arrives
        f.touch.lift.v += 0.25;
        f.touch.ry.v += 0.05 * d.u;
        f.touch.rx.v -= 0.05 * d.v;
      }
      motion.aim(f, 'hover', d.u, d.v);
    }
    if (over !== f || f) wake();
    over = f;
  }, { passive: true });

  lifecycle.onWindow('pointerdown', (e) => {
    if (reduce.matches || e.button > 0) return;
    const d = picker.deviceAt(e);
    if (!d) return;
    if (pickKnob(e)) return;
    pressed = motion.floatOf(d.group);
    motion.aim(pressed, 'press', d.u, d.v);
    // the tap itself: a push down at the finger, so the unit rocks back past level
    const T = pressed.touch;
    T.lift.v -= 0.35;
    T.ry.v += 0.22 * d.u;
    T.rx.v -= 0.22 * d.v;
    wake();
  }, true);

  function letGo(e) {
    if (!pressed) return;
    const d = e.pointerType === 'mouse' ? picker.deviceAt(e) : null;
    if (d && motion.floatOf(d.group) === pressed) {
      motion.aim(pressed, 'hover', d.u, d.v);
      over = pressed;
    } else {
      motion.aim(pressed, null);
      if (over === pressed) over = null;
    }
    pressed = null;
    wake();
  }
  lifecycle.onWindow('pointerup', letGo);
  lifecycle.onWindow('pointercancel', letGo);

  lifecycle.on(document, 'mouseleave', () => {
    if (over && !pressed) { motion.aim(over, null); over = null; wake(); }
  });

  // the units sit over the page: a click on one never reaches what is behind it
  lifecycle.onWindow('click', (e) => {
    if (picker.overDevice(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}
