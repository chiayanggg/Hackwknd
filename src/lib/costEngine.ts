import type { CityEdits, DerivedMetrics, DistrictData, EdgeMetrics, TimePeriod } from '../types';
import { PERIOD_ANCHOR_HOUR } from '../types';
import { computeAllEdgeMetrics, computeBaseFlows, HIGH_CONGESTION_THRESHOLD } from './ruleEngine';

const PARK_COST = 1_200_000;
const PARK_MONTHS = 3;
const APARTMENT_COST_PER_UNIT = 180_000;
const APARTMENT_MONTHS = 10;
const EV_COST = 180_000;
const EV_MONTHS = 1;
const SCHOOL_COST = 15_000_000;
const SCHOOL_MONTHS = 18;
const HOSPITAL_COST = 40_000_000;
const HOSPITAL_MONTHS = 24;
const LAKE_COST = 3_000_000;
const LAKE_MONTHS = 6;
const ROUNDABOUT_COST = 2_500_000;
const ROUNDABOUT_MONTHS = 8;
const WIDEN_COST_PER_LANE_KM = 850_000;
const WIDEN_MONTHS = 4;
const BUS_LANE_COST_PER_KM = 150_000;
const BUS_LANE_MONTHS = 2;
const TRAFFIC_LIGHTS_COST = 250_000;
const TRAFFIC_LIGHTS_MONTHS = 1;
const RESIDENTS_PER_UNIT = 3.2;
const CO2_EMISSION_FACTOR = 0.02;
const UNITS_PER_APARTMENT_PLACEMENT = 50;

export function computeCostAndTime(district: DistrictData, edits: CityEdits) {
  let costRM = 0;
  const monthsList: number[] = [];
  const roadsById = new Map(district.roads.map((r) => [r.id, r]));

  for (const [edgeId, edit] of Object.entries(edits.edgeEdits)) {
    const road = roadsById.get(edgeId);
    if (!road) continue;
    const km = Math.max(0.05, road.lengthM / 1000);
    if (edit.widenCount > 0) {
      costRM += edit.widenCount * km * WIDEN_COST_PER_LANE_KM;
      monthsList.push(WIDEN_MONTHS);
    }
    if (edit.hasBusLane) {
      costRM += km * BUS_LANE_COST_PER_KM;
      monthsList.push(BUS_LANE_MONTHS);
    }
  }

  for (const edit of Object.values(edits.nodeEdits)) {
    if (edit.roundabout) {
      costRM += ROUNDABOUT_COST;
      monthsList.push(ROUNDABOUT_MONTHS);
    }
    if (!edit.trafficLights && !edit.roundabout) {
      costRM += TRAFFIC_LIGHTS_COST;
      monthsList.push(TRAFFIC_LIGHTS_MONTHS);
    }
  }

  const counts = { apartments: 0, park: 0, evStation: 0, school: 0, hospital: 0, lake: 0 };
  for (const item of edits.placedItems) counts[item.type]++;

  if (counts.apartments > 0) {
    costRM += counts.apartments * UNITS_PER_APARTMENT_PLACEMENT * APARTMENT_COST_PER_UNIT;
    monthsList.push(APARTMENT_MONTHS);
  }
  if (counts.park > 0) {
    costRM += counts.park * PARK_COST;
    monthsList.push(counts.park * PARK_MONTHS);
  }
  if (counts.evStation > 0) {
    costRM += counts.evStation * EV_COST;
    monthsList.push(EV_MONTHS);
  }
  if (counts.school > 0) {
    costRM += counts.school * SCHOOL_COST;
    monthsList.push(SCHOOL_MONTHS);
  }
  if (counts.hospital > 0) {
    costRM += counts.hospital * HOSPITAL_COST;
    monthsList.push(HOSPITAL_MONTHS);
  }
  if (counts.lake > 0) {
    costRM += counts.lake * LAKE_COST;
    monthsList.push(LAKE_MONTHS);
  }

  const constructionMonths = monthsList.length ? Math.max(...monthsList) : 0;
  return { costRM, constructionMonths, counts };
}

/** Real OSM roads get chopped into many short way fragments (speed-limit changes, bridge
 * boundaries, lane-count changes...). Summing a per-edge metric like flow or throughput
 * across every fragment counts the same physical traffic several times over — a road cut
 * into 6 pieces isn't carrying 6x the cars. This collapses fragments back to one number
 * per distinct named road (max across its fragments, since they're the same corridor)
 * before summing across genuinely different roads. */
export function distinctRoadTotal(district: DistrictData, metrics: Map<string, EdgeMetrics>, pick: (m: EdgeMetrics) => number): number {
  const byName = new Map<string, number>();
  for (const road of district.roads) {
    const m = metrics.get(road.id);
    if (!m) continue;
    const value = pick(m);
    const key = road.name || road.id;
    byName.set(key, Math.max(byName.get(key) ?? 0, value));
  }
  let total = 0;
  for (const v of byName.values()) total += v;
  return total;
}

function averageCongestion(metrics: Map<string, EdgeMetrics>): number {
  if (metrics.size === 0) return 0;
  let sum = 0;
  for (const m of metrics.values()) sum += m.congestion;
  return sum / metrics.size;
}

export interface AggregateMetrics {
  congestion: number;
  speed: number;
  waitingTimeSec: number;
  effectiveFlow: number;
}

export function aggregateMetrics(metrics: Map<string, EdgeMetrics>): AggregateMetrics {
  if (metrics.size === 0) return { congestion: 0, speed: 0, waitingTimeSec: 0, effectiveFlow: 0 };
  let congestion = 0;
  let speed = 0;
  let waitingTimeSec = 0;
  let effectiveFlow = 0;
  for (const m of metrics.values()) {
    congestion += m.congestion;
    speed += m.speed;
    waitingTimeSec += m.waitingTimeSec;
    effectiveFlow += m.effectiveFlow;
  }
  const n = metrics.size;
  return { congestion: congestion / n, speed: speed / n, waitingTimeSec: waitingTimeSec / n, effectiveFlow };
}

/** Both metric maps must be evaluated at the same simulated hour — this is a same-moment
 * baseline-vs-proposed comparison, not a daily average, so an edit's effect is never
 * diluted by hours where it wouldn't matter. */
export function computeDerivedMetrics(
  district: DistrictData,
  edits: CityEdits,
  currentMetrics: Map<string, EdgeMetrics>,
  baselineMetrics: Map<string, EdgeMetrics>
): DerivedMetrics {
  const { costRM, constructionMonths, counts } = computeCostAndTime(district, edits);

  const avgCongestion = averageCongestion(currentMetrics);
  const baseAvgCongestion = averageCongestion(baselineMetrics);

  let worstEdgeName = '—';
  let worstCongestion = 0;
  for (const road of district.roads) {
    const m = currentMetrics.get(road.id);
    if (m && m.congestion > worstCongestion) {
      worstCongestion = m.congestion;
      worstEdgeName = road.name;
    }
  }

  const hasBusLane = Object.values(edits.edgeEdits).some((e) => e.hasBusLane);
  const co2Current = avgCongestion * CO2_EMISSION_FACTOR * (hasBusLane ? 0.9 : 1) - counts.park * 0.01;
  const co2Base = baseAvgCongestion * CO2_EMISSION_FACTOR;
  const co2ChangePct = pctChange(co2Base, co2Current);

  const hasRoundabout = Object.values(edits.nodeEdits).some((e) => e.roundabout);
  const hasLightsRemoved = Object.values(edits.nodeEdits).some((e) => !e.roundabout && !e.trafficLights);
  let riskIndex = 100;
  if (hasRoundabout) riskIndex *= avgCongestion < HIGH_CONGESTION_THRESHOLD ? 0.82 : 1.1;
  if (hasLightsRemoved) riskIndex *= 1.3;
  const accidentProbChangePct = riskIndex - 100;

  const populationCapacityDelta = Math.round(counts.apartments * UNITS_PER_APARTMENT_PLACEMENT * RESIDENTS_PER_UNIT);

  let baseWaitAvg = 0;
  let curWaitAvg = 0;
  let n = 0;
  for (const road of district.roads) {
    const b = baselineMetrics.get(road.id);
    const c = currentMetrics.get(road.id);
    if (b && c) {
      baseWaitAvg += b.waitingTimeSec;
      curWaitAvg += c.waitingTimeSec;
      n++;
    }
  }
  const travelTimeSavedMin = n > 0 ? Math.round(((baseWaitAvg - curWaitAvg) / n / 60) * 10) / 10 : 0;

  return {
    costRM,
    constructionMonths,
    co2ChangePct: round1(co2ChangePct),
    accidentProbChangePct: round1(accidentProbChangePct),
    populationCapacityDelta,
    travelTimeSavedMin,
    avgCongestion,
    worstEdgeName,
    worstCongestion,
  };
}

/** The 4 quick-jump presets (AM/Mid/PM/Night), each pinned to its representative hour —
 * used for preset dot colors, not the live simulation (which reads the continuous hour). */
export function computeMetricsForAllPeriods(district: DistrictData, edits: CityEdits): Record<TimePeriod, Map<string, EdgeMetrics>> {
  const baseFlows = computeBaseFlows(district.roads);
  const periods: TimePeriod[] = ['am', 'mid', 'pm', 'night'];
  const result = {} as Record<TimePeriod, Map<string, EdgeMetrics>>;
  for (const p of periods) result[p] = computeAllEdgeMetrics(district, edits, baseFlows, PERIOD_ANCHOR_HOUR[p]);
  return result;
}

export function computeMetricsAtHour(district: DistrictData, edits: CityEdits, hour: number): Map<string, EdgeMetrics> {
  const baseFlows = computeBaseFlows(district.roads);
  return computeAllEdgeMetrics(district, edits, baseFlows, hour);
}

export interface FlowSample {
  hour: number;
  baselineVehicles: number;
  proposedVehicles: number;
}

/** Samples the real rule engine across the day (not fabricated data) — used for the
 * traffic-flow chart. `steps` evaluations of the whole road network; fine at 24-48, only
 * recomputed when the district loads or edits change, never per-frame. */
export function computeDailyFlowSeries(district: DistrictData, edits: CityEdits, steps = 24): FlowSample[] {
  const baseFlows = computeBaseFlows(district.roads);
  const baseline = { edgeEdits: {}, nodeEdits: {}, placedItems: [] } as CityEdits;
  const samples: FlowSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const hour = (i / steps) * 24;
    const baseMetrics = computeAllEdgeMetrics(district, baseline, baseFlows, hour);
    const proposedMetrics = computeAllEdgeMetrics(district, edits, baseFlows, hour);
    let baselineVehicles = 0;
    let proposedVehicles = 0;
    for (const m of baseMetrics.values()) baselineVehicles += m.effectiveFlow;
    for (const m of proposedMetrics.values()) proposedVehicles += m.effectiveFlow;
    samples.push({ hour, baselineVehicles: Math.round(baselineVehicles), proposedVehicles: Math.round(proposedVehicles) });
  }
  return samples;
}

function pctChange(base: number, current: number): number {
  if (base === 0) return current === 0 ? 0 : 100;
  return ((current - base) / base) * 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
