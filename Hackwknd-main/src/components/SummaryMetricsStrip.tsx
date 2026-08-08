import type { ComponentType, SVGProps } from 'react';
import { IconBus, IconClock, IconLeaf, IconWiden } from './icons';

interface Item {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  deltaPct: number;
}

interface Props {
  totalVehicles: number;
  totalVehiclesDeltaPct: number;
  avgSpeed: number;
  avgSpeedDeltaPct: number;
  totalDelay: number;
  totalDelayDeltaPct: number;
  co2: number;
  co2DeltaPct: number;
  publicTransportPct: number;
  publicTransportDeltaPct: number;
}

function fmtDelta(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

export default function SummaryMetricsStrip({
  totalVehicles,
  totalVehiclesDeltaPct,
  avgSpeed,
  avgSpeedDeltaPct,
  totalDelay,
  totalDelayDeltaPct,
  co2,
  co2DeltaPct,
  publicTransportPct,
  publicTransportDeltaPct,
}: Props) {
  const items: Item[] = [
    { icon: IconWiden, label: 'Total Vehicles', value: totalVehicles.toLocaleString(), deltaPct: totalVehiclesDeltaPct },
    { icon: IconClock, label: 'Avg Speed', value: `${avgSpeed.toFixed(1)} km/h`, deltaPct: avgSpeedDeltaPct },
    { icon: IconClock, label: 'Total Delay', value: `${totalDelay.toFixed(0)} veh-hr/h`, deltaPct: totalDelayDeltaPct },
    { icon: IconLeaf, label: 'CO2 Emissions', value: `${co2.toFixed(2)} t`, deltaPct: co2DeltaPct },
    { icon: IconBus, label: 'Public Transport', value: `${publicTransportPct.toFixed(0)}%`, deltaPct: publicTransportDeltaPct },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-3.5 shadow-2xl flex items-center gap-5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <it.icon className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500">{it.label}</div>
            <div className="text-sm font-semibold text-slate-100 tabular-nums">{it.value}</div>
            <div className={`text-[10px] tabular-nums ${it.deltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtDelta(it.deltaPct)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
