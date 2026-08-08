import type { ComponentType, SVGProps } from 'react';
import type { DerivedMetrics } from '../types';
import { congestionBand } from '../lib/ruleEngine';
import { IconCoin, IconClock, IconLeaf, IconPulse, IconUsers, IconReport } from './icons';

interface Props {
  derived: DerivedMetrics;
  reportOpen: boolean;
  onToggleReport: () => void;
}

function fmtRM(n: number): string {
  if (n >= 1_000_000) return `RM${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RM${(n / 1_000).toFixed(0)}K`;
  return `RM${n}`;
}

function arrow(n: number): string {
  if (n > 0.5) return '▲';
  if (n < -0.5) return '▼';
  return '—';
}

function tone(n: number, goodWhenNegative = true): string {
  if (Math.abs(n) < 0.5) return 'text-slate-300';
  const good = goodWhenNegative ? n < 0 : n > 0;
  return good ? 'text-emerald-400' : 'text-red-400';
}

const BAND_DOT_CLASS: Record<ReturnType<typeof congestionBand>, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

function Row({
  icon: Icon,
  dot,
  label,
  value,
  className = 'text-slate-200',
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  dot?: string;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
        {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />}
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${className}`}>{value}</span>
    </div>
  );
}

export default function HudBar({ derived, reportOpen, onToggleReport }: Props) {
  return (
    <div className="w-64 rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md p-3.5 shadow-2xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">District Stats</h3>
        <button onClick={onToggleReport} className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300">
          <IconReport className="w-3.5 h-3.5" />
          {reportOpen ? 'Hide' : 'Report'}
        </button>
      </div>
      <div className="divide-y divide-white/5">
        <Row dot={BAND_DOT_CLASS[congestionBand(derived.avgCongestion)]} label="Avg congestion" value={`${Math.round(derived.avgCongestion * 100)}%`} />
        <Row dot={BAND_DOT_CLASS[congestionBand(derived.worstCongestion)]} label={derived.worstEdgeName} value={`${Math.round(derived.worstCongestion * 100)}%`} />
        <Row icon={IconCoin} label="Cost" value={fmtRM(derived.costRM)} />
        <Row icon={IconClock} label="Build time" value={`${derived.constructionMonths}mo`} />
        <Row icon={IconLeaf} label="CO2" value={`${arrow(derived.co2ChangePct)} ${Math.abs(derived.co2ChangePct).toFixed(0)}%`} className={tone(derived.co2ChangePct)} />
        <Row icon={IconPulse} label="Accident risk" value={`${arrow(derived.accidentProbChangePct)} ${Math.abs(derived.accidentProbChangePct).toFixed(0)}%`} className={tone(derived.accidentProbChangePct)} />
        {derived.populationCapacityDelta !== 0 && (
          <Row icon={IconUsers} label="Population" value={`${derived.populationCapacityDelta > 0 ? '+' : ''}${derived.populationCapacityDelta}`} className={tone(derived.populationCapacityDelta, false)} />
        )}
      </div>
    </div>
  );
}
