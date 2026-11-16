/* Where the green unit sits on the page (or the grey one, when a phone shows only that), for the DOM around it: the
   proof marks' pencil note follows it.
   Sends `proof:anchor` with the unit's projected box in document px ({ left, top, right, bottom }) whenever it moves
   by more than a pixel, and keeps the last one on window.__proofAnchor for anything that mounts later. */
import * as THREE from 'three';

const corner = new THREE.Vector3();

/** `groups` in order of preference; the first one shown is followed */
export function createProofAnchor({ canvas, camera, groups }) {
  let last = null;
  return function publish() {
    const group = groups.find((g) => g.visible);
    if (!group) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    // each mesh's own box, turned with it: much tighter on screen than one axis-aligned box around the tilted unit
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    group.updateMatrixWorld();
    group.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).project(camera);
        const x = r.left + (corner.x + 1) / 2 * r.width, y = r.top + (1 - corner.y) / 2 * r.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    });
    if (!(x1 > x0)) return;
    const next = { left: x0 + scrollX, top: y0 + scrollY, right: x1 + scrollX, bottom: y1 + scrollY };
    if (last && ['left', 'top', 'right', 'bottom'].every((k) => Math.abs(next[k] - last[k]) <= 1)) return;
    last = next;
    window.__proofAnchor = next;
    dispatchEvent(new CustomEvent('proof:anchor', { detail: next }));
  };
}
