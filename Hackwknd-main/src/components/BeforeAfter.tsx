import type { AggregateMetrics } from '../lib/costEngine';

interface Props {
  before: AggregateMetrics;
  after: AggregateMetrics;
}

function Bar({ label, before, after, unit, higherIsWorse }: { label: string; before: number; after: number; unit: string; higherIsWorse: boolean }) {
  const max = Math.max(before, after, 1) * 1.15;
  const beforeColor = '#64748b';
  const worse = higherIsWorse ? after > before : after < before;
  const afterColor = worse ? '#ef4444' : '#22c55e';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>
          {before.toFixed(0)}
          {unit} → {after.toFixed(0)}
          {unit}
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-2 rounded bg-slate-800">
          <div className="h-2 rounded" style={{ width: `${(before / max) * 100}%`, backgroundColor: beforeColor }} />
        </div>
        <div className="h-2 rounded bg-slate-800">
          <div className="h-2 rounded" style={{ width: `${(after / max) * 100}%`, backgroundColor: afterColor }} />
        </div>
      </div>
    </div>
  );
}

export default function BeforeAfter({ before, after }: Props) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Before vs After (selected time period)</h3>
      <Bar label="Utilisation" before={before.congestion * 100} after={after.congestion * 100} unit="%" higherIsWorse />
      <Bar label="Avg waiting time" before={before.waitingTimeSec} after={after.waitingTimeSec} unit="s" higherIsWorse />
      <Bar label="Speed" before={before.speed} after={after.speed} unit=" km/h" higherIsWorse={false} />
      <div className="flex gap-4 text-[11px] text-slate-500 mt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Baseline</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Improved</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Worse</span>
      </div>
    </div>
  );
}
