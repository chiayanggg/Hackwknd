import { useEffect, useMemo, useState } from 'react';
import { loadDistrict } from './lib/osm';
import { computeMetricsAtHour, computeDerivedMetrics, computeDailyFlowSeries, aggregateMetrics, distinctRoadTotal } from './lib/costEngine';
import { computeScenarioRows, computeOverallScore } from './lib/scenario';
import { generateAnalysis } from './lib/mockAI';
import type { BuildingToolId, CityEdits, DistrictData, Mode } from './types';
import { emptyEdits } from './types';
import type { ToolDef } from './data/tools';
import type { NavTab } from './components/TopNav';
import TopNav from './components/TopNav';
import CityScene from './components/CityScene';
import InterventionToolsList from './components/InterventionToolsList';
import ScenarioComparisonPanel from './components/ScenarioComparisonPanel';
import TrafficLegendPanel from './components/TrafficLegendPanel';
import RecommendationPanel from './components/RecommendationPanel';
import TrafficFlowChart from './components/TrafficFlowChart';
import TimeControls from './components/TimeControls';
import SummaryMetricsStrip from './components/SummaryMetricsStrip';
import MiniMap from './components/MiniMap';
import KpiCards from './components/KpiCards';
import BeforeAfter from './components/BeforeAfter';
import { IconClose, IconBuilding } from './components/icons';
import AccessibilityRoutesPanel, { type AccessibilityRoute } from './components/AccessibilityRoutesPanel';

export default function App() {
  const [district, setDistrict] = useState<DistrictData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<CityEdits>(emptyEdits());
  const [mode, setMode] = useState<Mode>('professional');
  const [hour, setHour] = useState(13);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [armedTool, setArmedTool] = useState<ToolDef | null>(null);
  const [tab, setTab] = useState<NavTab>('map');
  const [mobileDrawer, setMobileDrawer] = useState<'tools' | 'stats' | null>(null);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [accessibilityRoute, setAccessibilityRoute] = useState<AccessibilityRoute>('most-accessible');

  useEffect(() => {
    loadDistrict()
      .then(setDistrict)
      .catch((err) => setLoadError(String(err)));
  }, []);

  const metricsAtHour = useMemo(() => (district ? computeMetricsAtHour(district, edits, hour) : null), [district, edits, hour]);
  const baselineMetricsAtHour = useMemo(() => (district ? computeMetricsAtHour(district, emptyEdits(), hour) : null), [district, hour]);

  const derived = useMemo(() => {
    if (!district || !metricsAtHour || !baselineMetricsAtHour) return null;
    return computeDerivedMetrics(district, edits, metricsAtHour, baselineMetricsAtHour);
  }, [district, edits, metricsAtHour, baselineMetricsAtHour]);

  const scenarioRows = useMemo(() => {
    if (!district || !metricsAtHour || !baselineMetricsAtHour) return null;
    return computeScenarioRows(district, edits, metricsAtHour, baselineMetricsAtHour);
  }, [district, edits, metricsAtHour, baselineMetricsAtHour]);

  const overallScore = useMemo(() => (scenarioRows ? computeOverallScore(scenarioRows) : null), [scenarioRows]);

  const flowSeries = useMemo(() => (district ? computeDailyFlowSeries(district, edits) : null), [district, edits]);

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

  if (!district || !metricsAtHour || !baselineMetricsAtHour || !derived || !analysis || !scenarioRows || !overallScore || !flowSeries) {
    return (
      <div className="h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-5 p-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
            <IconBuilding className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Smart City Simulator</span>
        </div>

        {/* a little pulsing skyline while the real road/building data streams in */}
        <div className="flex items-end gap-1.5 h-12">
          {[10, 22, 14, 32, 18, 26, 12].map((h, i) => (
            <div
              key={i}
              className="w-3 rounded-t-sm bg-sky-500/60 animate-pulse"
              style={{ height: `${h * 1.1}px`, animationDelay: `${i * 0.12}s`, animationDuration: '1.4s' }}
            />
          ))}
        </div>

        <p className="text-sm text-slate-400">Loading real road &amp; building data for Kuala Lumpur…</p>
      </div>
    );
  }

  const curAgg = aggregateMetrics(metricsAtHour);
  const baseAgg = aggregateMetrics(baselineMetricsAtHour);
  // Distinct-road totals, not aggregateMetrics().effectiveFlow — that sums every OSM way
  // fragment, double-counting the same physical traffic several times over.
  const curTotalVehicles = distinctRoadTotal(district, metricsAtHour, (m) => m.effectiveFlow);
  const baseTotalVehicles = distinctRoadTotal(district, baselineMetricsAtHour, (m) => m.effectiveFlow);
  const pctChange = (base: number, cur: number) => (base !== 0 ? ((cur - base) / Math.abs(base)) * 100 : 0);
  const co2Row = scenarioRows.find((r) => r.label === 'CO2 Emissions')!;
  const speedRow = scenarioRows.find((r) => r.label === 'Average Speed')!;
  const delayRow = scenarioRows.find((r) => r.label === 'Total Delay')!;
  const hasBusLane = Object.values(edits.edgeEdits).some((e) => e.hasBusLane);
  const publicTransportPct = 12 + (hasBusLane ? 18 : 0);
  const baselinePublicTransportPct = 12;

  return (
    <div className="relative h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      <CityScene
        district={district}
        edits={edits}
        metrics={metricsAtHour}
        hour={hour}
        armedTool={armedTool}
        onPlaceNode={handlePlaceNode}
        onPlaceEdge={handlePlaceEdge}
        onPlaceGround={handlePlaceGround}
        onRemoveItem={handleRemoveItem}
        accessibilityEnabled={accessibilityEnabled}
        accessibilityRoute={accessibilityRoute}
      />

      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col p-3 sm:p-4 gap-3">
        <div className="pointer-events-auto">
          <TopNav
            districtName={district.originName}
            hour={hour}
            tab={tab}
            onTabChange={setTab}
            mode={mode}
            onModeChange={setMode}
            accessibilityEnabled={accessibilityEnabled}
            onAccessibilityToggle={() => setAccessibilityEnabled((enabled) => !enabled)}
          />
        </div>

        {tab === 'map' && (
          <>
            {/* mobile: compact toggle buttons for the side panels */}
            <div className="flex sm:hidden gap-2 pointer-events-auto">
              <button onClick={() => setMobileDrawer((d) => (d === 'tools' ? null : 'tools'))} className="rounded-xl bg-slate-950/80 border border-white/10 px-3 py-1.5 text-xs text-slate-200">
                Tools
              </button>
              <button onClick={() => setMobileDrawer((d) => (d === 'stats' ? null : 'stats'))} className="rounded-xl bg-slate-950/80 border border-white/10 px-3 py-1.5 text-xs text-slate-200">
                Stats
              </button>
            </div>

            <div className="flex-1 flex items-start justify-between gap-3 min-h-0">
              <div className={`flex-col gap-3 ${mobileDrawer === 'tools' ? 'flex' : 'hidden'} sm:flex pointer-events-auto`}>
                <ScenarioComparisonPanel rows={scenarioRows} score={overallScore.score} deltaPts={overallScore.deltaPts} />
                <TrafficLegendPanel />
                <AccessibilityRoutesPanel
                  enabled={accessibilityEnabled}
                  onToggle={() => setAccessibilityEnabled((enabled) => !enabled)}
                  route={accessibilityRoute}
                  setRoute={setAccessibilityRoute}
                />
              </div>

              <div className={`flex-col gap-3 items-end ml-auto ${mobileDrawer === 'stats' ? 'flex' : 'hidden'} sm:flex pointer-events-auto`}>
                <InterventionToolsList mode={mode} armedToolId={armedTool?.id ?? null} onArm={handleArm} onReset={() => setEdits(emptyEdits())} />
                <RecommendationPanel analysis={analysis} mode={mode} />
              </div>
            </div>

            <div className="hidden lg:flex items-end gap-3 pointer-events-auto">
              <TrafficFlowChart data={flowSeries} currentHour={hour} />
              <div className="flex-1 flex flex-col gap-2 max-w-md">
                <TimeControls hour={hour} onChange={setHour} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} speed={speed} onSpeedChange={setSpeed} />
              </div>
              <SummaryMetricsStrip
                totalVehicles={Math.round(curTotalVehicles)}
                totalVehiclesDeltaPct={pctChange(baseTotalVehicles, curTotalVehicles)}
                avgSpeed={speedRow.proposed}
                avgSpeedDeltaPct={pctChange(speedRow.baseline, speedRow.proposed)}
                totalDelay={delayRow.proposed}
                totalDelayDeltaPct={pctChange(delayRow.baseline, delayRow.proposed)}
                co2={co2Row.proposed}
                co2DeltaPct={pctChange(co2Row.baseline, co2Row.proposed)}
                publicTransportPct={publicTransportPct}
                publicTransportDeltaPct={pctChange(baselinePublicTransportPct, publicTransportPct)}
              />
              <MiniMap district={district} />
            </div>
            <div className="lg:hidden pointer-events-auto">
              <TimeControls hour={hour} onChange={setHour} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} speed={speed} onSpeedChange={setSpeed} />
            </div>
          </>
        )}

        {tab !== 'map' && (
          <div className="pointer-events-auto flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-md p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 capitalize">{tab}</h2>
              <button onClick={() => setTab('map')} className="text-slate-400 hover:text-slate-200">
                <IconClose className="w-4 h-4" />
              </button>
            </div>
            {tab === 'dashboard' && (
              <>
                <ScenarioComparisonPanel rows={scenarioRows} score={overallScore.score} deltaPts={overallScore.deltaPts} />
                <KpiCards metrics={curAgg} baselineMetrics={baseAgg} derived={derived} />
              </>
            )}
            {tab === 'analysis' && (
              <>
                <TrafficFlowChart data={flowSeries} currentHour={hour} />
                <BeforeAfter before={baseAgg} after={curAgg} />
              </>
            )}
            {tab === 'reports' && (
              <>
                <RecommendationPanel analysis={analysis} mode={mode} />
                <KpiCards metrics={curAgg} baselineMetrics={baseAgg} derived={derived} />
                <p className="text-[11px] text-slate-500 pt-3 border-t border-white/10">
                  Simulation results are estimates for planning and educational purposes and are not a substitute for
                  professional traffic engineering analysis. Real road/building geometry from OpenStreetMap; cars,
                  trees, traffic lights, buildings and park furniture are real <code>.glb</code> models; AI
                  recommendation is a rule-based mock standing in for a live Gemini call.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
