/* Where the units rest on the paper.
   A slight turn about the vertical axis: each unit rests on one long edge and the other lifts off the paper.
   Geometry, materials and screens are untouched; only the group's pose changes. */
import * as THREE from 'three';
import { paperShadow } from './paperShadow.js';

export const PAPER_Z = -0.285;   // back face of the rims when flat

const degrees = (query, name, fallback) => THREE.MathUtils.degToRad(parseFloat(query.get(name) ?? fallback));

/** the hero's tilts, in radians. ?l=, ?r= (turn of each unit) and ?x= (tip) override them for tuning. */
export function readTilts() {
  const query = new URLSearchParams(location.search);
  return {
    left: degrees(query, 'l', '-12'),
    right: degrees(query, 'r', '-12'),
    // tip about the horizontal axis: the bottom edge lifts toward the viewer so its wall shows
    tip: degrees(query, 'x', '-10'),
  };
}

/** turn a unit, rest its rim on the paper at `x`, and give it a paper shadow. `w` x `h` is the rim's size, `radius` its corner. */
export function restOnPaper({ scene, group, rim, x, turn, tip, w, h, radius }) {
  group.rotation.set(tip, turn, 0, 'YXZ');
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);

  const back = new THREE.Box3().setFromObject(rim);
  group.position.set(x - (back.min.x + back.max.x) / 2, -(back.min.y + back.max.y) / 2, PAPER_Z - back.min.z);

  // the rim's back face, after the turn, spans this footprint on the paper and rises by `lift` across it
  const footprintW = w * Math.cos(Math.abs(turn)), lift = w * Math.sin(Math.abs(turn));
  const footprintH = h * Math.cos(Math.abs(tip)), liftY = h * Math.sin(Math.abs(tip));
  const shadow = paperShadow(scene, x, footprintW, footprintH, radius, lift, turn < 0 ? 1 : -1, liftY);

  group.userData.rest = { pos: group.position.clone(), rx: tip, ry: turn, w, h, shadow };
}
