import { IconTrafficLight, IconWarning, IconBus, IconWiden } from './icons';

const BANDS = [
  { label: 'Smooth', range: '0 - 40%', color: '#22c55e' },
  { label: 'Moderate', range: '40 - 70%', color: '#eab308' },
  { label: 'Heavy', range: '70 - 90%', color: '#f97316' },
  { label: 'Severe', range: '90%+', color: '#ef4444' },
];

const MARKERS = [
  { icon: IconTrafficLight, label: 'Traffic Light' },
  { icon: IconWarning, label: 'Uncontrolled Junction' },
  { icon: IconBus, label: 'Bus Lane' },
  { icon: IconWiden, label: 'Crosswalk' },
];

export default function TrafficLegendPanel() {
  return (
    <div className="w-72 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-3.5 shadow-2xl">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Traffic Legend</h3>
      <div className="space-y-1.5 mb-3">
        {BANDS.map((b) => (
          <div key={b.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: b.color }} />
              {b.label}
            </span>
            <span className="text-slate-500">{b.range}</span>
          </div>
        ))}
      </div>
      <div className="pt-2.5 border-t border-white/10 space-y-1.5">
        {MARKERS.map((m) => (
          <div key={m.label} className="flex items-center gap-2 text-xs text-slate-300">
            <m.icon className="w-4 h-4 text-slate-400" />
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}
