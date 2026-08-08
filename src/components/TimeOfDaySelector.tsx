import type { EdgeMetrics, TimePeriod } from '../types';
import { TIME_LABELS } from '../types';
import { aggregateMetrics } from '../lib/costEngine';
import { congestionBand } from '../lib/ruleEngine';

interface Props {
  period: TimePeriod;
  onChange: (period: TimePeriod) => void;
  metricsByPeriod: Record<TimePeriod, Map<string, EdgeMetrics>>;
}

const ORDER: TimePeriod[] = ['am', 'mid', 'pm', 'night'];

const BAND_DOT_CLASS: Record<ReturnType<typeof congestionBand>, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

export default function TimeOfDaySelector({ period, onChange, metricsByPeriod }: Props) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md p-1.5 shadow-2xl">
      {ORDER.map((p) => {
        const congestion = aggregateMetrics(metricsByPeriod[p]).congestion;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm transition ${
              period === p ? 'bg-sky-500 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.6)]' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${BAND_DOT_CLASS[congestionBand(congestion)]}`} />
            {TIME_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
