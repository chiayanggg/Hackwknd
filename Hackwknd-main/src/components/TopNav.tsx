import type { Mode } from '../types';
import { formatHour } from '../types';
import ModeToggle from './ModeToggle';
import { IconBuilding, IconClock } from './icons';

export type NavTab = 'dashboard' | 'map' | 'analysis' | 'reports';

interface Props {
  districtName: string;
  hour: number;
  tab: NavTab;
  onTabChange: (tab: NavTab) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  accessibilityEnabled: boolean;
  onAccessibilityToggle: () => void;
}

const TABS: { id: NavTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'map', label: 'Map' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'reports', label: 'Reports' },
];

export default function TopNav({ districtName, hour, tab, onTabChange, mode, onModeChange, accessibilityEnabled, onAccessibilityToggle }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 shadow-2xl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
          <IconBuilding className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-100">Smart City Simulator</div>
          <div className="text-[10px] text-slate-500">{districtName}</div>
        </div>
      </div>

      <nav className="flex items-center gap-1 ml-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === t.id ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button
          id="accessibility-toggle"
          type="button"
          aria-pressed={accessibilityEnabled}
          aria-label={`${accessibilityEnabled ? 'Hide' : 'Show'} accessibility overlay`}
          onClick={onAccessibilityToggle}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${accessibilityEnabled ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-200' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'}`}
        >
          Accessibility
        </button>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 tabular-nums">
          <IconClock className="w-3.5 h-3.5" />
          {formatHour(hour)}
        </span>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
    </div>
  );
}
