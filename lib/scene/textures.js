/* Canvas-drawn textures and the cast-resin material. */
import * as THREE from 'three';
import { budget } from './budget.js';

/** a small seeded random generator, so the textures come out the same on every load */
export function seededRandom(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** a canvas, its 2D context and a texture that shows it.
    `scale` < 1 makes a smaller canvas whose context is pre-scaled, so callers still draw in w x h coordinates. */
export function canvasTexture(w, h, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable (canvas memory limit?)');
  if (scale !== 1) ctx.scale(canvas.width / w, canvas.height / h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = budget.anisotropy;
  return { canvas, ctx, texture };
}

const SIZE = 1024;

// tonal clouding, drawn into the colour map
function paintClouds(ctx, random, strength) {
  for (let i = 0; i < 70; i++) {
    const px = random() * SIZE, py = random() * SIZE, radius = 60 + random() * 160;
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    const alpha = strength * (0.5 + random() * 0.5);
    gradient.addColorStop(0, random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }
}

// fine pores, in both the colour map and the bump map
function paintPores(colour, bump, random, strength) {
  for (let i = 0; i < 42000; i++) {
    const px = random() * SIZE, py = random() * SIZE, light = random() > 0.5;
    colour.fillStyle = light ? `rgba(255,255,255,${strength})` : `rgba(0,0,0,${strength})`;
    colour.fillRect(px, py, 1.4, 1.4);
    bump.fillStyle = light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
    bump.fillRect(px, py, 1.6, 1.6);
  }
}

// sparse irregular chips (dark for concrete, pale for the green resin)
function paintChips(colour, bump, random, o) {
  for (let i = 0; i < o.chips; i++) {
    const px = random() * SIZE, py = random() * SIZE;
    const size = 1.2 + Math.pow(random(), 2.2) * o.chipSize;
    const sides = 5 + Math.floor(random() * 3);
    const rotation = random() * 6.28;
    const trace = (ctx) => {
      ctx.beginPath();
      for (let j = 0; j < sides; j++) {
        const angle = rotation + (j / sides) * 6.283, radius = size * (0.45 + random() * 0.75);
        ctx[j ? 'lineTo' : 'moveTo'](px + Math.cos(angle) * radius * 1.25, py + Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
    };
    colour.fillStyle = o.chipColor; trace(colour);
    bump.fillStyle = o.chipBump;    trace(bump);
  }
}

/** cast material: tonal clouding, fine pores and chips, with a matching bump map */
export function castMaterial(base, seed, o) {
  // painted in SIZE x SIZE coordinates; on phones into a smaller canvas (see budget.js)
  const { canvas: colourCanvas, ctx: colour } = canvasTexture(SIZE, SIZE, budget.castSize / SIZE);
  const { canvas: bumpCanvas, ctx: bump } = canvasTexture(SIZE, SIZE, budget.castSize / SIZE);
  const random = seededRandom(seed);

  colour.fillStyle = base; colour.fillRect(0, 0, SIZE, SIZE);
  bump.fillStyle = '#808080'; bump.fillRect(0, 0, SIZE, SIZE);
  paintClouds(colour, random, o.cloud);
  paintPores(colour, bump, random, o.pore);
  paintChips(colour, bump, random, o);

  const map = new THREE.CanvasTexture(colourCanvas);
  map.encoding = THREE.sRGBEncoding;
  map.anisotropy = Math.min(8, budget.anisotropy);
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, bumpMap: new THREE.CanvasTexture(bumpCanvas), bumpScale: o.bump,
    roughness: o.rough, clearcoat: o.coat ?? 0, clearcoatRoughness: 0.45, envMapIntensity: o.env ?? 0.55,
  });
}
