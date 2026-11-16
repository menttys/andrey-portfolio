/* The first knob's effect on the page: each detent brings the next section up to sit just under the devices.
   The slide is a transform plus an equal negative margin, so the page's own scroll length shrinks to match. */
import * as THREE from 'three';
import { SECTION_IDS } from './sections.js';

const GAP_BELOW_DEVICES = 36;   // px between the devices' lower edge and the section's heading

export function createSectionSlider({ canvas, camera, devices, selection, lifecycle, reduce, onSelect, wake }) {
  const sections = SECTION_IDS.map((id) => document.getElementById(id));
  const flow = document.getElementById('flow');
  const bounds = new THREE.Box3();
  const foot = new THREE.Vector3();

  let slid = 0;      // how far the page has slid up now
  let slideTo = 0;   // and where it is heading

  const maxSlide = () => Math.max(0, flow.offsetHeight + slid - innerHeight * 0.45);

  function slide(y) {
    slid = Math.min(maxSlide(), Math.max(0, y));
    flow.style.transform = slid ? `translateY(${-slid}px)` : '';
    flow.style.marginBottom = slid ? `${-slid}px` : '';
  }

  // how far to slide so section i's top lands a little under the devices' lower edge (both measured on screen, so
  // the page's own scroll position drops out)
  function slideFor(i) {
    if (!i) return 0;
    bounds.makeEmpty();
    devices.forEach((d) => bounds.union(new THREE.Box3().setFromObject(d)));
    foot.set(0, bounds.min.y, bounds.max.z).project(camera);
    const box = canvas.getBoundingClientRect();
    const devicesBottom = box.top + (1 - foot.y) / 2 * box.height;
    const flowTop = flow.getBoundingClientRect().top + slid;
    return Math.max(0, flowTop + sections[i].firstElementChild.offsetTop - devicesBottom - GAP_BELOW_DEVICES);   // its heading, not its padding
  }

  lifecycle.onWindow('resize', () => { slideTo = slideFor(selection.at); slide(slideTo); });

  return {
    /** go to section i; false at either end, where the knob holds */
    select(i) {
      if (i < 0 || i >= selection.n || i === selection.at) return false;
      selection.at = i;
      slideTo = slideFor(i);
      onSelect(i);
      wake();
      return true;
    },

    /** the content follows the selector with a little weight behind it; true while it is still moving */
    step(dt) {
      if (Math.abs(slideTo - slid) > 0.5) {
        slide(slid + (slideTo - slid) * (1 - Math.exp(-dt * (reduce.matches ? 60 : 7))));
        return true;
      }
      if (slid !== Math.min(maxSlide(), slideTo)) slide(slideTo);
      return false;
    },
  };
}
