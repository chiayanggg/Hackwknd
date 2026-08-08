import type { CityEdits, DistrictData, NodeEdit, RoadEdge, RoadNode } from '../types';

export type SignalColor = 'green' | 'red';

const SIGNAL_CYCLE_SEC = 14; // real signalised junction: ~7s green per approach group
const ROUNDABOUT_CYCLE_SEC = 5; // shorter, more frequent — approximates natural gaps in circulating traffic
export const STOP_LINE_DISTANCE_M = 9;

export type ApproachGroups = Map<string, 0 | 1>; // edgeId -> group, per junction node

function membersByRep(district: DistrictData): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const [member, rep] of district.clusterRepOf) {
    const arr = result.get(rep);
    if (arr) arr.push(member);
    else result.set(rep, [member]);
  }
  return result;
}

export interface JunctionApproach {
  edge: RoadEdge;
  headingToEnd: boolean; // true = this edge's *last* point is the junction end
  controllerNodeId: number; // the cluster's representative node (what edits/signals are keyed by)
}

/** Every real arm of every junction — a "junction" is a whole cluster of nearby OSM
 * nodes consolidated into one real intersection (see clusterJunctions in osm.ts), so
 * this gathers arms from every member of the cluster, not just the one node that
 * stayed flagged as the controller, and drops the short internal links between
 * cluster members (those aren't arms, they're the fragments being consolidated away).
 * Shared by signal-group assignment and by the stop-line/crossing visuals so both
 * agree on exactly which edges count as "at this junction". */
export function junctionApproaches(district: DistrictData): JunctionApproach[] {
  const byRep = membersByRep(district);
  const list: JunctionApproach[] = [];
  for (const node of district.nodes.values()) {
    if (!node.isJunction) continue;
    const members = new Set(byRep.get(node.id) ?? [node.id]);
    for (const edge of district.roads) {
      const a = edge.nodeIds[0];
      const b = edge.nodeIds[edge.nodeIds.length - 1];
      const memberA = members.has(a);
      const memberB = members.has(b);
      if (memberA && memberB) continue; // internal connector within the cluster, not a real arm
      if (memberB) list.push({ edge, headingToEnd: true, controllerNodeId: node.id });
      if (memberA) list.push({ edge, headingToEnd: false, controllerNodeId: node.id });
    }
  }
  return list;
}

/** Split the edges touching each junction into two alternating "approach groups", the
 * same way a real signal controller pairs opposite/adjacent approaches on one phase. */
export function computeApproachGroups(district: DistrictData): Map<number, ApproachGroups> {
  const result = new Map<number, ApproachGroups>();
  for (const approach of junctionApproaches(district)) {
    const groups = result.get(approach.controllerNodeId) ?? new Map<string, 0 | 1>();
    if (!groups.has(approach.edge.id)) groups.set(approach.edge.id, (groups.size % 2) as 0 | 1);
    result.set(approach.controllerNodeId, groups);
  }
  return result;
}

/** Current signal color for one approach group at one node, given elapsed scene time.
 * Roundabout nodes use a "yield gate" of the same shape: closed = wait for a gap, open = go. */
export function signalColor(nodeEdit: NodeEdit | undefined, group: 0 | 1, elapsed: number): SignalColor {
  if (nodeEdit?.roundabout) {
    const half = ROUNDABOUT_CYCLE_SEC / 2;
    const phase = Math.floor(elapsed / half) % 2;
    return phase === group ? 'green' : 'red';
  }
  if (nodeEdit?.trafficLights === false) return 'green'; // signals removed, uncontrolled — doc flags this as a safety risk elsewhere
  const half = SIGNAL_CYCLE_SEC / 2;
  const phase = Math.floor(elapsed / half) % 2;
  return phase === group ? 'green' : 'red';
}

export function edgeGroupAtNode(groupsByNode: Map<number, ApproachGroups>, nodeId: number, edgeId: string): 0 | 1 {
  return groupsByNode.get(nodeId)?.get(edgeId) ?? 0;
}

export function nodeAt(district: DistrictData, edge: RoadEdge, end: 'start' | 'end'): RoadNode | undefined {
  const rawId = end === 'start' ? edge.nodeIds[0] : edge.nodeIds[edge.nodeIds.length - 1];
  const id = district.clusterRepOf.get(rawId) ?? rawId;
  return district.nodes.get(id);
}

export function junctionControlsThisApproach(district: DistrictData, edits: CityEdits, groupsByNode: Map<number, ApproachGroups>, edge: RoadEdge, headingToEnd: boolean, elapsed: number): SignalColor | null {
  const node = nodeAt(district, edge, headingToEnd ? 'end' : 'start');
  if (!node || !node.isJunction) return null;
  const group = edgeGroupAtNode(groupsByNode, node.id, edge.id);
  return signalColor(edits.nodeEdits[node.id], group, elapsed);
}

/** Which roads physically meet at each node — the road network graph cars actually
 * drive on (so they can turn through a junction instead of bouncing off the end of
 * whatever segment they started on). */
export function buildAdjacency(district: DistrictData): Map<number, RoadEdge[]> {
  const adjacency = new Map<number, RoadEdge[]>();
  const add = (nodeId: number, edge: RoadEdge) => {
    const list = adjacency.get(nodeId);
    if (list) list.push(edge);
    else adjacency.set(nodeId, [edge]);
  };
  for (const edge of district.roads) {
    add(edge.nodeIds[0], edge);
    add(edge.nodeIds[edge.nodeIds.length - 1], edge);
  }
  return adjacency;
}

export function roundaboutRadius(node: RoadNode): number {
  return 6 + Math.min(4, node.degree);
}

function headingIntoNode(edge: RoadEdge, nodeId: number): { x: number; z: number } {
  const pts = edge.points;
  const atEnd = edge.nodeIds[edge.nodeIds.length - 1] === nodeId;
  const a = atEnd ? pts[Math.max(0, pts.length - 2)] : pts[Math.min(pts.length - 1, 1)];
  const b = atEnd ? pts[pts.length - 1] : pts[0];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

function headingOutOfNode(edge: RoadEdge, nodeId: number): { x: number; z: number } {
  const pts = edge.points;
  const atStart = edge.nodeIds[0] === nodeId;
  const a = atStart ? pts[0] : pts[pts.length - 1];
  const b = atStart ? pts[Math.min(pts.length - 1, 1)] : pts[Math.max(0, pts.length - 2)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

/** A synthetic, car-local road edge tracing the arc of a roundabout ring from where a
 * car enters (continuing straight off `entryEdge`) to where it exits (continuing
 * straight onto `exitEdge`), always circulating the same rotational direction. Not part
 * of `district.roads` — built fresh per car per roundabout entry, consumed once. */
export function buildRoundaboutArc(node: RoadNode, entryEdge: RoadEdge, exitEdge: RoadEdge, nodeId: number): RoadEdge {
  const R = roundaboutRadius(node);
  const into = headingIntoNode(entryEdge, nodeId);
  const out = headingOutOfNode(exitEdge, nodeId);
  const entryTheta = Math.atan2(into.x, into.z);
  const exitTheta = Math.atan2(out.x, out.z);
  const twoPi = Math.PI * 2;
  const arcSpan = ((exitTheta - entryTheta) % twoPi + twoPi) % twoPi || twoPi;

  const steps = 10;
  const points = Array.from({ length: steps + 1 }, (_, s) => {
    const theta = entryTheta + (arcSpan * s) / steps;
    return { x: node.pos.x + R * Math.sin(theta), z: node.pos.z + R * Math.cos(theta) };
  });

  const entryMarker = -(2_000_000 + nodeId * 100 + 1);
  const exitMarker = -(2_000_000 + nodeId * 100 + 2);

  return {
    id: `ring-${nodeId}-${Math.random().toString(36).slice(2, 8)}`,
    wayId: -(3_000_000 + nodeId),
    name: 'Roundabout',
    highwayClass: 'residential',
    baseLanes: 1,
    points,
    nodeIds: [entryMarker, exitMarker],
    lengthM: Math.max(4, R * arcSpan),
  };
}
