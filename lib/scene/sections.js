/* The page sections the grey unit's first knob steps through. */
import * as THREE from 'three';

export const SECTION_IDS = ['flow', 'work', 'experience', 'github', 'skills', 'contact'];

// what the grey unit's screen prints for each stop (one or two lines)
export const SECTION_NAMES = [['INTRO'], ['SELECTED', 'WORK'], ['EXPERIENCE'], ['CONTRIBUTIONS'], ['SKILLS &', 'TOOLS'], ['CONTACT']];

/** the knob is a detented selector: `n` stops, `step` apart, the first at `a0`; `at` is the stop it is set to */
export function createSelection() {
  const n = SECTION_IDS.length;
  const step = THREE.MathUtils.degToRad(48);
  return { n, step, a0: (step * (n - 1)) / 2, at: 0 };   // the sweep is centred on twelve o'clock
}
