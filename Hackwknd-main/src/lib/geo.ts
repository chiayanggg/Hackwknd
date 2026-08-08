export interface GeoOrigin {
  lat: number;
  lon: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

const EARTH_RADIUS_M = 6378137;

// Equirectangular projection centered on `origin`, in meters. North = -z (so the
// default camera, looking down -z, sees north "up the screen").
export function project(lat: number, lon: number, origin: GeoOrigin): Vec2 {
  const x = ((lon - origin.lon) * Math.PI) / 180 * EARTH_RADIUS_M * Math.cos((origin.lat * Math.PI) / 180);
  const z = -(((lat - origin.lat) * Math.PI) / 180) * EARTH_RADIUS_M;
  return { x, z };
}

export function polygonCentroid(points: Vec2[]): Vec2 {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  return { x: x / points.length, z: z / points.length };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
