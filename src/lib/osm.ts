import type { BuildingFootprint, DistrictData, RoadEdge, RoadNode } from '../types';
import { distance, project } from './geo';
import type { GeoOrigin } from './geo';

// Real intersection: Jalan Tun Razak / Jalan Ampang area, Kuala Lumpur.
export const KL_ORIGIN: GeoOrigin = { lat: 3.1614, lon: 101.7203 };
const BBOX_DELTA = 0.0013; // ~290m square — one street corridor with a few real cross-streets and junctions, not a whole district

const HIGHWAY_CLASSES =
  '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$';

function defaultLanes(highwayClass: string): number {
  switch (highwayClass) {
    case 'motorway':
    case 'trunk':
    case 'primary':
      return 3;
    case 'secondary':
      return 2;
    case 'tertiary':
      return 2;
    default:
      return 1;
  }
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

function pathLength(points: { x: number; z: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += distance(points[i - 1], points[i]);
  return len;
}

function buildNodeIndex(roads: RoadEdge[]): Map<number, RoadNode> {
  const touchCount = new Map<number, number>();
  const pos = new Map<number, { x: number; z: number }>();
  for (const road of roads) {
    road.nodeIds.forEach((id, i) => {
      touchCount.set(id, (touchCount.get(id) ?? 0) + 1);
      pos.set(id, road.points[i]);
    });
  }
  const nodes = new Map<number, RoadNode>();
  for (const [id, count] of touchCount) {
    const p = pos.get(id)!;
    nodes.set(id, { id, pos: p, degree: count, isJunction: count >= 3 });
  }
  return nodes;
}

// A real crossroad in OSM is often several nodes a few meters apart (turn-lane
// splits, slightly offset stop lines) linked by short segments, rather than one
// clean point where exactly 4 roads meet. Left alone, each of those becomes its
// own controlled "junction" — a car crosses what should read as one intersection
// but gets stopped 2-3 times in quick succession. This clusters junction nodes
// connected by short links into one logical intersection: only the cluster's
// most-connected node stays a controlled junction (recomputed to the real arm
// count, not the raw fragment count); the rest become plain pass-through points.
const JUNCTION_CLUSTER_MERGE_M = 22;

function clusterJunctions(roads: RoadEdge[], nodes: Map<number, RoadNode>): Map<number, number> {
  const rawJunctionIds = [...nodes.values()].filter((n) => n.isJunction).map((n) => n.id);
  const parent = new Map<number, number>();
  for (const id of rawJunctionIds) parent.set(id, id);

  function find(x: number): number {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) {
      const next = parent.get(x)!;
      parent.set(x, r);
      x = next;
    }
    return r;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const road of roads) {
    const a = road.nodeIds[0];
    const b = road.nodeIds[road.nodeIds.length - 1];
    if (parent.has(a) && parent.has(b) && road.lengthM < JUNCTION_CLUSTER_MERGE_M) union(a, b);
  }

  const clusterMembers = new Map<number, number[]>();
  for (const id of rawJunctionIds) {
    const root = find(id);
    const arr = clusterMembers.get(root);
    if (arr) arr.push(id);
    else clusterMembers.set(root, [id]);
  }

  // External degree per cluster: distinct roads touching any member, excluding
  // roads that start and end inside the same cluster (those are the short
  // internal links being consolidated away, not real arms).
  const externalEdgesByRoot = new Map<number, Set<string>>();
  const rootOfMember = new Map<number, number>();
  for (const [root, members] of clusterMembers) for (const m of members) rootOfMember.set(m, root);

  for (const road of roads) {
    const a = road.nodeIds[0];
    const b = road.nodeIds[road.nodeIds.length - 1];
    const rootA = rootOfMember.get(a);
    const rootB = rootOfMember.get(b);
    if (rootA !== undefined && rootA === rootB) continue; // internal connector, not an arm
    for (const root of [rootA, rootB]) {
      if (root === undefined) continue;
      const set = externalEdgesByRoot.get(root);
      if (set) set.add(road.id);
      else externalEdgesByRoot.set(root, new Set([road.id]));
    }
  }

  const repOf = new Map<number, number>();
  for (const [root, members] of clusterMembers) {
    // representative = original member with the highest raw touch-degree
    let rep = members[0];
    let bestDegree = nodes.get(rep)?.degree ?? 0;
    for (const m of members) {
      const d = nodes.get(m)?.degree ?? 0;
      if (d > bestDegree) {
        rep = m;
        bestDegree = d;
      }
    }
    const externalDegree = externalEdgesByRoot.get(root)?.size ?? nodes.get(rep)?.degree ?? 0;
    for (const m of members) {
      repOf.set(m, rep);
      const node = nodes.get(m)!;
      if (m === rep) {
        nodes.set(m, { ...node, degree: externalDegree, isJunction: externalDegree >= 3 });
      } else {
        nodes.set(m, { ...node, isJunction: false });
      }
    }
  }

  return repOf;
}

function computeBounds(roads: RoadEdge[], buildings: BuildingFootprint[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const consume = (p: { x: number; z: number }) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  };
  roads.forEach((r) => r.points.forEach(consume));
  buildings.forEach((b) => b.points.forEach(consume));
  if (!isFinite(minX)) return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
  return { minX, maxX, minZ, maxZ };
}

function parseOverpass(data: { elements: OverpassElement[] }): { roads: RoadEdge[]; buildings: BuildingFootprint[] } {
  const nodeLatLon = new Map<number, { lat: number; lon: number }>();
  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeLatLon.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  const roads: RoadEdge[] = [];
  const buildings: BuildingFootprint[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes || !el.tags) continue;

    if (el.tags.highway) {
      const points = el.nodes.map((id) => nodeLatLon.get(id)).filter((v): v is { lat: number; lon: number } => !!v).map((v) => project(v.lat, v.lon, KL_ORIGIN));
      if (points.length < 2) continue;
      const laneTag = parseInt(el.tags.lanes ?? '', 10);
      roads.push({
        id: `w${el.id}`,
        wayId: el.id,
        name: el.tags.name || el.tags.highway,
        highwayClass: el.tags.highway,
        baseLanes: Number.isFinite(laneTag) && laneTag > 0 ? laneTag : defaultLanes(el.tags.highway),
        points,
        nodeIds: el.nodes,
        lengthM: pathLength(points),
      });
    } else if (el.tags.building) {
      const points = el.nodes.map((id) => nodeLatLon.get(id)).filter((v): v is { lat: number; lon: number } => !!v).map((v) => project(v.lat, v.lon, KL_ORIGIN));
      if (points.length < 3) continue;
      const levelsTag = parseInt(el.tags['building:levels'] ?? '', 10);
      buildings.push({
        id: `b${el.id}`,
        points,
        levels: Number.isFinite(levelsTag) && levelsTag > 0 ? levelsTag : 2 + Math.floor(hash(el.id) * 6),
      });
    }
  }

  return { roads, buildings };
}

function hash(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

// Small hand-authored grid used only if the live Overpass fetch fails (offline /
// network-blocked). Keeps the app usable without a live API dependency, same
// guardrail the project doc calls for.
function fallbackDistrict(): { roads: RoadEdge[]; buildings: BuildingFootprint[] } {
  // Each arm is its own way (split at the node it meets), matching how OSM itself
  // splits ways at junctions — the node-degree junction heuristic below depends on it.
  const roads: RoadEdge[] = [
    { id: 'f1', wayId: -1, name: 'Jalan Tun Razak', highwayClass: 'primary', baseLanes: 3, nodeIds: [1, 2], points: [{ x: -220, z: 0 }, { x: 0, z: 0 }], lengthM: 220 },
    { id: 'f2', wayId: -2, name: 'Jalan Tun Razak', highwayClass: 'primary', baseLanes: 3, nodeIds: [2, 3], points: [{ x: 0, z: 0 }, { x: 220, z: 0 }], lengthM: 220 },
    { id: 'f3', wayId: -3, name: 'Jalan Ampang', highwayClass: 'secondary', baseLanes: 2, nodeIds: [4, 2], points: [{ x: 0, z: -180 }, { x: 0, z: 0 }], lengthM: 180 },
    { id: 'f4', wayId: -4, name: 'Jalan Ampang', highwayClass: 'secondary', baseLanes: 2, nodeIds: [2, 5], points: [{ x: 0, z: 0 }, { x: 0, z: 180 }], lengthM: 180 },
    { id: 'f5', wayId: -5, name: 'Jalan Sejahtera', highwayClass: 'residential', baseLanes: 1, nodeIds: [1, 6], points: [{ x: -220, z: 0 }, { x: -220, z: 150 }], lengthM: 150 },
    { id: 'f6', wayId: -6, name: 'Jalan Damai', highwayClass: 'residential', baseLanes: 1, nodeIds: [3, 7], points: [{ x: 220, z: 0 }, { x: 220, z: -150 }], lengthM: 150 },
  ];
  const buildings: BuildingFootprint[] = Array.from({ length: 16 }).map((_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = -260 + col * 130 + (row % 2 === 0 ? -60 : 60);
    const cz = -220 + row * 140;
    const s = 14 + hash(i * 7) * 10;
    return {
      id: `fb${i}`,
      points: [
        { x: cx - s, z: cz - s },
        { x: cx + s, z: cz - s },
        { x: cx + s, z: cz + s },
        { x: cx - s, z: cz + s },
      ],
      levels: 2 + Math.floor(hash(i) * 8),
    };
  });
  return { roads, buildings };
}

export async function loadDistrict(): Promise<DistrictData> {
  let roads: RoadEdge[];
  let buildings: BuildingFootprint[];
  let source: 'overpass' | 'fallback' = 'overpass';

  try {
    const { lat, lon } = KL_ORIGIN;
    const bbox = `${lat - BBOX_DELTA},${lon - BBOX_DELTA},${lat + BBOX_DELTA},${lon + BBOX_DELTA}`;
    const query = `[out:json][timeout:25];(way["highway"~"${HIGHWAY_CLASSES}"](${bbox});way["building"](${bbox}););out body;>;out skel qt;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`overpass http ${res.status}`);
    const data = await res.json();
    ({ roads, buildings } = parseOverpass(data));
    if (roads.length === 0) throw new Error('overpass returned no roads');
  } catch (err) {
    console.warn('[osm] live Overpass fetch failed, using offline fallback district:', err);
    ({ roads, buildings } = fallbackDistrict());
    source = 'fallback';
  }

  const nodes = buildNodeIndex(roads);
  const clusterRepOf = clusterJunctions(roads, nodes);
  const bounds = computeBounds(roads, buildings);

  return {
    originName: 'Jalan Tun Razak, Kuala Lumpur',
    roads,
    nodes,
    clusterRepOf,
    buildings,
    bounds,
    source,
  };
}
