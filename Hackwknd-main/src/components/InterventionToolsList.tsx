import type { Mode } from '../types';
import type { ToolDef } from '../data/tools';
import { TOOLS } from '../data/tools';

interface Props {
  mode: Mode;
  armedToolId: string | null;
  onArm: (tool: ToolDef) => void;
  onReset: () => void;
}

export default function InterventionToolsList({ mode, armedToolId, onArm, onReset }: Props) {
  const tools = mode === 'sandbox' ? TOOLS : TOOLS.filter((t) => t.category !== 'Sandbox');
  const armed = TOOLS.find((t) => t.id === armedToolId) ?? null;

  return (
    <div className="w-64 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-3.5 shadow-2xl">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Intervention Tools</h3>
      <div className="space-y-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onArm(tool)}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition ${
              armedToolId === tool.id ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <tool.icon className="w-4 h-4 shrink-0" />
            {tool.label}
          </button>
        ))}
        <button onClick={onReset} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left text-slate-400 hover:bg-white/10 mt-1 border-t border-white/10 pt-2.5">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M4 4v6h6M20 20v-6h-6" />
            <path d="M5.5 15a8 8 0 1 0 1-9.5L4 10M18.5 9a8 8 0 0 1-1 9.5L20 14" />
          </svg>
          Reset
        </button>
      </div>
      {armed && (
        <p className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/80 px-2.5 py-1.5 text-[11px] text-sky-200">
          <armed.icon className="w-4 h-4 shrink-0" />
          {armed.hint} to place <strong>{armed.label}</strong>.
        </p>
      )}
    </div>
  );
}
