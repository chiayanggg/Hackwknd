import type { AnalysisResult, Mode } from '../types';
import { IconSpark } from './icons';

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
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
          <IconSpark className="w-3.5 h-3.5" />
          AI recommendation
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.label}</span>
      </div>

      {mode === 'professional' ? (
        <>
          <p className="text-sm text-slate-200 leading-relaxed">{analysis.explanation}</p>
          <p className="text-xs text-slate-400 mt-2.5 border-t border-white/10 pt-2.5">{analysis.safetyNote}</p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Confidence</span>
              <span>{analysis.confidencePct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${analysis.confidencePct}%` }} />
            </div>
          </div>
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
