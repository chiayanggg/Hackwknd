import type { AnalysisResult, Mode } from '../types';

interface Props {
  analysis: AnalysisResult;
  mode: Mode;
}

const BADGE: Record<AnalysisResult['recommendation'], { label: string; className: string }> = {
  suitable: { label: 'Suitable', className: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
  'conditional-on-time': { label: 'Conditional', className: 'bg-amber-950 text-amber-300 border-amber-700' },
  'not worth it': { label: 'Not worth it', className: 'bg-red-950 text-red-300 border-red-700' },
};

export default function RecommendationPanel({ analysis, mode }: Props) {
  const badge = BADGE[analysis.recommendation];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 shadow-2xl">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">🤖 AI recommendation</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.label}</span>
      </div>

      {mode === 'professional' ? (
        <>
          <p className="text-sm text-slate-200 leading-relaxed">{analysis.explanation}</p>
          <p className="text-xs text-slate-400 mt-2.5 border-t border-white/10 pt-2.5">{analysis.safetyNote}</p>
        </>
      ) : (
        <ul className="space-y-1">
          {analysis.sandboxReactions.map((line, i) => (
            <li key={i} className="text-sm text-slate-200">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
