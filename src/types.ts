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
