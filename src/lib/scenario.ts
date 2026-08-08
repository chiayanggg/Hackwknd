import type { CityEdits, DistrictData, EdgeMetrics } from '../types';
import { aggregateMetrics } from './costEngine';

const CO2_FACTOR = 0.02;
const FUEL_FACTOR = 0.55;

export interface ScenarioRow {
  label: string;
  unit: string;
  baseline: number;
  proposed: number;
  higherIsBetter: boolean;
  decimals: number;
}

function avgTravelTimeMin(district: DistrictData, metrics: Map<string, EdgeMetrics>): number {
  let total = 0;
  let n = 0;
  for (const road of district.roads) {
    const m = metrics.get(road.id);
    if (!m) continue;
    total += (road.lengthM / 1000 / Math.max(5, m.speed)) * 60;
    n++;
  }
  return n ? total / n : 0;
}

function maxQueue(metrics: Map<string, EdgeMetrics>): number {
  let mx = 0;
  for (const m of metrics.values()) mx = Math.max(mx, m.queueLengthM);
  return mx;
}

function totalDelayVehHr(metrics: Map<string, EdgeMetrics>): number {
  let s = 0;
  for (const m of metrics.values()) s += m.effectiveFlow * (m.waitingTimeSec / 3600);
  return s;
}

function throughputVehHr(metrics: Map<string, EdgeMetrics>): number {
  let s = 0;
  for (const m of metrics.values()) s += m.throughputVehPerHr;
  return s;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Not a real emissions/safety model — same congestion-driven index used elsewhere in the
// engine, just expressed as an absolute score instead of a delta so it can sit next to
// baseline in a comparison table.
function safetyIndex(avgCongestion: number, hasRoundabout: boolean, hasLightsRemoved: boolean): number {
  let score = 100 - avgCongestion * 35;
  if (hasRoundabout) score += 8;
  if (hasLightsRemoved) score -= 20;
  return clamp(Math.round(score), 0, 100);
}

export function computeScenarioRows(district: DistrictData, edits: CityEdits, currentMetrics: Map<string, EdgeMetrics>, baselineMetrics: Map<string, EdgeMetrics>): ScenarioRow[] {
  const cur = aggregateMetrics(currentMetrics);
  const base = aggregateMetrics(baselineMetrics);

  const hasBusLane = Object.values(edits.edgeEdits).some((e) => e.hasBusLane);
  const hasRoundabout = Object.values(edits.nodeEdits).some((e) => e.roundabout);
  const hasLightsRemoved = Object.values(edits.nodeEdits).some((e) => !e.roundabout && !e.trafficLights);
  const parkCount = edits.placedItems.filter((p) => p.type === 'park').length;

  const co2 = (avgCongestion: number, busLane: boolean, parks: number) => Math.max(0, avgCongestion * CO2_FACTOR * (busLane ? 0.9 : 1) - parks * 0.01);
  const fuel = (avgCongestion: number, busLane: boolean, parks: number) => Math.max(0, avgCongestion * FUEL_FACTOR * (busLane ? 0.92 : 1) - parks * 0.3);

  return [
    { label: 'Average Speed', unit: 'km/h', baseline: base.speed, proposed: cur.speed, higherIsBetter: true, decimals: 1 },
    { label: 'Avg Travel Time', unit: 'min', baseline: avgTravelTimeMin(district, baselineMetrics), proposed: avgTravelTimeMin(district, currentMetrics), higherIsBetter: false, decimals: 1 },
    { label: 'Max Queue', unit: 'm', baseline: maxQueue(baselineMetrics), proposed: maxQueue(currentMetrics), higherIsBetter: false, decimals: 0 },
    { label: 'Total Delay', unit: 'veh-hr/h', baseline: totalDelayVehHr(baselineMetrics), proposed: totalDelayVehHr(currentMetrics), higherIsBetter: false, decimals: 0 },
    { label: 'Throughput', unit: 'veh/hr', baseline: throughputVehHr(baselineMetrics), proposed: throughputVehHr(currentMetrics), higherIsBetter: true, decimals: 0 },
    { label: 'CO2 Emissions', unit: 't (idx)', baseline: co2(base.congestion, false, 0), proposed: co2(cur.congestion, hasBusLane, parkCount), higherIsBetter: false, decimals: 2 },
    { label: 'Fuel Consumption', unit: 'L (idx)', baseline: fuel(base.congestion, false, 0), proposed: fuel(cur.congestion, hasBusLane, parkCount), higherIsBetter: false, decimals: 0 },
    { label: 'Safety Index', unit: '/100', baseline: safetyIndex(base.congestion, false, false), proposed: safetyIndex(cur.congestion, hasRoundabout, hasLightsRemoved), higherIsBetter: true, decimals: 0 },
  ];
}

export function computeOverallScore(rows: ScenarioRow[]): { score: number; deltaPts: number } {
  const baselineScore = 50;
  let improvementSum = 0;
  for (const r of rows) {
    const pct = r.baseline !== 0 ? ((r.proposed - r.baseline) / Math.abs(r.baseline)) * 100 : 0;
    const signed = r.higherIsBetter ? pct : -pct;
    improvementSum += clamp(signed, -50, 50);
  }
  const avgImprovement = improvementSum / rows.length;
  const score = clamp(Math.round(baselineScore + avgImprovement), 0, 100);
  return { score, deltaPts: score - baselineScore };
}

export function rowChangePct(row: ScenarioRow): number {
  if (row.baseline === 0) return row.proposed === 0 ? 0 : 100;
  return ((row.proposed - row.baseline) / Math.abs(row.baseline)) * 100;
}
