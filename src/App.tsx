import { useEffect, useMemo, useState } from 'react';
import { loadDistrict } from './lib/osm';
import { computeMetricsForAllPeriods, computeDerivedMetrics, aggregateMetrics } from './lib/costEngine';
import { generateAnalysis } from './lib/mockAI';
import { IconClose } from './components/icons';
import type { BuildingToolId, CityEdits, DistrictData, Mode, TimePeriod } from './types';
import { emptyEdits } from './types';
import type { ToolDef } from './data/tools';
import ModeToggle from './components/ModeToggle';
import TimeOfDaySelector from './components/TimeOfDaySelector';
import Toolbox from './components/Toolbox';
import CityScene from './components/CityScene';
import HudBar from './components/HudBar';
import KpiCards from './components/KpiCards';
import BeforeAfter from './components/BeforeAfter';
import RecommendationPanel from './components/RecommendationPanel';

export default function App() {
  const [district, setDistrict] = useState<DistrictData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<CityEdits>(emptyEdits());
  const [mode, setMode] = useState<Mode>('professional');
  const [period, setPeriod] = useState<TimePeriod>('mid');
  const [armedTool, setArmedTool] = useState<ToolDef | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    loadDistrict()
      .then(setDistrict)
      .catch((err) => setLoadError(String(err)));
  }, []);

  const baselineMetricsByPeriod = useMemo(() => (district ? computeMetricsForAllPeriods(district, emptyEdits()) : null), [district]);
  const metricsByPeriod = useMemo(() => (district ? computeMetricsForAllPeriods(district, edits) : null), [district, edits]);

  const derived = useMemo(() => {
    if (!district || !metricsByPeriod || !baselineMetricsByPeriod) return null;
    return computeDerivedMetrics(district, edits, metricsByPeriod, baselineMetricsByPeriod, period);
  }, [district, edits, metricsByPeriod, baselineMetricsByPeriod, period]);

  const analysis = useMemo(() => (derived ? generateAnalysis(edits, derived, mode) : null), [edits, derived, mode]);

  function handleArm(tool: ToolDef) {
    setArmedTool((prev) => (prev?.id === tool.id ? null : tool));
  }

  function handlePlaceNode(nodeId: number) {
    if (!armedTool || armedTool.target !== 'node') return;
    const toolId = armedTool.id;
    setEdits((e) => {
      const existing = e.nodeEdits[nodeId] ?? { roundabout: false, trafficLights: true };
      const next = { ...existing };
      if (toolId === 'roundabout') next.roundabout = true;
      if (toolId === 'trafficLights') next.trafficLights = !existing.trafficLights;
      return { ...e, nodeEdits: { ...e.nodeEdits, [nodeId]: next } };
    });
    setArmedTool(null);
  }

  function handlePlaceEdge(edgeId: string) {
    if (!armedTool || armedTool.target !== 'edge') return;
    const toolId = armedTool.id;
    setEdits((e) => {
      const existing = e.edgeEdits[edgeId] ?? { widenCount: 0, hasBusLane: false };
      const next = { ...existing };
      if (toolId === 'widen') next.widenCount = Math.min(3, existing.widenCount + 1);
      if (toolId === 'busLane') next.hasBusLane = true;
      return { ...e, edgeEdits: { ...e.edgeEdits, [edgeId]: next } };
    });
    setArmedTool(null);
  }

  function handlePlaceGround(x: number, z: number) {
    if (!armedTool || armedTool.target !== 'ground') return;
    const toolId = armedTool.id as BuildingToolId;
    setEdits((e) => ({
      ...e,
      placedItems: [...e.placedItems, { id: `${toolId}-${Date.now()}-${Math.round(x)}-${Math.round(z)}`, type: toolId, pos: { x, z } }],
    }));
    setArmedTool(null);
  }

  function handleRemoveItem(itemId: string) {
    setEdits((e) => ({ ...e, placedItems: e.placedItems.filter((p) => p.id !== itemId) }));
  }

  if (loadError) {
    return (
      <div className="h-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <p className="text-red-400 text-sm">Failed to load city data: {loadError}</p>
      </div>
    );
  }

  if (!district || !metricsByPeriod || !baselineMetricsByPeriod || !derived || !analysis) {
    return (
      <div className="h-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <p className="text-sm text-slate-400 animate-pulse">Loading real road &amp; building data for Kuala Lumpur…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* full-bleed 3D city — everything else floats on top of it */}
      <CityScene
        district={district}
        edits={edits}
        metrics={metricsByPeriod[period]}
        armedTool={armedTool}
        onPlaceNode={handlePlaceNode}
        onPlaceEdge={handlePlaceEdge}
        onPlaceGround={handlePlaceGround}
        onRemoveItem={handleRemoveItem}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md px-4 py-2.5 shadow-2xl">
          <h1 className="text-sm font-bold leading-tight">Smart City AI Planning Simulator</h1>
          <p className="text-[10px] text-slate-400">
            {district.originName} · {district.source === 'overpass' ? 'live OSM data' : 'offline fallback layout'} ·{' '}
            {district.roads.length} roads, {district.buildings.length} buildings
          </p>
        </div>
        <div className="pointer-events-auto">
          <TimeOfDaySelector period={period} onChange={setPeriod} metricsByPeriod={metricsByPeriod} />
        </div>
        <div className="pointer-events-auto">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* left tool dock */}
      <div className="pointer-events-none absolute top-24 left-4 z-20">
        <div className="pointer-events-auto">
          <Toolbox mode={mode} armedToolId={armedTool?.id ?? null} onArm={handleArm} />
        </div>
      </div>

      {/* right HUD */}
      <div className="pointer-events-none absolute top-24 right-4 z-20">
        <div className="pointer-events-auto">
          <HudBar derived={derived} reportOpen={reportOpen} onToggleReport={() => setReportOpen((v) => !v)} />
        </div>
      </div>

      {/* bottom-left recommendation + reset */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 sm:right-auto z-20 flex flex-col gap-2 sm:w-[420px]">
        <div className="pointer-events-auto">
          <RecommendationPanel analysis={analysis} mode={mode} />
        </div>
        <button
          onClick={() => setEdits(emptyEdits())}
          className="pointer-events-auto self-start rounded-full border border-white/10 bg-slate-950/75 backdrop-blur-md px-3 py-1 text-[11px] text-slate-400 hover:text-slate-200 shadow-xl"
        >
          Reset city to baseline
        </button>
      </div>

      {/* full report slide-in drawer */}
      {reportOpen && (
        <div className="absolute top-0 right-0 z-30 h-full w-full sm:w-[420px] overflow-y-auto border-l border-white/10 bg-slate-950/95 backdrop-blur-md p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Full report</h2>
            <button onClick={() => setReportOpen(false)} className="text-slate-400 hover:text-slate-200">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
          <KpiCards
            metrics={aggregateMetrics(metricsByPeriod[period])}
            baselineMetrics={aggregateMetrics(baselineMetricsByPeriod[period])}
            derived={derived}
          />
          <BeforeAfter before={aggregateMetrics(baselineMetricsByPeriod[period])} after={aggregateMetrics(metricsByPeriod[period])} />
          <p className="text-[11px] text-slate-500 pt-3 border-t border-white/10">
            Real road/building geometry from OpenStreetMap (Overpass API), rule-engine formulas from the project doc.
            Cars, trees and traffic lights are real <code>.glb</code> models; buildings are still procedural boxes
            pending building assets. Traffic lights and roundabout entries actually stop cars — deterministic phase
            cycles standing in for real signal timing/gap detection. AI recommendation is a rule-based mock standing
            in for the Gemini <code>/api/analyze</code> call — key's ready, not wired up yet.
          </p>
        </div>
      )}
    </div>
  );
}
