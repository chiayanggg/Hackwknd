import type { DerivedMetrics } from '../types';
import type { AggregateMetrics } from '../lib/costEngine';

interface Props {
  metrics: AggregateMetrics;
  baselineMetrics: AggregateMetrics;
  derived: DerivedMetrics;
}

function fmtRM(n: number): string {
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RM ${(n / 1_000).toFixed(0)}K`;
  return `RM ${n}`;
}

function pct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function KpiCards({ metrics, baselineMetrics, derived }: Props) {
  const flowChangePct = ((metrics.effectiveFlow - baselineMetrics.effectiveFlow) / baselineMetrics.effectiveFlow) * 100;
  const waitChangePct = ((metrics.waitingTimeSec - baselineMetrics.waitingTimeSec) / baselineMetrics.waitingTimeSec) * 100;

  const cards = [
    { label: 'Traffic flow change', value: pct(flowChangePct), tone: flowChangePct <= 0 ? 'good' : 'bad' },
    { label: 'Avg waiting time', value: pct(waitChangePct), tone: waitChangePct <= 0 ? 'good' : 'bad' },
    { label: 'Construction cost', value: fmtRM(derived.costRM), tone: 'neutral' },
    { label: 'Construction time', value: `${derived.constructionMonths} months`, tone: 'neutral' },
    { label: 'Travel time saved', value: `${derived.travelTimeSavedMin} min`, tone: derived.travelTimeSavedMin >= 0 ? 'good' : 'bad' },
    { label: 'Carbon emission', value: pct(derived.co2ChangePct), tone: derived.co2ChangePct <= 0 ? 'good' : 'bad' },
    { label: 'Accident probability', value: pct(derived.accidentProbChangePct), tone: derived.accidentProbChangePct <= 0 ? 'good' : 'bad' },
    { label: 'Population capacity', value: `${derived.populationCapacityDelta >= 0 ? '+' : ''}${derived.populationCapacityDelta}`, tone: 'neutral' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</div>
          <div
            className={`text-lg font-semibold mt-1 ${
              c.tone === 'good' ? 'text-emerald-400' : c.tone === 'bad' ? 'text-red-400' : 'text-slate-100'
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
