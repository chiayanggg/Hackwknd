import type { ScenarioRow } from '../lib/scenario';
import { rowChangePct } from '../lib/scenario';

interface Props {
  rows: ScenarioRow[];
  score: number;
  deltaPts: number;
}

function fmt(n: number, decimals: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function ScenarioComparisonPanel({ rows, score, deltaPts }: Props) {
  return (
    <div className="w-72 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-3.5 shadow-2xl">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Scenario Comparison</h3>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-1 mb-1">
        <span className="text-sky-400">Baseline</span>
        <span className="text-emerald-400 text-right">Proposed</span>
      </div>

      <div className="divide-y divide-white/5">
        {rows.map((r) => {
          const pct = rowChangePct(r);
          const improved = r.higherIsBetter ? pct >= 0 : pct <= 0;
          return (
            <div key={r.label} className="py-1.5">
              <div className="text-[11px] text-slate-400">{r.label}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 tabular-nums">
                  {fmt(r.baseline, r.decimals)} <span className="text-[10px] text-slate-500">{r.unit}</span>
                </span>
                <span className={`text-sm font-semibold tabular-nums ${improved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(r.proposed, r.decimals)} <span className="text-[10px] opacity-70">{r.unit}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Overall Score</span>
        <span className="text-base font-bold tabular-nums text-slate-100">
          {score}
          <span className="text-[11px] text-slate-500">/100</span>{' '}
          <span className={deltaPts >= 0 ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
            {deltaPts >= 0 ? '+' : ''}
            {deltaPts}
          </span>
        </span>
      </div>
    </div>
  );
}
