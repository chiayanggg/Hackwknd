import type { CityEdits, DistrictData, NodeEdit, RoadEdge, RoadNode } from '../types';

export type SignalColor = 'green' | 'red';

const SIGNAL_CYCLE_SEC = 14; // real signalised junction: ~7s green per approach group
const ROUNDABOUT_CYCLE_SEC = 5; // shorter, more frequent — approximates natural gaps in circulating traffic
export const STOP_LINE_DISTANCE_M = 9;

export type ApproachGroups = Map<string, 0 | 1>; // edgeId -> group, per junction node

/** Split the edges touching each junction into two alternating "approach groups", the
 * same way a real signal controller pairs opposite/adjacent approaches on one phase. */
export function computeApproachGroups(district: DistrictData): Map<number, ApproachGroups> {
  const result = new Map<number, ApproachGroups>();
  for (const node of district.nodes.values()) {
    if (!node.isJunction) continue;
    const touching = district.roads.filter((e) => e.nodeIds[0] === node.id || e.nodeIds[e.nodeIds.length - 1] === node.id);
    const groups: ApproachGroups = new Map();
    touching.forEach((e, i) => groups.set(e.id, (i % 2) as 0 | 1));
    result.set(node.id, groups);
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
  const id = end === 'start' ? edge.nodeIds[0] : edge.nodeIds[edge.nodeIds.length - 1];
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
