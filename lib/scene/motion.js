/* The units' idle float and touch response.
   Idle: each unit drifts a few hundredths of a unit off the paper and rocks by a fraction of a degree, on slow
   unrelated periods. Touch: a unit that is hovered rises a little and leans under the pointer; pressed, it rises
   further, dips where the finger is and wobbles on a loose spring before settling.
   All of it goes through `apply`, so the paper shadow gets the same height and tilt: it slides down-right, spreads,
   softens and lightens as the unit comes up, and follows each wobble. */

const TAU = Math.PI * 2;

const TOUCH = { hover: { lift: 0.04, tilt: 0.007 }, press: { lift: 0.13, tilt: 0.02 }, k: 85, c: 4.6 };

// per unit: float height and period, rock angle and period, phase
const FLOAT_TUNING = [
  { amp: 0.034, per: 7.3, ph: 0.0, rock: 0.0032, rp: 9.1 },
  { amp: 0.028, per: 8.6, ph: 2.1, rock: 0.0026, rp: 10.7 },
];

const spring = () => ({ x: 0, v: 0, to: 0 });

export function createMotion(groups, reduce) {
  const floats = groups.map((group, i) => ({
    group,
    ...FLOAT_TUNING[i],
    touch: { lift: spring(), rx: spring(), ry: spring() },
  }));
  let fade = reduce.matches ? 0 : 1;   // eases the motion in and out instead of stopping dead
  let time = 0;

  return {
    floats,
    floatOf: (group) => floats.find((f) => f.group === group),

    /** advance the idle clock; false once the motion has faded out and nothing needs animating */
    advance(dt) {
      const floating = !reduce.matches || fade > 0.001;
      if (floating) {
        time += dt;
        fade += ((reduce.matches ? 0 : 1) - fade) * (1 - Math.exp(-dt * 1.5));
      }
      return floating;
    },

    /** point a unit's touch springs at hover / press (or null to let go); u, v are -1..1 across its face */
    aim(f, mode, u = 0, v = 0) {
      const target = mode && !reduce.matches ? TOUCH[mode] : null;
      f.touch.lift.to = target ? target.lift : 0;
      f.touch.ry.to = target ? target.tilt * u : 0;   // the side under the pointer goes down, the far side comes up
      f.touch.rx.to = target ? -target.tilt * v : 0;
    },

    /** step the touch springs; true while any is still moving */
    settle(dt) {
      let busy = false;
      floats.forEach((f) => {
        for (const key in f.touch) {
          const s = f.touch[key];
          if (reduce.matches) { s.x = s.v = s.to = 0; continue; }
          for (let i = 0; i < 4; i++) {
            s.v += (TOUCH.k * (s.to - s.x) - TOUCH.c * s.v) * dt / 4;
            s.x += s.v * dt / 4;
          }
          const tolerance = key === 'lift' ? 1e-4 : 1e-5;
          if (Math.abs(s.to - s.x) > tolerance || Math.abs(s.v) > tolerance * 10) busy = true;
          else { s.x = s.to; s.v = 0; }
        }
      });
      return busy;
    },

    /** pose every unit, and its paper shadow, for the current time and touch */
    apply() {
      floats.forEach((f) => {
        const rest = f.group.userData.rest, T = f.touch;
        const rx = fade * f.rock * Math.sin(TAU * time / f.rp + f.ph * 1.7) + T.rx.x;
        const ry = fade * f.rock * 0.8 * Math.sin(TAU * time / (f.rp * 1.31) + f.ph) + T.ry.x;
        // 0 .. amp, touching the paper at the bottom of the cycle; plus whatever the rock needs so no corner dips into it
        const hover = fade * f.amp * 0.5 * (1 - Math.cos(TAU * time / f.per + f.ph))
          + Math.max(0, T.lift.x) + Math.abs(rx) * rest.h / 2 + Math.abs(ry) * rest.w / 2;
        f.group.rotation.set(rest.rx + rx, rest.ry + ry, 0, 'YXZ');
        f.group.position.set(rest.pos.x, rest.pos.y, rest.pos.z + hover);

        const u = rest.shadow.material.uniforms;
        u.hov.value = hover;
        u.lift.value = rest.w * Math.sin(Math.abs(rest.ry + ry));
        u.liftY.value = rest.h * Math.sin(Math.abs(rest.rx + rx));
      });
    },
  };
}
