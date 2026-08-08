import type { CityEdits, DistrictData, EdgeMetrics, RoadEdge, TimePeriod } from '../types';
import { TIME_MULTIPLIERS } from '../types';

const LANE_CAPACITY = 900; // vehicles/hour/lane
const TRIPS_PER_APARTMENT_UNIT = 0.6;
export const HIGH_CONGESTION_THRESHOLD = 0.85;

export type CongestionBand = 'green' | 'yellow' | 'orange' | 'red';

const CONGESTION_BAND_COLOR: Record<CongestionBand, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

const CONGESTION_BAND_EMOJI: Record<CongestionBand, string> = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
};

// congestion is volume/capacity, can exceed 1.0 when oversubscribed — banded 0-25/25-50/50-75/75+
// as a 0-100 "congestion score" the way real traffic dashboards present it.
export function congestionBand(congestion: number): CongestionBand {
  const score = congestion * 100;
  if (score < 25) return 'green';
  if (score < 50) return 'yellow';
  if (score < 75) return 'orange';
  return 'red';
}

export function congestionColor(congestion: number): string {
  return CONGESTION_BAND_COLOR[congestionBand(congestion)];
}

export function congestionEmoji(congestion: number): string {
  return CONGESTION_BAND_EMOJI[congestionBand(congestion)];
}

function classBaseFlow(highwayClass: string): number {
  switch (highwayClass) {
    case 'motorway':
    case 'trunk':
    case 'primary':
      return 1400;
    case 'secondary':
      return 1000;
    case 'tertiary':
      return 700;
    default:
      return 400;
  }
}

function classFreeFlowSpeed(highwayClass: string): number {
  switch (highwayClass) {
    case 'motorway':
    case 'trunk':
    case 'primary':
      return 60;
    case 'secondary':
      return 50;
    case 'tertiary':
      return 40;
    default:
      return 30;
  }
}

function hash(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

export function computeBaseFlows(roads: RoadEdge[]): { baseFlowByEdge: Map<string, number>; total: number } {
  const baseFlowByEdge = new Map<string, number>();
  let total = 0;
  for (const road of roads) {
    const flow = classBaseFlow(road.highwayClass) * (0.7 + 0.6 * hash(road.wayId));
    baseFlowByEdge.set(road.id, flow);
    total += flow;
  }
  return { baseFlowByEdge, total };
}

function apartmentUnitsFromEdits(edits: CityEdits): number {
  return edits.placedItems.filter((p) => p.type === 'apartments').length * 50;
}

function edgeDelayFactor(edge: RoadEdge, edits: CityEdits, congestion: number): number {
  let sawRoundabout = false;
  let sawLightsRemoved = false;
  for (const nid of edge.nodeIds) {
    const ne = edits.nodeEdits[nid];
    if (!ne) continue;
    if (ne.roundabout) sawRoundabout = true;
    if (!ne.roundabout && !ne.trafficLights) sawLightsRemoved = true;
  }
  if (sawRoundabout) return congestion < HIGH_CONGESTION_THRESHOLD ? 0.7 : 1.25;
  if (sawLightsRemoved) return 1.3;
  return 1.0;
}

function edgeHasRoundabout(edge: RoadEdge, edits: CityEdits): boolean {
  return edge.nodeIds.some((nid) => edits.nodeEdits[nid]?.roundabout);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeEdgeMetrics(
  edge: RoadEdge,
  edits: CityEdits,
  baseFlows: { baseFlowByEdge: Map<string, number>; total: number },
  period: TimePeriod
): EdgeMetrics {
  const apartmentUnits = apartmentUnitsFromEdits(edits);
  const tripsTotal = apartmentUnits * TRIPS_PER_APARTMENT_UNIT;
  const ownBaseFlow = baseFlows.baseFlowByEdge.get(edge.id) ?? classBaseFlow(edge.highwayClass);
  const share = baseFlows.total > 0 ? ownBaseFlow / baseFlows.total : 0;
  const baseFlowWithTrips = ownBaseFlow + tripsTotal * share;
  const effectiveFlow = baseFlowWithTrips * TIME_MULTIPLIERS[period];

  const edgeEdit = edits.edgeEdits[edge.id];
  const effectiveLanes = Math.max(1, edge.baseLanes + (edgeEdit?.widenCount ?? 0) - (edgeEdit?.hasBusLane ? 1 : 0));
  const roundaboutBonus = edgeHasRoundabout(edge, edits) ? 1.1 : 1;
  const capacity = LANE_CAPACITY * effectiveLanes * roundaboutBonus;

  const congestion = effectiveFlow / capacity;
  const delayFactor = edgeDelayFactor(edge, edits, congestion);
  const freeFlowSpeed = classFreeFlowSpeed(edge.highwayClass);
  const speed = freeFlowSpeed * clamp(1 - congestion * 0.55, 0.15, 1);

  const baseWaitSec = edgeHasRoundabout(edge, edits) ? 12 : 20;
  const waitingTimeSec = baseWaitSec * delayFactor * (1 + Math.pow(congestion, 3) * 3);

  return { edgeId: edge.id, effectiveFlow, capacity, congestion, speed, waitingTimeSec };
}

export function computeAllEdgeMetrics(
  district: DistrictData,
  edits: CityEdits,
  baseFlows: { baseFlowByEdge: Map<string, number>; total: number },
  period: TimePeriod
): Map<string, EdgeMetrics> {
  const result = new Map<string, EdgeMetrics>();
  for (const edge of district.roads) result.set(edge.id, computeEdgeMetrics(edge, edits, baseFlows, period));
  return result;
}
