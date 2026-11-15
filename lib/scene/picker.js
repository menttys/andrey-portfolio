/* Ray picking against the hero canvas: what is under a pointer event. */
import * as THREE from 'three';

export function createPicker({ canvas, camera, groups }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function aimAt(e) {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  return {
    /** the first of `objects` under the pointer, or undefined */
    hit(e, objects, recursive = false) {
      aimAt(e);
      return ray.intersectObjects(objects, recursive)[0];
    },

    overDevice(e) {
      aimAt(e);
      return ray.intersectObjects(groups, true).length > 0;
    },

    /** which unit is under the pointer, and where on its face (-1..1 each way) */
    deviceAt(e) {
      aimAt(e);
      const hit = ray.intersectObjects(groups, true)[0];
      if (!hit) return null;
      let group = hit.object;
      while (group && !groups.includes(group)) group = group.parent;
      const rest = group.userData.rest, local = group.worldToLocal(hit.point.clone());
      const clamp = (n) => Math.max(-1, Math.min(1, n));
      return { group, u: clamp(local.x / (rest.w / 2)), v: clamp(local.y / (rest.h / 2)) };
    },
  };
}
