import type { Mode } from '../types';

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md p-1 shadow-2xl">
      {(['professional', 'sandbox'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl transition ${
            mode === m ? 'bg-sky-500 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.6)]' : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          {m === 'professional' ? 'Professional Planner' : 'Sandbox'}
        </button>
      ))}
    </div>
  );
}
