/* The inked captions (header line and section heads) are drawn through the hero's own renderer into an offscreen
   target and copied into plain 2D canvases. They used to have WebGL renderers of their own; every extra WebGL
   context costs graphics memory, which is what iOS runs out of. Same texture, mipmaps and filtering as before, so
   the ink softens into the paper the same way. */
import * as THREE from 'three';

/** Renders `scene` through `camera` at w x h device pixels and returns a 2D canvas holding the result. */
export function renderToCanvas(renderer, scene, camera, w, h, into = document.createElement('canvas')) {
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  const max = renderer.capabilities.maxTextureSize;
  if (!(w <= max && h <= max)) return into;   // a size from a camera that isn't aimed yet
  const target = new THREE.WebGLRenderTarget(w, h, {
    encoding: THREE.sRGBEncoding,     // the target's encoding is what r128 writes, like outputEncoding on screen
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
  });
  const pixels = new Uint8Array(w * h * 4);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  renderer.setRenderTarget(previous);
  target.dispose();

  // GL rows run bottom-up and the blend left the colour premultiplied by alpha; ImageData wants neither
  const image = new ImageData(w, h), out = image.data, row = w * 4;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * row, dst = y * row;
    for (let x = 0; x < row; x += 4) {
      const a = pixels[src + x + 3];
      if (!a) continue;
      const k = 255 / a;
      out[dst + x] = Math.min(255, Math.round(pixels[src + x] * k));
      out[dst + x + 1] = Math.min(255, Math.round(pixels[src + x + 1] * k));
      out[dst + x + 2] = Math.min(255, Math.round(pixels[src + x + 2] * k));
      out[dst + x + 3] = a;
    }
  }
  into.width = w;
  into.height = h;
  into.getContext('2d').putImageData(image, 0, 0);
  return into;
}
