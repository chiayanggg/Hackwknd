import type { Mode } from '../types';
import type { ToolDef } from '../data/tools';
import { TOOLS } from '../data/tools';

interface Props {
  mode: Mode;
  armedToolId: string | null;
  onArm: (tool: ToolDef) => void;
}

export default function Toolbox({ mode, armedToolId, onArm }: Props) {
  const tools = mode === 'sandbox' ? TOOLS : TOOLS.filter((t) => t.category !== 'Sandbox');
  const armed = TOOLS.find((t) => t.id === armedToolId) ?? null;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md p-2 shadow-2xl">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onArm(tool)}
            title={`${tool.label} — ${tool.hint}`}
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition ${
              armedToolId === tool.id
                ? 'bg-sky-500 shadow-[0_0_0_2px_rgba(56,189,248,0.6)]'
                : 'bg-white/5 hover:bg-white/15'
            }`}
          >
            <tool.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
      {armed && (
        <p className="max-w-[180px] flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/80 backdrop-blur-md px-2.5 py-1.5 text-[11px] text-sky-200 shadow-xl">
          <armed.icon className="w-4 h-4 shrink-0" />
          {armed.hint} to place <strong>{armed.label}</strong>.
        </p>
      )}
    </div>
  );
}
