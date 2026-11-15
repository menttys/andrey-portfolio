/* The small captions at the right of each section head get the same ink as the header: drawn at the caption's 34px,
   softened through the GPU like the header caption (through the hero's renderer, see inkTarget.js), then shown at
   the 11px the page already uses for them. */
import * as THREE from 'three';
import { canvasTexture } from './textures.js';
import { setLetterSpacing, MONO, PAPER_INK } from './draw.js';
import { pixelRatio } from './stage.js';
import { renderToCanvas } from './inkTarget.js';

const FONT = `400 34px ${MONO}`;
const SPACING = '2.7px';
const TEXTURE_H = 64;
const TEXTURE_PX_PER_CSS_PX = 34 / 11;

export function inkSectionHeads(lifecycle, renderer) {
  const heads = [...document.querySelectorAll('.index-head > .mono')];
  if (!heads.length) return;

  const dpr = pixelRatio();
  const scene = new THREE.Scene();
  const measure = document.createElement('canvas').getContext('2d');

  heads.forEach((element) => {
    const text = (element.dataset.ink || element.textContent).trim().toUpperCase();
    measure.font = FONT;
    setLetterSpacing(measure, SPACING);
    const textW = Math.ceil(measure.measureText(text).width + 10);
    const texW = 2 ** Math.ceil(Math.log2(textW));   // a power-of-two texture, like the header's 512: same mipmaps, same softening

    const tex = canvasTexture(texW, TEXTURE_H), g = tex.ctx;
    g.fillStyle = PAPER_INK;
    g.font = FONT;
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    setLetterSpacing(g, SPACING);
    g.fillText(text, texW - 4, 34);
    tex.texture.needsUpdate = true;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(texW, TEXTURE_H),
      new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true, depthWrite: false, toneMapped: false }),
    );
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-texW / 2, texW / 2, TEXTURE_H / 2, -TEXTURE_H / 2, 0.1, 10);
    camera.position.z = 1;

    // render the whole texture, keep only the right-hand part the text is in
    const fullW = texW / TEXTURE_PX_PER_CSS_PX, h = TEXTURE_H / TEXTURE_PX_PER_CSS_PX, w = textW / TEXTURE_PX_PER_CSS_PX;
    const source = renderToCanvas(renderer, scene, camera, fullW * dpr, h * dpr);
    const out = document.createElement('canvas');
    out.width = Math.round(w * dpr);
    out.height = Math.round(h * dpr);
    out.style.width = (out.width / dpr).toFixed(2) + 'px';
    out.style.height = (out.height / dpr).toFixed(2) + 'px';
    out.className = 'inkcap';
    out.setAttribute('aria-hidden', 'true');
    out.getContext('2d').drawImage(source, source.width - out.width, 0, out.width, source.height, 0, 0, out.width, out.height);

    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    tex.texture.dispose();

    element.appendChild(out);
    element.classList.add('inked');
    lifecycle.onCleanup(() => { out.remove(); element.classList.remove('inked'); });
  });

}
