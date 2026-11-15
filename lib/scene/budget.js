/* How much GPU and canvas memory the scene may use.
   Phones and tablets (a coarse pointer) get a lighter build: iOS kills a tab that holds too much graphics memory, and
   the full build (2048 shadows, 1024 cast textures, 2x antialiased buffers) was enough to do that on an iPhone.
   The look stays the same at phone size: the shadows keep their softness (VSM radius scales with the map), and the
   textures are still more than twice the pixels they cover on screen.

   ?gl=full or ?gl=lite forces either build for testing; ?gl=off shows the static fallback instead of the 3D. */

const query = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('gl');
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const GL_MODE = query === 'off' ? 'off' : query === 'full' ? 'full' : query === 'lite' ? 'lite' : coarse ? 'lite' : 'full';
const LITE = GL_MODE === 'lite';

export const budget = {
  lite: LITE,
  maxPixelRatio: LITE ? 1.5 : 2,
  antialias: true,                  // tried off on phones: the device edges stair-step visibly, for little memory saved
  mainShadow: LITE ? { mapSize: 1024, radius: 11 } : { mapSize: 2048, radius: 22 },
  smallShadow: LITE ? { mapSize: 512, radius: 6 } : { mapSize: 1024, radius: 12 },
  castSize: LITE ? 512 : 1024,
  screenScale: LITE ? 0.5 : 1,     // the painted screens and printed decals on the devices
  anisotropy: LITE ? 4 : 16,
};
