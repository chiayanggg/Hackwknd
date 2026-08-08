import type { Vec2 } from './lib/geo';

export type TimePeriod = 'am' | 'mid' | 'pm' | 'night';
export type Mode = 'professional' | 'sandbox';

export type RoadToolId = 'roundabout' | 'widen' | 'busLane' | 'trafficLights';
export type BuildingToolId = 'apartments' | 'park' | 'evStation' | 'school' | 'hospital' | 'lake';
export type ToolId = RoadToolId | BuildingToolId;

export type ToolCategory = 'Road' | 'Transit' | 'Building' | 'Environment' | 'Sandbox';
export type ToolTarget = 'node' | 'edge' | 'ground';

// ---- Static district data (loaded once from OSM, never mutated) ----

export interface RoadEdge {
  id: string;
  wayId: number;
  name: string;
  highwayClass: string;
  baseLanes: number;
  points: Vec2[]; // polyline in scene meters
  nodeIds: number[]; // OSM node ids along the polyline (first/last are endpoints)
  lengthM: number;
}

export interface RoadNode {
  id: number;
  pos: Vec2;
  degree: number; // how many distinct edges touch this node
  isJunction: boolean; // degree >= 3
}

export interface BuildingFootprint {
  id: string;
  points: Vec2[];
  levels: number;
}

export interface DistrictData {
  originName: string;
  roads: RoadEdge[];
  nodes: Map<number, RoadNode>;
  // Maps every raw junction-fragment node id to the one node id that actually
  // controls it — several close-together OSM nodes at one real crossroad share
  // the same representative here. Identity map for anything that isn't part of
  // a cluster.
  clusterRepOf: Map<number, number>;
  buildings: BuildingFootprint[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  source: 'overpass' | 'fallback';
}

// ---- Editable overlay (this is the "save state") ----

export interface EdgeEdit {
  widenCount: number;
  hasBusLane: boolean;
}

export interface NodeEdit {
  roundabout: boolean;
  trafficLights: boolean;
}

export interface PlacedItem {
  id: string;
  type: BuildingToolId;
  pos: Vec2;
}

export interface CityEdits {
  edgeEdits: Record<string, EdgeEdit>;
  nodeEdits: Record<number, NodeEdit>;
  placedItems: PlacedItem[];
}

export function emptyEdits(): CityEdits {
  return { edgeEdits: {}, nodeEdits: {}, placedItems: [] };
}

// ---- Simulation outputs ----

export interface EdgeMetrics {
  edgeId: string;
  effectiveFlow: number;
  capacity: number;
  congestion: number;
  speed: number;
  waitingTimeSec: number;
  queueLengthM: number; // backed-up length when demand exceeds capacity, 0 otherwise
  throughputVehPerHr: number; // actual vehicles that get through, capped by capacity
}

export interface DerivedMetrics {
  costRM: number;
  constructionMonths: number;
  co2ChangePct: number;
  accidentProbChangePct: number;
  populationCapacityDelta: number;
  travelTimeSavedMin: number;
  avgCongestion: number;
  worstEdgeName: string;
  worstCongestion: number;
}

export interface AnalysisResult {
  recommendation: 'suitable' | 'not worth it' | 'conditional-on-time';
  explanation: string;
  safetyNote: string;
  sandboxReactions: string[];
  confidencePct: number; // how decisive the underlying numbers are, not a real ML confidence
}

export const TIME_MULTIPLIERS: Record<TimePeriod, number> = {
  am: 1.6,
  mid: 1.0,
  pm: 1.8,
  night: 0.4,
};

export const TIME_LABELS: Record<TimePeriod, string> = {
  am: 'AM Peak (7-9)',
  mid: 'Midday (9-17)',
  pm: 'PM Peak (17-20)',
  night: 'Night (20-7)',
};

// Continuous time-of-day engine — the 4 buckets above are still used for quick-jump
// presets and "which period is this" reporting, but the actual simulation reads a
// smooth 0-24h value so the traffic-flow chart and slider aren't stepped.
interface TimeAnchor {
  hour: number;
  multiplier: number;
}

const TIME_ANCHORS: TimeAnchor[] = [
  { hour: 0, multiplier: 0.4 },
  { hour: 6, multiplier: 0.5 },
  { hour: 8, multiplier: 1.6 },
  { hour: 10, multiplier: 1.0 },
  { hour: 13, multiplier: 1.0 },
  { hour: 16, multiplier: 1.2 },
  { hour: 18, multiplier: 1.8 },
  { hour: 20, multiplier: 0.8 },
  { hour: 24, multiplier: 0.4 },
];

export function multiplierAtHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < TIME_ANCHORS.length - 1; i++) {
    const a = TIME_ANCHORS[i];
    const b = TIME_ANCHORS[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour);
      const smooth = t * t * (3 - 2 * t); // smoothstep — no kinks at anchor points
      return a.multiplier + (b.multiplier - a.multiplier) * smooth;
    }
  }
  return TIME_ANCHORS[0].multiplier;
}

export function hourToPeriod(hour: number): TimePeriod {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 9) return 'am';
  if (h >= 9 && h < 17) return 'mid';
  if (h >= 17 && h < 20) return 'pm';
  return 'night';
}

export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const mmAdj = mm === 60 ? 0 : mm;
  const hhAdj = mm === 60 ? (hh + 1) % 24 : hh;
  return `${String(hhAdj).padStart(2, '0')}:${String(mmAdj).padStart(2, '0')}`;
}

export const PERIOD_ANCHOR_HOUR: Record<TimePeriod, number> = {
  am: 8,
  mid: 13,
  pm: 18,
  night: 1,
};
