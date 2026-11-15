/* Rounded shapes the devices are built from. */
import * as THREE from 'three';

/** a rounded rectangle outline, centred on the origin */
export function roundedRect(w, h, r) {
  // corners drawn with long-handled cubics: reads as a squircle, flatter sides and firmer corners than a plain arc
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2, k = 0.36 * r;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);     shape.bezierCurveTo(x + w - k, y, x + w, y + k, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.bezierCurveTo(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);     shape.bezierCurveTo(x + k, y + h, x, y + h - k, x, y + h - r);
  shape.lineTo(x, y + r);         shape.bezierCurveTo(x, y + k, x + k, y, x + r, y);
  return shape;
}

/** map a centred geometry's XY onto 0..1 UVs across a w x h box */
export function fitUV(geometry, w, h) {
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
}

/** a rounded, bevelled block */
export function slab(w, h, r, depth, bevel, bevelSegments = 5) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel)),
    { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments: 48 },
  );
  geometry.center();
  fitUV(geometry, 4, 4);
  return geometry;
}

export function roundedPlane(w, h, r) {
  const geometry = new THREE.ShapeGeometry(roundedRect(w, h, r), 32);
  fitUV(geometry, w, h);
  return geometry;
}
