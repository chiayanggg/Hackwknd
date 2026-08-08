import type { Dispatch, SetStateAction } from 'react';

export type AccessibilityRoute = 'most-accessible' | 'balanced' | 'direct';

const ROUTES: { id: AccessibilityRoute; label: string; detail: string; color: string }[] = [
  { id: 'most-accessible', label: 'Most accessible', detail: 'Lower-speed roads and fewer vehicle conflicts', color: '#22c55e' },
  { id: 'balanced', label: 'Balanced route', detail: 'Good accessibility with a moderate distance', color: '#facc15' },
  { id: 'direct', label: 'Direct route', detail: 'Shortest path with more junction crossings', color: '#38bdf8' },
];

const ACCESSIBILITY_STATUS = [
  { label: 'Accessible', detail: 'Wheelchair-friendly', color: '#22c55e' },
  { label: 'Limited', detail: 'Use with caution', color: '#facc15' },
  { label: 'Not accessible', detail: 'Avoid this section', color: '#ef4444' },
  { label: 'Unknown', detail: 'No accessibility data', color: '#94a3b8' },
];

interface Props {
  enabled: boolean;
  onToggle: () => void;
  route: AccessibilityRoute;
  setRoute: Dispatch<SetStateAction<AccessibilityRoute>>;
}

export default function AccessibilityRoutesPanel({ enabled, onToggle, route, setRoute }: Props) {
  return (
    <section className="w-72 rounded-2xl border border-white/10 bg-slate-950/85 p-3.5 shadow-2xl backdrop-blur-md" aria-labelledby="accessibility-routes-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="accessibility-routes-heading" className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Accessibility routes</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Wheelchair-friendly route alternatives</p>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          onClick={onToggle}
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${enabled ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-200' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'}`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Accessibility route choice">
        {ROUTES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={route === item.id}
            onClick={() => setRoute(item.id)}
            className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors ${route === item.id ? 'border-white/25 bg-white/10' : 'border-transparent hover:bg-white/5'}`}
          >
            <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span>
              <span className="block text-xs text-slate-200">{item.label}</span>
              <span className="block text-[10px] leading-4 text-slate-500">{item.detail}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-white/10 pt-3" aria-label="Accessibility status legend">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Accessibility status</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ACCESSIBILITY_STATUS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span>
                <span className="block">{item.label}</span>
                <span className="block text-[9px] text-slate-600">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
