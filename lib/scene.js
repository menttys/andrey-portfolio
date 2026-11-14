/* The hero scene: the two 3D devices, the open-to-work unit, the inked captions and the header weather line.
   Ported as-is from the approved prototype (prototype/saved/2026-11-14-github-commits/home.html), with three.js
   0.128 from npm instead of the CDN. startScene() runs once on the client after the page's markup is mounted and
   returns nothing; aborting `signal` tears everything down (listeners, frames, timers, observers, renderers and
   the page styles the knobs set), so a remount or a hot reload starts clean. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export async function startScene(signal) {
  /* ---------- teardown plumbing ---------- */
  const undo = [], renderers = [], observers = [];
  const withSig = (o) => (o === true ? { capture: true, signal } : { ...(o || {}), signal });
  const on = (target, type, fn, o) => target.addEventListener(type, fn, withSig(o));
  const addEventListener = (type, fn, o) => on(window, type, fn, o);
  const requestAnimationFrame = (fn) => window.requestAnimationFrame((t) => { if (!signal.aborted) fn(t); });
  const setTimeout = (fn, ms) => window.setTimeout(() => { if (!signal.aborted) fn(); }, ms);
  class ResizeObserver extends window.ResizeObserver { constructor(cb) { super(cb); observers.push(this); } }
  class IntersectionObserver extends window.IntersectionObserver { constructor(cb, o) { super(cb, o); observers.push(this); } }
  const track = (r) => { renderers.push(r); return r; };
  signal.addEventListener('abort', () => {
    observers.forEach((o) => o.disconnect());
    renderers.forEach((r) => r.dispose());
    undo.forEach((f) => f());
    const html = document.documentElement;
    html.classList.remove('knob-drag'); html.style.removeProperty('--wght'); html.style.removeProperty('--paper');
    const wash = document.getElementById('wash'); if (wash) wash.replaceChildren();
    const dim = document.getElementById('dim'); if (dim) { dim.className = ''; dim.style.opacity = ''; }
    const flow = document.getElementById('flow'); if (flow) { flow.style.transform = ''; flow.style.marginBottom = ''; }
    const stage = document.getElementById('stage'); if (stage) { stage.style.pointerEvents = ''; stage.classList.remove('knob-hover', 'knob-drag'); }
  }, { once: true });

  const canvas = document.getElementById('gl');
  if (!canvas) return;
  const renderer = track(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  if (RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  const camera = new THREE.PerspectiveCamera(11, 1, 0.1, 400);

  // big soft key from the upper left: short shadows on the faces, a broad soft one on the paper
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(-1.6, 6.5, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 22;
  key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 40 });
  scene.add(key);

// paper shadow, fitted to the reference photo: darkest at the lower and right edges, fading over about one unit, none above or left.
  // It lies on the paper (scene space), so it does not turn with the device. With a Y tilt one long edge lifts off the paper:
  // the shadow under that edge falls further down and to the right and goes softer and lighter, as the key light requires.
  function paperShadow(cx, w, h, r, lift, side, liftY, into = scene, spread = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 12, h + 12), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { hs: { value: new THREE.Vector2(w / 2, h / 2) }, rad: { value: r }, lift: { value: lift }, side: { value: side }, liftY: { value: liftY }, hov: { value: 0 }, spread: { value: spread } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vP; uniform vec2 hs; uniform float rad; uniform float lift; uniform float side; uniform float liftY; uniform float hov; uniform float spread;
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          float u = clamp(vP.x / hs.x, -1.0, 1.0);
          float v = clamp(vP.y / hs.y, -1.0, 1.0);
          float hgt = lift * (0.5 + 0.5 * u * side) + liftY * (0.5 - 0.5 * v) + hov;   // height of the device's back above the paper here
          vec2 p = vP - vec2(0.2 + 0.145 * hgt, -0.38 - 0.59 * hgt);   // the key light's direction, projected onto the paper
          float kx = 1.6;                            // tighter falloff sideways than downwards
          float d = sdRound(vec2(p.x * kx, p.y), vec2(hs.x * kx, hs.y), rad);
          float soft = (0.14 + 0.32 * hgt) * spread;    // spread < 1 keeps a small unit's shadow in proportion
          float a = max(0.0, 0.63 - 0.22 * hgt) / (1.0 + exp(d / soft));
          a *= 1.0 - smoothstep(0.4 * spread, 2.6 * spread, d);         // the soft tail reaches zero well inside the plane, so no edge ever shows
          gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        }`,
    }));
    m.position.set(cx, 0, -0.3); m.renderOrder = -1; into.add(m);
    return m;
  }

  /* ---------- helpers ---------- */
  function rr(w, h, r) {
    // corners drawn with long-handled cubics: reads as a squircle, flatter sides and firmer corners than a plain arc
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2, k = 0.36 * r;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.bezierCurveTo(x + w - k, y, x + w, y + k, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.bezierCurveTo(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.bezierCurveTo(x + k, y + h, x, y + h - k, x, y + h - r);
    s.lineTo(x, y + r); s.bezierCurveTo(x, y + k, x + k, y, x + r, y);
    return s;
  }
  function slab(w, h, r, depth, bevel, seg = 5) {
    const g = new THREE.ExtrudeGeometry(rr(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel)),
      { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 48 });
    g.center();
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 4 + 0.5, p.getY(i) / 4 + 0.5);
    return g;
  }
  function roundedPlane(w, h, r) {
    const g = new THREE.ShapeGeometry(rr(w, h, r), 32);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  }
  function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  // cast material: tonal clouding, fine pores, and sparse irregular chips (dark for concrete, pale for the green resin)
  function cast(base, seed, o) {
    const N = 1024, c = document.createElement('canvas'), b = document.createElement('canvas');
    c.width = c.height = b.width = b.height = N;
    const x = c.getContext('2d'), y = b.getContext('2d'), r = rnd(seed);
    x.fillStyle = base; x.fillRect(0, 0, N, N);
    y.fillStyle = '#808080'; y.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) {            // clouding
      const px = r() * N, py = r() * N, rad = 60 + r() * 160;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      const a = o.cloud * (0.5 + r() * 0.5);
      g.addColorStop(0, r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 42000; i++) {         // pores
      const px = r() * N, py = r() * N, v = r();
      x.fillStyle = v > 0.5 ? `rgba(255,255,255,${o.pore})` : `rgba(0,0,0,${o.pore})`; x.fillRect(px, py, 1.4, 1.4);
      y.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; y.fillRect(px, py, 1.6, 1.6);
    }
    for (let i = 0; i < o.chips; i++) {       // chips
      const px = r() * N, py = r() * N, size = 1.2 + Math.pow(r(), 2.2) * o.chipSize, n = 5 + Math.floor(r() * 3), rot = r() * 6.28;
      const path = (ctx) => { ctx.beginPath(); for (let j = 0; j < n; j++) { const a = rot + (j / n) * 6.283, rad = size * (0.45 + r() * 0.75);
        ctx[j ? 'lineTo' : 'moveTo'](px + Math.cos(a) * rad * 1.25, py + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); };
      x.fillStyle = o.chipColor; path(x);
      y.fillStyle = o.chipBump; path(y);
    }
    const map = new THREE.CanvasTexture(c); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
    return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, bumpMap: new THREE.CanvasTexture(b), bumpScale: o.bump,
      roughness: o.rough, clearcoat: o.coat ?? 0, clearcoatRoughness: 0.45, envMapIntensity: o.env ?? 0.55 });
  }
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const flat = (color, rough = 0.6, extra = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: rough, envMapIntensity: 0.55 }, extra));

  function canvasTex(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 16;
    return { c, g: c.getContext('2d'), tex };
  }
  function decal(parent, ct, w, h, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.set(x, y, z); parent.add(m); return m;
  }

  // smooth machined knob: straight wall, soft shoulder, shallow dished top, pill indicator
  function knob(r, h, o) {
    const g = new THREE.Group();
    if (o.ring) {
      const ring = sh(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.09, r * 1.11, 0.05, 72), flat(0x0e0f10, 0.7, { envMapIntensity: 0.2 })));
      ring.rotation.x = Math.PI / 2; ring.position.z = 0.025; g.add(ring);
    }
    const P = (a, b) => new THREE.Vector2(a, b);
    const prof = [P(0, 0), P(r, 0), P(r, h - 0.045), P(r - 0.004, h - 0.028), P(r - 0.014, h - 0.013), P(r - 0.03, h - 0.004), P(r - 0.048, h),
      P(r - 0.064, h - 0.003), P(r * 0.62, h - 0.016), P(r * 0.3, h - 0.022), P(0, h - 0.024)];
    const mat = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: o.rough, clearcoat: o.coat, clearcoatRoughness: 0.25, envMapIntensity: o.env });
    const cap = new THREE.Group(); g.add(cap); g.userData.cap = cap;
    const body = sh(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), mat));
    body.rotation.x = Math.PI / 2; cap.add(body); g.userData.body = body;
    const pill = new THREE.Mesh(roundedPlane(r * 0.13, r * 0.3, r * 0.065), new THREE.MeshBasicMaterial({ color: o.mark, toneMapped: false }));
    const mg = new THREE.Group(); mg.rotation.z = o.angle;
    pill.position.set(0, r * 0.5, h - 0.012); mg.add(pill); cap.add(mg);
    return g;
  }

  // flush display: thin dark gasket, emissive panel, faint glass sheen
  function screen(parent, w, h, rad, x, y, z, ct) {
    const gasket = new THREE.Mesh(roundedPlane(w + 0.035, h + 0.035, rad + 0.018), flat(0x050506, 0.5, { envMapIntensity: 0.15 }));
    gasket.position.set(x, y, z + 0.002); gasket.receiveShadow = true; parent.add(gasket);
    const s = new THREE.Mesh(roundedPlane(w, h, rad), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false }));
    s.position.set(x, y, z + 0.004); parent.add(s); parent.userData.screen = s;
    const glass = new THREE.Mesh(roundedPlane(w, h, rad),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.012, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6 }));
    glass.position.set(x, y, z + 0.006); parent.add(glass);
  }

  const DISPLAY = 'Unbounded, "Arial Black", Arial, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
  await Promise.all(['200 100px Unbounded', '300 100px Unbounded', '400 100px Unbounded', '800 100px Unbounded', '900 100px Unbounded', '700 100px Unbounded', '600 100px Unbounded', '500 30px Unbounded', '400 30px Unbounded', '700 30px "JetBrains Mono"', '500 30px "JetBrains Mono"', '400 30px "JetBrains Mono"']
    .map((f) => document.fonts.load(f))).catch(() => {});
  if (signal.aborted) return;

  // text helpers: fit a string to an exact box so the layout matches whatever font metrics load
  function fitText(g, text, x, yBase, width, capHeight, font, weight, color, spacing = 0) {
    g.save(); g.fillStyle = color; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.font = `${weight} 100px ${font}`;
    const m = g.measureText(text), cap = m.actualBoundingBoxAscent || 72, wNat = m.width - spacing;
    const sy = capHeight / cap, sx = width / wNat;
    g.translate(x - (m.actualBoundingBoxLeft || 0) * sx, yBase); g.scale(sx, sy); g.fillText(text, 0, 0); g.restore();
  }
  function mono(g, text, x, y, size, color, weight = 500) {
    g.fillStyle = color; g.font = `${weight} ${size}px ${MONO}`; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
  }
  function hatch(g, x, yBottom, n, step, h, color, lw) {
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'butt';
    for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x + i * step, yBottom); g.lineTo(x + i * step + h * 0.5, yBottom - h); g.stroke(); }
  }
  function panel(g, w, h) {
    g.fillStyle = '#0B0C10'; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.8);
    v.addColorStop(0, 'rgba(255,255,255,0.03)'); v.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }

  const ORANGE = '#C8552F', OLIVE = '#8C9F33', LIME = '#D6E24A', GREY = '#8F9093', PALE = '#A9AAAE', WAVE = '#C3C8E4';

  /* ---------- left unit ---------- */
  const L = new THREE.Group(); scene.add(L);
  const lRim = sh(new THREE.Mesh(slab(3.05, 2.5, 0.5, 0.3, 0.035), flat(0xD9A77C, 0.55, { clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.35 })));
  lRim.position.z = -0.1; L.add(lRim);
  const concrete = cast('#B4B4B3', 5, { cloud: 0.05, pore: 0.035, chips: 260, chipSize: 3.6, chipColor: 'rgba(22,22,22,0.92)', chipBump: '#303030', bump: 0.006, rough: 0.8, env: 0.45 });
  L.add(sh(new THREE.Mesh(slab(2.92, 2.38, 0.45, 0.34, 0.03), concrete)));
  const lFront = 0.2;

  const lScr = canvasTex(1680, 795);          // 2.8 x 1.325 units
  const SECTION_NAMES = [['INTRO'], ['SELECTED', 'WORK'], ['EXPERIENCE'], ['CONTRIBUTIONS'], ['SKILLS &', 'TOOLS'], ['CONTACT']];
  const lState = { num: 1 };                  // big readout: the page section the first knob is set to
  // the first knob is a detented selector over the page's sections: SEL.n stops, SEL.step apart, the first at SEL.a0
  const SECTIONS = ['flow', 'work', 'experience', 'github', 'skills', 'contact'].map((id) => document.getElementById(id));
  const SEL = { n: SECTIONS.length, step: THREE.MathUtils.degToRad(48), a0: 0, at: 0 };
  SEL.a0 = SEL.step * (SEL.n - 1) / 2;       // the sweep is centred on twelve o'clock
  function drawL() {
    const g = lScr.g, W = 1680, H = 795, u = W / 1120;   // u: reference pixels -> canvas pixels
    panel(g, W, H);
    hatch(g, 82 * u, 126 * u, 21, 24 * u, 36 * u, PALE, 3.2 * u);
    fitText(g, 'PALESTRA', 686 * u, 120 * u, 350 * u, 26 * u, DISPLAY, 400, PALE);
    fitText(g, String(lState.num).padStart(2, '0'), 56 * u, 485 * u, 556 * u, 284 * u, DISPLAY, 600, ORANGE, -4);
    // the name of the section the first knob is set to, in the orange the screen used for SYSTEM LOADING
    const name = SECTION_NAMES[lState.num - 1] || SECTION_NAMES[0];
    mono(g, name[0], 692 * u, 226 * u, 36 * u, '#E0683C', 700);
    if (name[1]) mono(g, name[1], 692 * u, 266 * u, 36 * u, '#E0683C', 700);
    mono(g, 'Visual Identity', 692 * u, 452 * u, 28 * u, PALE, 500);
    mono(g, 'Matrix Online.', 692 * u, 488 * u, 28 * u, PALE, 500);
    g.strokeStyle = GREY; g.lineWidth = 9 * u; g.beginPath(); g.arc(1052 * u, 465 * u, 27 * u, 0, Math.PI * 2); g.stroke();
    lScr.tex.needsUpdate = true;
  }
  drawL();
  screen(L, 2.70, 1.26, 0.34, 0, 0.45, lFront, lScr);

  // satin control plate (full pill) with engraved arcs and wordmark
  const plateMat = (function () {
    const ct = canvasTex(1024, 512), g = ct.g, r = rnd(31);
    g.fillStyle = '#C3C4C6'; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 90; i++) {            // faint brushed smudges
      const x = r() * 1024, w = 60 + r() * 160, a = 0.008 + r() * 0.016;
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      const col = r() > 0.55 ? '0,0,0' : '255,255,255';
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x, r() * 200, w, 200 + r() * 312);
    }
    ct.tex.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: ct.tex, roughness: 0.42, metalness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.6 });
  })();
  const plateGeo = slab(2.70, 0.8, 0.4, 0.05, 0.016, 4);
  (function () { const p = plateGeo.attributes.position, uv = plateGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.70 + 0.5, p.getY(i) / 0.8 + 0.5); })();
  const plate = sh(new THREE.Mesh(plateGeo, plateMat));
  plate.position.set(0, -0.69, lFront + 0.025); L.add(plate);
  const plateTop = lFront + 0.066;

  const lInk = canvasTex(1668, 480);          // 2.78 x 0.8 at 600 px/unit
  (function () {
    const g = lInk.g, s = 600, cx = 834, cy = 240;
    g.strokeStyle = 'rgba(70,74,82,0.75)'; g.lineWidth = 2.6; g.lineCap = 'round';
    { g.beginPath(); g.arc(cx + 1.0 * s, cy, 0.4 * s, Math.PI - 0.72, Math.PI + 0.72); g.stroke(); }
    // the section selector's scale: one printed tick per page section, on a thin arc, in the same ink as the wordmark.
    // Cap angle t points the pill along (-sin t, cos t) on the plate, which is (-sin t, -cos t) on this canvas.
    const kx = cx - 1.0 * s, phi = (t) => Math.atan2(-Math.cos(t), -Math.sin(t));
    g.lineWidth = 2; g.beginPath(); g.arc(kx, cy, 0.285 * s, phi(SEL.a0), phi(SEL.a0 - SEL.step * (SEL.n - 1)), true); g.stroke();
    g.lineWidth = 3.4; g.lineCap = 'butt';
    for (let i = 0; i < SEL.n; i++) {
      const t = SEL.a0 - i * SEL.step, dx = -Math.sin(t), dy = -Math.cos(t), r1 = i === 0 || i === SEL.n - 1 ? 0.33 : 0.318;
      g.beginPath(); g.moveTo(kx + dx * 0.285 * s, cy + dy * 0.285 * s); g.lineTo(kx + dx * r1 * s, cy + dy * r1 * s); g.stroke();
    }
    fitText(g, 'ANDREY', cx - 150, cy + 15, 300, 30, DISPLAY, 500, 'rgba(58,62,70,0.9)', 10);
    lInk.tex.needsUpdate = true;
  })();
  decal(L, lInk, 2.78, 0.8, 0, -0.69, plateTop + 0.002);
  // endless encoders with detents, like the real thing: each click steps a value on the screen
  const knobs = [];
  const lBright = { v: 1 };
  [[-1.0, SEL.a0, 'scroll'],
   [1.0, 0.5, (d) => { const v = Math.min(1.15, Math.max(0.3, Math.round((lBright.v + d * 0.05) * 100) / 100)); if (v === lBright.v) return false;
     lBright.v = v; L.userData.screen.material.color.setScalar(v); setOtwBright(v);
     const dim = document.getElementById('dim'); dim.classList.toggle('up', v > 1);
     dim.style.opacity = v < 1 ? (1 - v) * 0.6 : (v - 1) * 0.5;    // 0.3 -> 42% black, 1.15 -> 7.5% white
     return true; }]].forEach(([kx, ang, step]) => {
    const k = knob(0.235, 0.24, { color: 0x1D1F28, rough: 0.42, coat: 0.5, env: 0.22, mark: '#F06A35', angle: ang });
    k.position.set(kx, -0.69, plateTop); L.add(k); knobs.push(step === 'scroll' ? { k, scroll: true, detent: SEL.step, min: -SEL.step * (SEL.n - 1), max: 0, step: (d) => selectSection(SEL.at + d) } : { k, step });
  });

  /* ---------- right unit ---------- */
  const R = new THREE.Group(); scene.add(R);
  const rRim = sh(new THREE.Mesh(slab(3.94, 2.54, 0.52, 0.3, 0.035),
    new THREE.MeshPhysicalMaterial({ color: 0xD3D8C9, roughness: 0.3, transparent: true, opacity: 0.88, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.6 })));
  rRim.position.z = -0.1; R.add(rRim);
  const olive = cast('#445219', 17, { cloud: 0.045, pore: 0.03, chips: 150, chipSize: 3.6, chipColor: 'rgba(196,205,140,0.85)', chipBump: '#b8b8b8', bump: 0.004, rough: 0.55, coat: 0.1, env: 0.28 });
  R.add(sh(new THREE.Mesh(slab(3.81, 2.41, 0.46, 0.34, 0.03), olive)));
  const rFront = 0.2;

  const rScr = canvasTex(1658, 1344);         // 2.76 x 2.24 units
  const rState = { num: 60, win: 0 };         // big readout and selection-window offset (reference px), set by the right knobs
  // the waveform doubles as a colour selector: five bands, warm to cool, with the original grey in the middle where the
  // 30S window rests. TINTS is the paper tone each band gives the page; INK is the same tone lifted for the dark screen.
  const ZONE_X0 = 70, ZONE_X1 = 1036, WIN_MID = 556;
  const TINTS = ['#EAD4C7', '#EBE5C2', '#D8D8D7', '#C9E3D6', '#DAD1EB'];   // peach, butter, grey, mint, lilac
  const INK = ['hsl(22 72% 80%)', 'hsl(52 70% 76%)', WAVE, 'hsl(150 42% 74%)', 'hsl(262 60% 82%)'];
  const zoneOf = (x) => Math.min(4, Math.max(0, Math.floor((x - ZONE_X0) / (ZONE_X1 - ZONE_X0) * 5)));
  function drawR() {
    const g = rScr.g, W = 1658, H = 1344, u = W / 1105, r = rnd(12);
    panel(g, W, H);
    // waveform
    const x0 = 70 * u, x1 = 1036 * u, mid = 232 * u, n = 70;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), x = x0 + k * (x1 - x0);
      const env = 0.25 + 0.75 * Math.abs(Math.sin(k * 9.5 + 0.6) * Math.cos(k * 3.1 - 0.4));
      const hgt = (10 + env * (40 + r() * 150)) * u;
      const z = zoneOf(x / u); g.globalAlpha = i % 5 === 2 ? 0.78 : 1;
      g.fillStyle = z === 2 && i % 5 === 2 ? '#9FA6D0' : INK[z]; g.fillRect(x - 2.2 * u, mid - hgt / 2, 4.4 * u, hgt);
    }
    // 30s selection window
    const s0 = (466 + rState.win) * u, s1 = (646 + rState.win) * u;
    g.fillStyle = 'rgba(24,26,16,0.82)'; g.fillRect(s0, 72 * u, s1 - s0, 335 * u);
    for (let i = 0; i < n; i++) {             // bars inside the window, redrawn dimmer
      const k = i / (n - 1), x = x0 + k * (x1 - x0); if (x < s0 + 6 || x > s1 - 6) continue;
      const hgt = (30 + ((i * 53) % 7) * 22) * u; const z = zoneOf(x / u); g.globalAlpha = z === 2 ? 1 : 0.85;
      g.fillStyle = z === 2 ? '#B9BED8' : INK[z]; g.fillRect(x - 2.2 * u, mid - hgt / 2, 4.4 * u, hgt);
    }
    g.globalAlpha = 1;
    const sel = zoneOf(WIN_MID + rState.win);
    g.fillStyle = sel === 2 ? LIME : INK[sel];   // the selector takes the tone it sits on; the grey band keeps the original lime
    [s0, s1].forEach((sx) => { g.fillRect(sx - 1.6 * u, 62 * u, 3.2 * u, 345 * u);
      g.beginPath(); g.moveTo(sx - 11 * u, 50 * u); g.lineTo(sx + 11 * u, 50 * u); g.lineTo(sx, 66 * u); g.fill(); });
    // the window's label reads out the paper tone it has selected
    const selZ = zoneOf(WIN_MID + rState.win);
    fitText(g, TINTS[selZ], (WIN_MID - 72 + rState.win) * u, 114 * u, 144 * u, 21 * u, DISPLAY, 400, selZ === 2 ? '#C9CCEC' : INK[selZ], 2);
    hatch(g, 76 * u, 494 * u, 21, 24 * u, 36 * u, PALE, 3.2 * u);
    fitText(g, 'PALESTRA', 680 * u, 488 * u, 350 * u, 26 * u, DISPLAY, 400, PALE);
    fitText(g, String(rState.num).padStart(2, '0'), 60 * u, 860 * u, 556 * u, 290 * u, DISPLAY, rState.num * 10, OLIVE, -4);   // the readout wears its own weight
    mono(g, 'TYPE', 685 * u, 596 * u, 36 * u, LIME, 700);
    mono(g, 'WEIGHT', 685 * u, 637 * u, 36 * u, LIME, 700);
    // a weight ladder: one A per Unbounded weight, 200 to 900; the one nearest the dial is lit, a caret marks the exact value
    const wt = rState.num * 10, near = Math.round(wt / 100) * 100;
    for (let i = 0; i < 8; i++) {
      const w = 200 + i * 100, x = (705 + i * 44) * u;   // natural proportions: the heavier the A, the wider it sits
      g.globalAlpha = w === near ? 1 : 0.42;
      g.fillStyle = w === near ? LIME : PALE; g.font = `${w} ${40 * u}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('A', x, 742 * u); g.textAlign = 'left';
    }
    g.globalAlpha = 1;
    const cx = (705 + (wt - 200) / 100 * 44) * u;
    g.fillStyle = LIME; g.beginPath(); g.moveTo(cx - 8 * u, 772 * u); g.lineTo(cx + 8 * u, 772 * u); g.lineTo(cx, 760 * u); g.fill();
    g.fillStyle = 'rgba(169,170,174,0.35)'; g.fillRect(690 * u, 776 * u, 338 * u, 2 * u);
    const NAMES = { 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
    mono(g, 'Unbounded', 685 * u, 818 * u, 28 * u, PALE, 500);
    mono(g, `${NAMES[near]} · ${wt}`, 685 * u, 853 * u, 28 * u, PALE, 500);
    rScr.tex.needsUpdate = true;
  }
  drawR();
  screen(R, 2.705, 2.17, 0.34, -0.4325, 0, rFront, rScr);

  // knob column: a shallow raised pill in the same resin, a shade deeper
  const colMat = cast('#3F4D17', 41, { cloud: 0.03, pore: 0.025, chips: 30, chipSize: 3.4, chipColor: 'rgba(196,205,140,0.8)', chipBump: '#b0b0b0', bump: 0.003, rough: 0.52, coat: 0.12, env: 0.28 });
  const col = sh(new THREE.Mesh(slab(0.8, 2.25, 0.4, 0.03, 0.012, 4), colMat));
  col.position.set(1.42, 0, rFront + 0.015); R.add(col);
  const colTop = rFront + 0.042;
  const rInk = canvasTex(480, 1350);          // 0.8 x 2.25 at 600 px/unit
  (function () {
    const g = rInk.g, s = 600, cx = 240, cy = 675;
    g.strokeStyle = 'rgba(190,200,140,0.5)'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy - 0.73 * s, 0.4 * s, Math.PI / 2 - 0.75, Math.PI / 2 + 0.75); g.stroke();
    g.beginPath(); g.arc(cx, cy + 0.73 * s, 0.4 * s, -Math.PI / 2 - 0.75, -Math.PI / 2 + 0.75); g.stroke();
    fitText(g, 'FURLAN', cx - 128, cy + 13, 256, 26, DISPLAY, 500, 'rgba(206,214,160,0.92)', 9);
    rInk.tex.needsUpdate = true;
  })();
  decal(R, rInk, 0.8, 2.25, 1.42, 0, colTop + 0.002);
  // pastel paper tones at the paper's own lightness, so ink, shadows and the devices read the same on every one; 0 is the original grey
  let tint = 2;
  const wash = document.getElementById('wash');
  function flood(color, o) {
    const c = new THREE.Vector3(); o.k.getWorldPosition(c); c.project(camera);
    const b = canvas.getBoundingClientRect();
    const x = b.left + (c.x + 1) / 2 * b.width, y = b.top + (1 - c.y) / 2 * b.height;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 4;
    const el = document.createElement('i');
    el.style.cssText = `background:${color};--x:${x}px;--y:${y}px;--r:${r}px`;
    wash.appendChild(el); el.getBoundingClientRect(); el.classList.add('on');
    document.documentElement.style.setProperty('--paper', color);
    // once a tone has covered the page, the layers under it are no longer seen
    el.addEventListener('transitionend', () => { while (wash.firstChild !== el) wash.firstChild.remove(); }, { once: true });
  }
  // each click also slides the 30S window along the waveform, as before; the window stops at the ends, the tones loop
  // a colour selector: the knob slides the 30S window along the waveform, the page takes the band under it,
  // and at either end of the waveform the knob stops
  [[0.73, 2.2, (d, o) => {
    const w = Math.min(364, Math.max(-392, rState.win + d * 28)); if (w === rState.win) return false;
    rState.win = w; drawR();
    const z = zoneOf(WIN_MID + w); if (z !== tint) { tint = z; flood(TINTS[z], o); }
    return true; }],
   // type weight: the readout is the weight over ten (20 = Unbounded ExtraLight 200 ... 90 = Black 900), 60 as designed
   [-0.73, 0.75, (d) => { const n = Math.min(90, Math.max(20, rState.num + d * 2)); if (n === rState.num) return false; rState.num = n; drawR();
     document.documentElement.style.setProperty('--wght', n * 10);
     document.fonts.load(`${n * 10} 100px Unbounded`).then(() => { if (rState.num === n) drawR(); }).catch(() => {});
     return true; }]].forEach(([ky, ang, step]) => {
    const k = knob(0.235, 0.24, { color: 0xCBCBC9, rough: 0.36, coat: 0.5, env: 0.5, mark: '#4F6A1C', angle: ang, ring: true });
    k.position.set(1.42, ky, colTop); R.add(k); knobs.push({ k, step });
  });

  /* ---------- open to work: a small status unit in the intro row ---------- */
  // Same build as the grey unit, at a fraction of the size: tan rim, cast concrete body, a flush screen and a status
  // light instead of knobs, so nothing on it reads as a control. Its own small renderer, camera and paper shadow;
  // the same key light, tilt and slow float. The grey unit's brightness knob dims its screen with the big one.
  let otwBright = null;
  function setOtwBright(v) { if (otwBright) otwBright(v); }
  (function () {
    const cv = document.getElementById('otw'); if (!cv) return;
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    const TIP0 = THREE.MathUtils.degToRad(-10), TILT0 = THREE.MathUtils.degToRad(-12);
    const r2 = track(new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }));
    r2.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r2.outputEncoding = THREE.sRGBEncoding; r2.toneMapping = THREE.LinearToneMapping; r2.physicallyCorrectLights = true;
    r2.shadowMap.enabled = true; r2.shadowMap.type = THREE.VSMShadowMap;
    const S = new THREE.Scene();
    if (RoomEnvironment) S.environment = new THREE.PMREMGenerator(r2).fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(11, 1, 0.1, 400);
    const k2 = new THREE.DirectionalLight(0xffffff, 1.55); k2.position.copy(key.position);
    k2.castShadow = true; k2.shadow.mapSize.set(1024, 1024); k2.shadow.radius = 12; k2.shadow.bias = -0.0005;
    Object.assign(k2.shadow.camera, { left: -3, right: 3, top: 2, bottom: -2, near: 1, far: 40 }); S.add(k2);

    const W0 = 3.3, H0 = 1.12, front = 0.178;
    const G = new THREE.Group(); S.add(G);
    const rim = sh(new THREE.Mesh(slab(W0, H0, 0.4, 0.26, 0.03), lRim.material)); rim.position.z = -0.1; G.add(rim);
    G.add(sh(new THREE.Mesh(slab(W0 - 0.12, H0 - 0.12, 0.36, 0.3, 0.028), concrete)));

    // screen: OPEN TO WORK in the lime of the green unit's DETECTING SIGNAL, with a blinking block cursor
    const SW = 2.36, SH = 0.66, ct = canvasTex(1416, 396);
    let blink = true;
    function draw() {
      const g = ct.g, Wc = 1416, Hc = 396; panel(g, Wc, Hc);
      g.font = `700 150px ${MONO}`; g.textBaseline = 'alphabetic'; if ('letterSpacing' in g) g.letterSpacing = '4px';
      const m = g.measureText('OPEN TO WORK'), cap = m.actualBoundingBoxAscent || 110, base = Hc / 2 + cap / 2;
      g.fillStyle = LIME; g.fillText('OPEN TO WORK', 84, base);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      if (blink) g.fillRect(84 + m.width + 26, base - cap, 70, cap);
      ct.tex.needsUpdate = true;
    }
    draw();
    screen(G, SW, SH, 0.22, -0.32, 0, front, ct);
    const scr = G.userData.screen;

    // status light: a lime lens in a dark seat, breathing slowly like a standby lamp
    const LX = 1.2;
    const seat = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), flat(0x050506, 0.5, { envMapIntensity: 0.15 }));
    seat.position.set(LX, 0, front + 0.002); G.add(seat);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3008, emissive: new THREE.Color(LIME), emissiveIntensity: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), lensMat); lens.scale.z = 0.4; lens.position.set(LX, 0, front + 0.004); G.add(lens);
    const halo = (function () {
      const t = canvasTex(128, 128), g = t.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(214,226,74,0.55)'); gr.addColorStop(0.35, 'rgba(214,226,74,0.18)'); gr.addColorStop(1, 'rgba(214,226,74,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); t.tex.needsUpdate = true;
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      h.position.set(LX, 0, front + 0.05); G.add(h); return h;
    })();
    let bright = 1;
    otwBright = (v) => { bright = v; scr.material.color.setScalar(v); go(); };

    // pose: the hero's tilt, resting on the paper, with the same paper shadow
    G.rotation.set(TIP0, TILT0, 0, 'YXZ'); G.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(rim);
    const rest = new THREE.Vector3(-(back.min.x + back.max.x) / 2, -(back.min.y + back.max.y) / 2, -0.285 - back.min.z);
    const lift0 = W0 * Math.sin(Math.abs(TILT0)), liftY0 = H0 * Math.sin(Math.abs(TIP0));
    const shadow = paperShadow(0, W0 * Math.cos(TILT0), H0 * Math.cos(TIP0), 0.4, lift0, TILT0 < 0 ? 1 : -1, liftY0, S, 0.42);
    const su = shadow.material.uniforms;

    let cw = 0, chh = 0;
    function fit() {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h || (w === cw && h === chh)) return; cw = w; chh = h;
      r2.setSize(w, h, false); cam.aspect = w / h;
      // the unit spans the .otw box; the canvas runs past it on every side as room for the shadow and the float
      const box = cv.parentElement, upx = W0 / box.clientWidth, visH = h * upx;
      const d = visH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
      const ox = (w / 2 - (-cv.offsetLeft + box.clientWidth / 2)) * upx, oy = -(h / 2 - (-cv.offsetTop + box.clientHeight / 2)) * upx;
      cam.position.set(ox, oy - d * 0.02, d); cam.lookAt(ox, oy - 0.02, 0); cam.updateProjectionMatrix();
    }
    let raf2 = 0, t0 = performance.now(), lastBlink = -1;
    function render(now) {
      raf2 = 0; fit();
      const t = (now - t0) / 1000, still = rm.matches, TAU = Math.PI * 2;
      const rx = still ? 0 : 0.003 * Math.sin(TAU * t / 9.7 + 0.4), ry = still ? 0 : 0.0024 * Math.sin(TAU * t / 12.3 + 1.1);
      const hov = (still ? 0 : 0.024 * 0.5 * (1 - Math.cos(TAU * t / 6.9 + 1.3))) + Math.abs(rx) * H0 / 2 + Math.abs(ry) * W0 / 2;
      G.rotation.set(TIP0 + rx, TILT0 + ry, 0, 'YXZ'); G.position.set(rest.x, rest.y, rest.z + hov);
      su.hov.value = hov; su.lift.value = W0 * Math.sin(Math.abs(TILT0 + ry)); su.liftY.value = H0 * Math.sin(Math.abs(TIP0 + rx));
      const breath = still ? 1 : 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(TAU * t / 2.6));
      lensMat.emissiveIntensity = breath * bright; halo.material.opacity = breath * Math.min(1, bright);
      const b = still || Math.floor(t / 0.55) % 2 === 0;
      if (b !== blink) { blink = b; draw(); }
      r2.render(S, cam);
      if (!still) raf2 = requestAnimationFrame(render);
    }
    function go() { if (!raf2) raf2 = requestAnimationFrame(render); }
    rm.addEventListener?.('change', go, { signal });
    new ResizeObserver(go).observe(cv);
    go();
  })();

  /* ---------- caption labels printed on the paper ---------- */
  function inkCaption(g, text, align) {
    g.clearRect(0, 0, 512, 64);
    g.fillStyle = 'rgba(120,120,120,0.9)'; g.font = `400 34px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = align;
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    g.fillText(text, align === 'left' ? 2 : align === 'right' ? 510 : 256, 34);
  }
  function caption(text, x, y, align) {
    const ct = canvasTex(512, 64); inkCaption(ct.g, text, align); ct.tex.needsUpdate = true;
    return decal(scene, ct, 1.6, 0.2, x + (align === 'left' ? 0.8 : -0.8), y, -0.31);
  }
  // the caption line now lives in the header; this one stays hidden under the devices only as the size reference
  const capL = caption('', -3.9, -1.95, 'left'); capL.visible = false;
  // header caption: same 512 x 64 drawing, scaled to the on-screen size the captions had under the devices
  const topcap = document.getElementById('topcap');
  // drawn through the GPU exactly like the old caption decal (same texture, mipmaps and filtering), so the ink
  // softens into the paper the same way instead of the crisper look of a plain 2D canvas
  let topR = null, topS = null, topC = null, topM = null;
  if (topcap) {
    topR = track(new THREE.WebGLRenderer({ canvas: topcap, alpha: true, antialias: true }));
    topR.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); topR.outputEncoding = THREE.sRGBEncoding;
    topS = new THREE.Scene();
    topM = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    topS.add(topM);
    topC = new THREE.OrthographicCamera(-0.8, 0.8, 0.1, -0.1, 0.1, 10); topC.position.z = 1;
  }

  /* ---------- the header line: where and how the visitor is ----------
     Portfolio / 11.26 — a line for the weather where the visitor is, a small ink icon, and the temperature.
     On Vercel, /api/weather reads the visitor's city from the platform's geo headers and asks Open-Meteo for the
     weather there. Without it (this preview, or a failed lookup) the line falls back to the visitor's own time zone
     and local time, which the browser knows with no request at all. ?wx=rain (or sun, night, clouds, fog, drizzle,
     snow, storm, hot, cold) previews a state, and &city=Lisbon sets the place. */
  const INK_CAP = 'rgba(120,120,120,0.9)';
  const icons = {
    sun(g, x, y) { g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.lineTo(x + Math.cos(a) * 12.5, y + Math.sin(a) * 12.5); g.stroke(); } },
    moon(g, x, y) { g.beginPath(); g.arc(x, y, 10, 0.32 * Math.PI, 1.68 * Math.PI, false); g.arc(x + 6.5, y - 2.5, 8.2, 1.52 * Math.PI, 0.52 * Math.PI, true); g.closePath(); g.stroke(); },
    cloud(g, x, y) { g.beginPath(); g.moveTo(x - 9, y + 6); g.arc(x - 8.5, y + 1.5, 4.6, 0.5 * Math.PI, 1.4 * Math.PI); g.arc(x - 0.5, y - 2, 6.6, 1.12 * Math.PI, 1.95 * Math.PI); g.arc(x + 8.5, y + 2, 4.2, 1.5 * Math.PI, 0.5 * Math.PI); g.closePath(); g.stroke(); },
    rain(g, x, y) { icons.cloud(g, x, y - 5); [-6, 0, 6].forEach((d) => { g.beginPath(); g.moveTo(x + d + 1.5, y + 6); g.lineTo(x + d - 1.5, y + 12); g.stroke(); }); },
    drizzle(g, x, y) { icons.cloud(g, x, y - 5); [-6, 0, 6].forEach((d, i) => { g.beginPath(); g.arc(x + d, y + 9 + (i % 2) * 2, 1.2, 0, 7); g.fill(); }); },
    storm(g, x, y) { icons.cloud(g, x, y - 5); g.beginPath(); g.moveTo(x + 1.5, y + 3); g.lineTo(x - 2.5, y + 9); g.lineTo(x + 1.5, y + 9); g.lineTo(x - 1.5, y + 15); g.stroke(); },
    snow(g, x, y) { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + Math.PI / 2; g.beginPath(); g.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); g.lineTo(x - Math.cos(a) * 11, y - Math.sin(a) * 11); g.stroke(); }
      g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); },
    fog(g, x, y) { [[-7, 11, 0], [0, 13, 3], [7, 9, -2]].forEach(([dy, w, dx]) => { g.beginPath(); g.moveTo(x - w + dx, y + dy); g.lineTo(x + w + dx, y + dy); g.stroke(); }); },
  };
  const capM = document.createElement('canvas').getContext('2d');
  function measureCap(spec) {
    capM.font = `400 34px ${MONO}`; if ('letterSpacing' in capM) capM.letterSpacing = '2px';
    const gap = 16, iw = spec.icon ? 38 : 0;
    const w1 = capM.measureText(spec.text).width, w2 = spec.tail ? capM.measureText(spec.tail).width : 0;
    return { gap, iw, w1, w2, total: w1 + (iw ? gap + iw : 0) + (w2 ? gap + w2 : 0) };
  }
  function paintCap(spec) {
    const { gap, iw, w1, w2, total } = measureCap(spec);
    const TW = Math.max(512, 2 ** Math.ceil(Math.log2(total + 24)));
    const ct = canvasTex(TW, 64), g = ct.g;
    g.fillStyle = g.strokeStyle = INK_CAP; g.lineWidth = 2.4; g.lineCap = g.lineJoin = 'round';
    g.font = `400 34px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left'; if ('letterSpacing' in g) g.letterSpacing = '2px';
    let x = (TW - total) / 2;
    g.fillText(spec.text, x, 34); x += w1;
    if (iw) {   // icons are drawn on a 26px grid and set a little larger, so they sit at the height of the capitals
      x += gap; g.save(); g.translate(x + iw / 2, 32); g.scale(1.32, 1.32); g.lineWidth = 2.1;
      icons[spec.icon](g, 0, 0); g.restore(); x += iw;
    }
    if (w2) { x += gap; g.fillText(spec.tail, x, 34); }
    ct.tex.needsUpdate = true;
    if (topM.material.map) topM.material.map.dispose();
    topM.material.map = ct.tex; topM.material.needsUpdate = true;
    topM.scale.x = TW / 320; topC.left = -TW / 640; topC.right = TW / 640; topC.updateProjectionMatrix();
    return { TW, total };
  }
  const MONTH = 'Portfolio / 11.26';
  let capFull = { text: MONTH }, capShort = { text: MONTH }, capShown = null, capDims = null;
  function setCap(full, short) {
    capFull = full; capShort = short || { text: MONTH, icon: full.icon, tail: full.tail };
    capShown = null;
    const label = [full.text, full.tail].filter(Boolean).join(' ');
    topcap.parentElement.setAttribute('aria-label', label);
    sizeTopcap();
  }
  function sizeTopcap() {
    if (!topcap) return;
    capL.updateMatrixWorld(true);
    const a = new THREE.Vector3(-0.8, 0, 0).applyMatrix4(capL.matrixWorld).project(camera);
    const b = new THREE.Vector3(0.8, 0, 0).applyMatrix4(capL.matrixWorld).project(camera);
    const k = Math.abs(b.x - a.x) / 2 * canvas.clientWidth / 512;     // CSS px per texture px, as the 512-wide caption had
    if (!k) return;
    // the long line where it fits between the name and the mark, the short one where it doesn't
    const room = topcap.parentElement.clientWidth - 24;
    const want = measureCap(capFull).total * k > room ? capShort : capFull;
    if (want !== capShown) { capDims = paintCap(want); capShown = want; }
    const w = capDims.TW * k, h = 64 * k;
    topcap.style.width = w.toFixed(1) + 'px'; topcap.style.height = h.toFixed(1) + 'px';
    topR.setSize(w, h, false); topR.render(topS, topC);
  }

  const WX_LINES = {
    sun: (c) => c ? `Sunny in ${c}, enjoy it` : 'Sun is out, enjoy it',
    hot: (c) => c ? `${c} is hot today, stay cool` : 'Hot out there, stay cool',
    night: (c) => c ? `Clear night in ${c}, stars are out` : 'Clear night, stars are out',
    clouds: (c) => c ? `Grey skies in ${c}, bright ideas in here` : 'Grey skies, bright ideas in here',
    fog: () => 'Foggy out there, clear thinking in here',
    drizzle: () => 'A little drizzle, nothing a hood can’t fix',
    rain: () => 'Stay dry, rain might catch you',
    storm: () => 'Storm outside, a good day to stay in',
    snow: (c) => c ? `Snow in ${c}, keep warm` : 'Snow outside, keep warm',
    cold: (c) => c ? `Cold in ${c}, wrap up warm` : 'Cold out there, wrap up warm',
  };
  const WX_ICON = { sun: 'sun', hot: 'sun', night: 'moon', clouds: 'cloud', fog: 'fog', drizzle: 'drizzle', rain: 'rain', storm: 'storm', snow: 'snow', cold: 'cloud' };
  // WMO weather codes (what Open-Meteo returns) to one of the states above
  function stateOf(code, day, temp) {
    let s = code >= 95 ? 'storm' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
      : (code >= 61 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' : code >= 51 && code <= 57 ? 'drizzle'
      : code === 45 || code === 48 ? 'fog' : code >= 2 ? 'clouds' : day ? 'sun' : 'night';
    if (s === 'sun' && temp >= 28) s = 'hot';
    if ((s === 'clouds' || s === 'sun' || s === 'night') && temp <= 2) s = 'cold';
    return s;
  }
  function showWeather(state, city, temp) {
    const tail = Number.isFinite(temp) ? `${Math.round(temp)}°` : '';
    setCap({ text: `${MONTH} • ${WX_LINES[state](city)}`, icon: WX_ICON[state], tail }, { text: MONTH, icon: WX_ICON[state], tail });
  }
  // fallback: the visitor's own clock and time-zone city, kept to the minute
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const tzCity = /\//.test(tz) ? tz.split('/').pop().replace(/_/g, ' ') : '';
  let clockTimer = 0;
  function showClock() {
    const now = new Date(), hr = now.getHours(), hm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const c = tzCity;
    const [line, icon] = hr >= 5 && hr < 12 ? [c ? `Good morning, ${c}` : 'Good morning', 'sun']
      : hr < 18 && hr >= 12 ? [c ? `Good afternoon, ${c}` : 'Good afternoon', 'sun']
      : hr >= 18 && hr < 22 ? [c ? `Good evening, ${c}` : 'Good evening', 'moon']
      : [c ? `Up late in ${c}? Same here` : 'Up late? Same here', 'moon'];
    setCap({ text: `${MONTH} • ${line}`, icon, tail: hm }, { text: MONTH, icon, tail: hm });
    clearTimeout(clockTimer); clockTimer = setTimeout(showClock, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
  }
  if (topcap) {
    const q0 = new URLSearchParams(location.search), force = q0.get('wx');
    if (force && WX_LINES[force]) showWeather(force, q0.get('city') || tzCity, parseFloat(q0.get('t') ?? '14'));
    else {
      showClock();
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3500); signal.addEventListener('abort', () => ctl.abort());
      fetch('/api/weather', { signal: ctl.signal }).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!d || !Number.isFinite(d.code)) return;
        clearTimeout(clockTimer);
        showWeather(stateOf(d.code, d.day, d.temp), d.city || tzCity, d.temp);
      }).catch(() => {});
    }
  }

  // the small captions at the right of each section head get the same ink: drawn at the caption's 34px, softened
  // through the GPU like the header caption, then shown at the 11px the page already uses for them
  (function () {
    const heads = [...document.querySelectorAll('.index-head > .mono')]; if (!heads.length) return;
    const inkR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2); inkR.setPixelRatio(dpr); inkR.outputEncoding = THREE.sRGBEncoding;
    const S = new THREE.Scene(), PX = 34 / 11;          // texture pixels per CSS pixel
    heads.forEach((el) => {
      const text = (el.dataset.ink || el.textContent).trim().toUpperCase();
      const m = document.createElement('canvas').getContext('2d');
      m.font = `400 34px ${MONO}`; if ('letterSpacing' in m) m.letterSpacing = '2.7px';
      const tw = Math.ceil(m.measureText(text).width + 10), TH = 64;
      const TW = 2 ** Math.ceil(Math.log2(tw));          // a power-of-two texture, like the header's 512: same mipmaps, same softening
      const ct = canvasTex(TW, TH), g = ct.g;
      g.fillStyle = 'rgba(120,120,120,0.9)'; g.font = `400 34px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'right';
      if ('letterSpacing' in g) g.letterSpacing = '2.7px';
      g.fillText(text, TW - 4, 34); ct.tex.needsUpdate = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, toneMapped: false }));
      S.add(mesh);
      const cam = new THREE.OrthographicCamera(-TW / 2, TW / 2, TH / 2, -TH / 2, 0.1, 10); cam.position.z = 1;
      const W = TW / PX, h = TH / PX, w = tw / PX;       // render the whole texture, keep only the right-hand part the text is in
      inkR.setSize(W, h, false); inkR.render(S, cam);
      const src = inkR.domElement, out = document.createElement('canvas'); out.width = Math.round(w * dpr); out.height = Math.round(h * dpr);
      out.style.width = (out.width / dpr).toFixed(2) + 'px'; out.style.height = (out.height / dpr).toFixed(2) + 'px'; out.className = 'inkcap'; out.setAttribute('aria-hidden', 'true');
      out.getContext('2d').drawImage(src, src.width - out.width, 0, out.width, src.height, 0, 0, out.width, out.height);
      S.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); ct.tex.dispose();
      el.appendChild(out); el.classList.add('inked');
      undo.push(() => { out.remove(); el.classList.remove('inked'); });
    });
    inkR.dispose(); inkR.forceContextLoss();
  })();

  /* ---------- composition (matches the reference frame) ---------- */
  // slight turn about the vertical axis: each unit rests on one long edge and the other lifts off the paper.
  // Geometry, materials and screens are untouched; only the group's pose changes.
  const q = new URLSearchParams(location.search);
  const TILT_L = THREE.MathUtils.degToRad(parseFloat(q.get('l') ?? '-12'));
  const TILT_R = THREE.MathUtils.degToRad(parseFloat(q.get('r') ?? '-12'));
  // tip about the horizontal axis: the bottom edge lifts toward the viewer so its wall shows, like the right one
  const TIP = THREE.MathUtils.degToRad(parseFloat(q.get('x') ?? '-10'));
  const PAPER = -0.285;                         // back face of the rims when flat
  function pose(G, x, ry, w, h, r) {
    G.rotation.set(TIP, ry, 0, 'YXZ'); G.position.set(0, 0, 0); G.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(G);
    const back = new THREE.Box3().setFromObject(G.children[0]);   // the rim
    G.position.set(x - (back.min.x + back.max.x) / 2, -(back.min.y + back.max.y) / 2, PAPER - back.min.z);
    // the rim's back face, after the turn, spans this footprint on the paper and rises by `lift` across it
    const fw = w * Math.cos(Math.abs(ry)), lift = w * Math.sin(Math.abs(ry));
    const fh = h * Math.cos(Math.abs(TIP)), liftY = h * Math.sin(Math.abs(TIP));
    const shadow = paperShadow(x, fw, fh, r, lift, ry < 0 ? 1 : -1, liftY);
    G.userData.rest = { pos: G.position.clone(), rx: TIP, ry, w, h, shadow };
  }
  pose(L, -2.08, TILT_L, 3.05, 2.5, 0.5);
  pose(R, 1.68, TILT_R, 3.94, 2.54, 0.52);

  /* ---------- idle float ---------- */
  // Each unit drifts a few hundredths of a unit off the paper and rocks by a fraction of a degree, on slow unrelated periods.
  // The paper shadow is fed the same height and tilt, so it shifts down-right, softens and lightens as the unit rises.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const FLOAT = [
    { G: L, amp: 0.034, per: 7.3, ph: 0.0, rock: 0.0032, rp: 9.1 },
    { G: R, amp: 0.028, per: 8.6, ph: 2.1, rock: 0.0026, rp: 10.7 },
  ];
  let fade = reduce.matches ? 0 : 1;           // eases the motion in and out instead of stopping dead
  function applyFloat(t) {
    FLOAT.forEach((f) => {
      const R0 = f.G.userData.rest, TAU = Math.PI * 2;
      const T = f.touch;
      const rx = fade * f.rock * Math.sin(TAU * t / f.rp + f.ph * 1.7) + T.rx.x;
      const ry = fade * f.rock * 0.8 * Math.sin(TAU * t / (f.rp * 1.31) + f.ph) + T.ry.x;
      // 0 .. amp, touching the paper at the bottom of the cycle; plus whatever the rock needs so no corner dips into it
      const hov = fade * f.amp * 0.5 * (1 - Math.cos(TAU * t / f.per + f.ph)) + Math.max(0, T.lift.x) + Math.abs(rx) * R0.h / 2 + Math.abs(ry) * R0.w / 2;
      f.G.rotation.set(R0.rx + rx, R0.ry + ry, 0, 'YXZ');
      f.G.position.set(R0.pos.x, R0.pos.y, R0.pos.z + hov);
      const u = R0.shadow.material.uniforms;
      u.hov.value = hov;
      u.lift.value = R0.w * Math.sin(Math.abs(R0.ry + ry));
      u.liftY.value = R0.h * Math.sin(Math.abs(R0.rx + rx));
    });
  }

  /* ---------- touch ---------- */
  // A unit that is hovered rises a little and leans under the pointer; pressed, it rises further, dips where the finger is
  // and wobbles on a loose spring before settling. All of it goes through applyFloat, so the paper shadow gets the same
  // height and tilt: it slides down-right, spreads, softens and lightens as the unit comes up, and follows each wobble.
  const TOUCH = { hover: { lift: 0.04, tilt: 0.007 }, press: { lift: 0.13, tilt: 0.02 }, k: 85, c: 4.6 };
  FLOAT.forEach((f) => { f.touch = { lift: { x: 0, v: 0, to: 0 }, rx: { x: 0, v: 0, to: 0 }, ry: { x: 0, v: 0, to: 0 } }; });
  let pressed = null, over = null;
  function aim(f, mode, u, v) {
    const T = f.touch, m = mode && !reduce.matches ? TOUCH[mode] : null;
    T.lift.to = m ? m.lift : 0;
    T.ry.to = m ? m.tilt * u : 0;              // the side under the pointer goes down, the far side comes up
    T.rx.to = m ? -m.tilt * v : 0;
  }
  function stepTouch(dt) {
    let busy = false;
    FLOAT.forEach((f) => {
      for (const key in f.touch) {
        const s = f.touch[key];
        if (reduce.matches) { s.x = s.v = s.to = 0; continue; }
        for (let i = 0; i < 4; i++) { s.v += (TOUCH.k * (s.to - s.x) - TOUCH.c * s.v) * dt / 4; s.x += s.v * dt / 4; }
        const big = key === 'lift' ? 1e-4 : 1e-5;
        if (Math.abs(s.to - s.x) > big || Math.abs(s.v) > big * 10) busy = true; else { s.x = s.to; s.v = 0; }
      }
    });
    return busy;
  }

  /* ---------- knobs ---------- */
  const stage = canvas.parentElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const DETENT = Math.PI / 12;                 // 24 clicks a turn
  knobs.forEach((o) => { o.turn = 0; o.shown = 0; o.lift = 0; o.liftTo = 0; o.home = o.k.userData.cap.position.z; });
  let hover = null, drag = null;
  function pick(e) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(knobs.map((o) => o.k.userData.body), false)[0];
    return hit ? knobs.find((o) => o.k.userData.body === hit.object) : null;
  }
  function screenAngle(o, e) {
    const c = new THREE.Vector3(); o.k.getWorldPosition(c); c.project(camera);
    const b = canvas.getBoundingClientRect();
    const cx = b.left + (c.x + 1) / 2 * b.width, cy = b.top + (1 - c.y) / 2 * b.height;
    return { a: Math.atan2(-(e.clientY - cy), e.clientX - cx), r: Math.hypot(e.clientX - cx, e.clientY - cy) };
  }
  function setHover(o) {
    if (hover === o) return;
    if (hover && hover !== drag) hover.liftTo = 0;
    hover = o; if (o && o !== drag) o.liftTo = 0.006;
    stage.classList.toggle('knob-hover', !!o);
    wake();
  }
  // the first knob is a section selector: each detent brings the next section up to sit just under the devices.
  // The slide is a transform plus an equal negative margin, so the page's own scroll length shrinks to match.
  const flow = document.getElementById('flow');
  let slid = 0, slideTo = 0;
  const maxSlide = () => Math.max(0, flow.offsetHeight + slid - innerHeight * 0.45);
  function slide(y) {
    slid = Math.min(maxSlide(), Math.max(0, y));
    flow.style.transform = slid ? `translateY(${-slid}px)` : '';
    flow.style.marginBottom = slid ? `${-slid}px` : '';
  }
  function selectSection(i) {
    if (i < 0 || i >= SEL.n || i === SEL.at) return false;   // at either end the knob holds
    SEL.at = i;
    slideTo = sectionSlide(i);
    lState.num = i + 1; drawL();
    wake(); return true;
  }
  // how far to slide so section i's top lands a little under the devices' lower edge (both measured on screen, so the
  // page's own scroll position drops out)
  const box = new THREE.Box3(), foot = new THREE.Vector3();
  function sectionSlide(i) {
    if (!i) return 0;
    box.setFromObject(L).union(box.clone().setFromObject(R));
    foot.set(0, box.min.y, box.max.z).project(camera);
    const b = canvas.getBoundingClientRect(), devBottom = b.top + (1 - foot.y) / 2 * b.height;
    const flowTop = flow.getBoundingClientRect().top + slid;
    return Math.max(0, flowTop + SECTIONS[i].firstElementChild.offsetTop - devBottom - 36);   // its heading, not its padding
  }
  addEventListener('resize', () => { slideTo = sectionSlide(SEL.at); slide(slideTo); });
  function overDevice(e) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([L, R], true).length > 0;
  }
  addEventListener('pointermove', (e) => {
    if (drag) {
      const p = screenAngle(drag, e);
      if (p.r > 6) {                           // near the centre the angle is noise
        let da = p.a - drag.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        drag.a = p.a;
        const prev = drag.turn, det = drag.detent || DETENT;
        drag.turn += da;
        if (drag.min !== undefined) drag.turn = Math.min(drag.max, Math.max(drag.min, drag.turn));   // the end stops
        // value follows clicks crossed; clockwise (negative angle) counts up, as on hardware
        const want = Math.round(-drag.turn / det), had = Math.round(-prev / det);
        if (want !== had && !drag.step(want - had, drag)) drag.turn = prev;   // at a stop: the knob holds
      }
      wake(); return;
    }
    if (e.pointerType === 'mouse') {
      // over a device the pinned layer takes the pointer, so content hidden behind it can't be hovered or clicked
      stage.style.pointerEvents = overDevice(e) ? 'auto' : '';
      setHover(pick(e));
    }
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    const o = pick(e); if (!o || e.button > 0) return;
    e.preventDefault();
    drag = o; drag.a = screenAngle(o, e).a; drag.liftTo = -0.01;   // press: the cap sinks a hair into its seat
    stage.classList.add('knob-drag'); document.documentElement.classList.add('knob-drag'); wake();
  }, true);
  // which unit is under the pointer, and where on its face (-1..1 each way)
  function deviceAt(e) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([L, R], true)[0]; if (!hit) return null;
    let o = hit.object; while (o && o !== L && o !== R) o = o.parent;
    const f = FLOAT.find((x) => x.G === o), p = o.worldToLocal(hit.point.clone()), R0 = o.userData.rest;
    const cl = (n) => Math.max(-1, Math.min(1, n));
    return { f, u: cl(p.x / (R0.w / 2)), v: cl(p.y / (R0.h / 2)) };
  }
  addEventListener('pointermove', (e) => {
    if (reduce.matches) return;
    const d = deviceAt(e);
    if (pressed) { if (d && d.f === pressed) aim(pressed, 'press', d.u, d.v); wake(); return; }
    if (e.pointerType !== 'mouse') return;
    const f = d ? d.f : null;
    if (over && over !== f) aim(over, null);
    if (f) {
      if (over !== f) { f.touch.lift.v += 0.25; f.touch.ry.v += 0.05 * d.u; f.touch.rx.v -= 0.05 * d.v; }   // a small start as the pointer arrives
      aim(f, 'hover', d.u, d.v);
    }
    if (over !== f || f) wake();
    over = f;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (reduce.matches || e.button > 0) return;
    const d = deviceAt(e); if (!d) return;
    if (pick(e)) return;                       // a knob takes the press itself; the unit stays steady under the hand
    pressed = d.f; aim(pressed, 'press', d.u, d.v);
    const T = pressed.touch;                   // the tap itself: a push down at the finger, so the unit rocks back past level
    T.lift.v -= 0.35; T.ry.v += 0.22 * d.u; T.rx.v -= 0.22 * d.v;
    wake();
  }, true);
  const letGo = (e) => {
    if (!pressed) return;
    const d = e.pointerType === 'mouse' ? deviceAt(e) : null;
    if (d && d.f === pressed) { aim(pressed, 'hover', d.u, d.v); over = pressed; } else { aim(pressed, null); if (over === pressed) over = null; }
    pressed = null; wake();
  };
  addEventListener('pointerup', letGo);
  addEventListener('pointercancel', letGo);
  on(document, 'mouseleave', () => { if (over && !pressed) { aim(over, null); over = null; wake(); } });
  addEventListener('click', (e) => { if (overDevice(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  const release = (e) => {
    if (!drag) return;
    const det = drag.detent || DETENT;
    drag.turn = Math.round(drag.turn / det) * det;   // settle into the nearest click
    drag.liftTo = drag === hover ? 0.006 : 0; drag = null;
    stage.classList.remove('knob-drag'); document.documentElement.classList.remove('knob-drag');
    if (e.pointerType !== 'mouse') setHover(null);
    wake();
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  on(document, 'mouseleave', () => { if (!drag) { setHover(null); stage.style.pointerEvents = ''; } });
  // a wheel or trackpad over a knob clicks it round one detent at a time, instead of scrolling the page
  let wheelSum = 0, wheelLock = 0;
  addEventListener('wheel', (e) => {
    const o = pick(e); if (!o) { wheelSum = 0; return; }
    e.preventDefault();
    const now = performance.now();
    if (now < wheelLock) return;                // one click per flick: a trackpad's glide doesn't skip sections
    wheelSum += e.deltaMode ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(wheelSum) < 40) return;
    const d = Math.sign(wheelSum); wheelSum = 0; wheelLock = now + 380;
    const det = o.detent || DETENT;
    if (o.step(d, o)) o.turn = Math.round(o.turn / det) * det - d * det;   // down / towards you turns it clockwise
    wake();
  }, { passive: false });
  // on touch, a finger that lands on a knob turns it instead of scrolling the page
  addEventListener('touchstart', (e) => { if (e.touches.length === 1 && pick(e.touches[0])) e.preventDefault(); }, { passive: false });

  function stepKnobs(dt) {
    let busy = false;
    const k = 1 - Math.exp(-dt * (reduce.matches ? 60 : 22));
    knobs.forEach((o) => {
      // while held the cap tracks the finger exactly; let go and it eases into the detent
      o.shown = drag === o ? o.turn : o.shown + (o.turn - o.shown) * k;
      o.lift += (o.liftTo - o.lift) * k;
      if (Math.abs(o.turn - o.shown) > 1e-4 || Math.abs(o.liftTo - o.lift) > 1e-5) busy = true;
      const cap = o.k.userData.cap; cap.rotation.z = o.shown; cap.position.z = o.home + o.lift;
    });
    // the content follows the selector with a little weight behind it
    if (Math.abs(slideTo - slid) > 0.5) { slide(slid + (slideTo - slid) * (1 - Math.exp(-dt * (reduce.matches ? 60 : 7)))); busy = true; }
    else if (slid !== Math.min(maxSlide(), slideTo)) slide(slideTo);
    return busy || !!drag;
  }

  const size = { w: 0, h: 0, ch: 0 };
  function frame() {
    // frame the devices to the stage box as before, then let the view run on below it to the canvas's full height
    const w = canvas.clientWidth, h = canvas.parentElement.clientHeight, ch = canvas.clientHeight;
    if (!w || !h) return;
    if (w === size.w && h === size.h && ch === size.ch) { renderer.render(scene, camera); return; }
    size.w = w; size.h = h; size.ch = ch;
    renderer.setSize(w, ch, false);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, 0, w, ch);
    const visH = Math.max(4.9, 8.9 / camera.aspect);
    const d = visH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, -d * 0.02, d);
    camera.lookAt(0, -0.02, 0);
    camera.updateProjectionMatrix();
    sizeTopcap();
    renderer.render(scene, camera);
  }

  // one loop: runs while the hero is on screen and something moves; sleeps otherwise
  let visible = true, raf = 0, last = 0, t = 0;
  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    const floating = !reduce.matches || fade > 0.001;
    if (floating) { t += dt; fade += ((reduce.matches ? 0 : 1) - fade) * (1 - Math.exp(-dt * 1.5)); }
    const moving = stepTouch(dt);
    applyFloat(t);
    const busy = stepKnobs(dt) || moving;
    frame();
    if (visible && (floating || busy)) raf = requestAnimationFrame(loop); else last = 0;
  }
  function wake() { if (!raf && visible) raf = requestAnimationFrame(loop); }
  reduce.addEventListener?.('change', wake, { signal });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(canvas);
  new ResizeObserver(() => { frame(); wake(); }).observe(canvas.parentElement);
  applyFloat(0); frame(); wake();
}
