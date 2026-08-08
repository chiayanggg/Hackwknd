import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { FlowSample } from '../lib/scenario';
import { formatHour } from '../types';

interface Props {
  data: FlowSample[];
  currentHour: number;
}

export default function TrafficFlowChart({ data, currentHour }: Props) {
  const chartData = data.map((d) => ({ ...d, label: formatHour(d.hour) }));

  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-3.5 shadow-2xl">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Traffic Flow</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> Baseline
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Proposed
          </span>
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} interval={5} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="baselineVehicles" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="proposedVehicles" stroke="#34d399" strokeWidth={1.5} dot={false} />
            <ReferenceLine x={formatHour(currentHour)} stroke="#f8fafc" strokeDasharray="3 3" strokeOpacity={0.4} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
