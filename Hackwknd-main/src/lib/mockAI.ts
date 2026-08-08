import type { AnalysisResult, CityEdits, DerivedMetrics, Mode } from '../types';
import { HIGH_CONGESTION_THRESHOLD } from './ruleEngine';

/**
 * Mimics the /api/analyze Gemini call described in the project doc (section 7.3):
 * takes rule-engine outputs + context, returns a structured recommendation.
 * Never invents numbers — only narrates what the rule engine computed.
 */
export function generateAnalysis(edits: CityEdits, derived: DerivedMetrics, mode: Mode): AnalysisResult {
  void mode;
  const hasRoundabout = Object.values(edits.nodeEdits).some((e) => e.roundabout);
  const hasEdits = Object.keys(edits.edgeEdits).length > 0 || Object.keys(edits.nodeEdits).length > 0;

  let recommendation: AnalysisResult['recommendation'];
  if (!hasEdits) {
    recommendation = derived.worstCongestion >= HIGH_CONGESTION_THRESHOLD ? 'conditional-on-time' : 'suitable';
  } else if (hasRoundabout) {
    recommendation = derived.worstCongestion >= HIGH_CONGESTION_THRESHOLD ? 'conditional-on-time' : 'suitable';
  } else if (derived.avgCongestion < 0.7) {
    recommendation = 'suitable';
  } else if (derived.avgCongestion < 0.95) {
    recommendation = 'conditional-on-time';
  } else {
    recommendation = 'not worth it';
  }

  const explanation = buildExplanation(recommendation, derived, hasRoundabout);
  const safetyNote = buildSafetyNote(edits, derived);
  const sandboxReactions = buildSandboxReactions(edits, derived, recommendation);
  const confidencePct = computeConfidence(derived);

  return { recommendation, explanation, safetyNote, sandboxReactions, confidencePct };
}

// Not a real model confidence — just how far the numbers sit from a decision boundary.
// Numbers right on the edge of a threshold get a lower confidence than ones clearly past it.
function computeConfidence(derived: DerivedMetrics): number {
  const distances = [
    Math.abs(derived.worstCongestion - HIGH_CONGESTION_THRESHOLD),
    Math.abs(derived.avgCongestion - 0.7),
    Math.abs(derived.avgCongestion - 0.95),
  ];
  const minDist = Math.min(...distances);
  const confidence = 65 + Math.min(30, minDist * 150);
  return Math.round(Math.max(60, Math.min(95, confidence)));
}

function buildExplanation(recommendation: AnalysisResult['recommendation'], derived: DerivedMetrics, hasRoundabout: boolean): string {
  const worstPct = Math.round(derived.worstCongestion * 100);
  const avgPct = Math.round(derived.avgCongestion * 100);

  if (recommendation === 'suitable') {
    return `Suitable across the district — average utilisation sits at ${avgPct}%, and even the busiest road (${derived.worstEdgeName}) peaks at ${worstPct}%. No segment breaks down.`;
  }
  if (recommendation === 'conditional-on-time') {
    if (hasRoundabout) {
      return `The roundabout helps overall, but ${derived.worstEdgeName} still hits ${worstPct}% utilisation during peak — that's past the point roundabouts handle well. Consider signals or a wider approach there for peak hours specifically.`;
    }
    return `Conditional — district average utilisation is ${avgPct}%, but ${derived.worstEdgeName} is the pressure point at ${worstPct}%. Worth targeting that specific road before declaring the change a success.`;
  }
  return `Not worth it as proposed — ${derived.worstEdgeName} reaches ${worstPct}% utilisation and the district average is already ${avgPct}%. A larger intervention or demand reduction is needed before this pays off.`;
}

function buildSafetyNote(edits: CityEdits, derived: DerivedMetrics): string {
  const direction = derived.accidentProbChangePct < 0 ? 'improve' : derived.accidentProbChangePct > 0 ? 'worsen' : 'stay flat';
  const magnitude = Math.abs(derived.accidentProbChangePct).toFixed(1);
  let note = `Accident risk projected to ${direction} by ${magnitude}% relative to baseline.`;
  const hasRoundabout = Object.values(edits.nodeEdits).some((e) => e.roundabout);
  const hasLightsRemoved = Object.values(edits.nodeEdits).some((e) => !e.roundabout && !e.trafficLights);
  if (hasRoundabout) note += ' Add zebra crossings and cyclist refuge islands on all approaches.';
  if (hasLightsRemoved) note += ' Warning: signals removed with no roundabout in place at that junction — high risk, reinstate control.';
  return note;
}

function buildSandboxReactions(edits: CityEdits, derived: DerivedMetrics, recommendation: AnalysisResult['recommendation']): string[] {
  const lines: string[] = [];
  if (derived.populationCapacityDelta > 0) lines.push(`Population up by ${derived.populationCapacityDelta}.`);
  if (derived.co2ChangePct < -1) lines.push('Flood risk reduced.');
  if (edits.placedItems.some((p) => p.type === 'park')) lines.push('Walk score up.');
  if (edits.placedItems.some((p) => p.type === 'evStation')) lines.push('EV drivers cheer.');
  const hasRoundabout = Object.values(edits.nodeEdits).some((e) => e.roundabout);
  if (hasRoundabout) lines.push(recommendation === 'suitable' ? 'Traffic flows like a dream.' : 'Rush hour gridlock incoming.');
  if (lines.length === 0) lines.push('No major change yet — pick a tool and click the city.');
  return lines;
}
