/* The shadow a device throws on the paper. */
import * as THREE from 'three';

const VERTEX = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const FRAGMENT = `
  varying vec2 vP;
  uniform vec2 hs; uniform float rad; uniform float lift; uniform float side; uniform float liftY; uniform float hov; uniform float spread;

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
  }`;

/* Paper shadow, fitted to the reference photo: darkest at the lower and right edges, fading over about one unit,
   none above or left. It lies on the paper (scene space), so it does not turn with the device. With a Y tilt one long
   edge lifts off the paper: the shadow under that edge falls further down and to the right and goes softer and
   lighter, as the key light requires.
     w, h    footprint of the device on the paper
     r       corner radius
     lift    how far the far long edge rises, `side` (+1 / -1) says which one
     liftY   how far the bottom edge rises
     spread  < 1 keeps a small unit's shadow in proportion */
export function paperShadow(into, cx, w, h, r, lift, side, liftY, spread = 1) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      hs: { value: new THREE.Vector2(w / 2, h / 2) },
      rad: { value: r },
      lift: { value: lift },
      side: { value: side },
      liftY: { value: liftY },
      hov: { value: 0 },
      spread: { value: spread },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 12, h + 12), material);
  mesh.position.set(cx, 0, -0.3);
  mesh.renderOrder = -1;
  into.add(mesh);
  return mesh;
}
