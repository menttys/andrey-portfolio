/* One unit or two. At phone widths (760px and under, the page's own breakpoint) the hero shows one unit at a time,
   framed larger so its knobs are big enough to turn with a finger, and the two buttons under it (#unit-switch)
   slide the other one in. On wider screens both sit side by side as before.

   Only the shown unit is drawn, so on a phone the hidden one's textures are never sent to the GPU until it is
   picked, and are released again once it has slid away (the canvases they are painted on stay, so showing it
   again just re-uploads them). Materials shared with the open-to-work unit are left alone. */

export const PHONE = '(max-width: 760px)';
const OFFSTAGE = 9;   // scene units: far enough left or right that a unit and its shadow are out of any phone framing

/** `units` are [{ group, x }] with `x` where each rests side by side; `keep` lists materials not to release */
export function createUnits({ units, stage, lifecycle, reduce, keep = [], onLayout, wake }) {
  const phone = matchMedia(PHONE);
  const buttons = [...document.querySelectorAll('#unit-switch [data-unit]')];
  let single = phone.matches;
  let active = 0;

  const state = units.map(({ group, x }) => ({
    group,
    shadow: group.userData.rest.shadow,
    home: x,
    // the rest pose and the shadow, relative to the unit's own x
    pos: group.userData.rest.pos.x - x,
    shadowAt: group.userData.rest.shadow.position.x - x,
    x,
    to: x,
  }));

  function place(s, x) {
    s.x = x;
    s.group.userData.rest.pos.x = x + s.pos;
    s.shadow.position.x = x + s.shadowAt;
  }

  function show(s, on) {
    if (s.group.visible === on) return;
    s.group.visible = on;
    s.shadow.visible = on;
    if (!on && single) release(s.group);
  }

  // drop a hidden unit's textures from the GPU; three.js uploads them again from their canvases if it comes back
  function release(group) {
    group.traverse((o) => {
      const materials = o.material ? [].concat(o.material) : [];
      materials.forEach((m) => {
        if (keep.includes(m)) return;
        [m.map, m.bumpMap].forEach((t) => t?.dispose());
      });
    });
  }

  function target(i) {
    if (!single) return state[i].home;
    if (i === active) return 0;
    return i < active ? -OFFSTAGE : OFFSTAGE;
  }

  // jump straight to the layout for the current width (on load, and when the page crosses the breakpoint)
  function layout() {
    single = phone.matches;
    stage.dataset.units = single ? 'one' : 'two';
    state.forEach((s, i) => {
      s.to = target(i);
      place(s, s.to);
      show(s, !single || i === active);
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.unit) === active)));
    onLayout();
    wake();
  }

  function select(i) {
    if (i === active || !state[i]) return;
    active = i;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.unit) === active)));
    if (!single) return;
    state.forEach((s, j) => {
      s.to = target(j);
      if (j === active) {
        // the new unit comes in from its own side
        place(s, j === 0 ? -OFFSTAGE : OFFSTAGE);
        show(s, true);
      }
    });
    if (reduce.matches) state.forEach((s, j) => { place(s, s.to); show(s, j === active); });
    wake();
  }

  buttons.forEach((b) => lifecycle.on(b, 'click', () => select(Number(b.dataset.unit))));
  lifecycle.on(phone, 'change', layout);
  lifecycle.onCleanup(() => {
    delete stage.dataset.units;
    buttons.forEach((b) => b.removeAttribute('aria-pressed'));
  });
  layout();

  return {
    /** true while only one unit is shown */
    get single() { return single; },

    /** the units on screen now */
    shown: () => state.filter((s) => s.group.visible).map((s) => s.group),

    /** slide the units toward their places; true while one is still moving */
    step(dt) {
      let busy = false;
      const k = 1 - Math.exp(-dt * 8);
      state.forEach((s, j) => {
        if (s.x === s.to) return;
        const next = Math.abs(s.to - s.x) < 0.003 ? s.to : s.x + (s.to - s.x) * k;
        place(s, next);
        if (next === s.to) { if (single && j !== active) show(s, false); }
        else busy = true;
      });
      return busy;
    },
  };
}
