import * as THREE from 'three';
import type { Vec2 } from './geo';

// Builds a flat ribbon (triangle strip as indexed triangles) of constant `width`
// following the polyline `points`, lying in the XZ plane at height `y`.
export function buildRoadRibbon(points: Vec2[], width: number, y = 0): THREE.BufferGeometry {
  if (points.length < 2) return new THREE.BufferGeometry();

  const left: [number, number, number][] = [];
  const right: [number, number, number][] = [];
  const half = width / 2;

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const p = points[i];
    left.push([p.x + nx * half, y, p.z + nz * half]);
    right.push([p.x - nx * half, y, p.z - nz * half]);
  }

  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    positions.push(...left[i], ...right[i]);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// The two edge lines of a ribbon of `width` following `points` — used for curbs.
export function buildEdgeLines(points: Vec2[], width: number, y: number): { left: THREE.BufferGeometry; right: THREE.BufferGeometry } {
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  const half = width / 2;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const p = points[i];
    left.push(new THREE.Vector3(p.x + nx * half, y, p.z + nz * half));
    right.push(new THREE.Vector3(p.x - nx * half, y, p.z - nz * half));
  }
  return {
    left: new THREE.BufferGeometry().setFromPoints(left),
    right: new THREE.BufferGeometry().setFromPoints(right),
  };
}

export function buildCenterline(points: Vec2[], y: number): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, y, p.z)));
  geom.computeBoundingSphere();
  return geom;
}

export function buildBuildingGeometry(points: Vec2[], height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.z)));
  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 4 });
  geom.rotateX(Math.PI / 2);
  geom.scale(1, 1, -1);
  return geom;
}

export function pointAtT(points: Vec2[], t: number): { pos: Vec2; dir: Vec2 } {
  if (points.length < 2) return { pos: points[0] ?? { x: 0, z: 0 }, dir: { x: 1, z: 0 } };
  const clamped = Math.max(0, Math.min(1, t));
  const segCount = points.length - 1;
  const scaled = clamped * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - i;
  const a = points[i];
  const b = points[i + 1];
  const pos = { x: a.x + (b.x - a.x) * localT, z: a.z + (b.z - a.z) * localT };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { pos, dir: { x: dx / len, z: dz / len } };
}
