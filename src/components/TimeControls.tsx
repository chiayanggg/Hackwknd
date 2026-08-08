import { useEffect, useRef } from 'react';
import { formatHour } from '../types';

interface Props {
  hour: number;
  onChange: (hour: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [1, 2, 4];
const HOURS_PER_SEC_AT_1X = 0.15; // one sim-hour every ~6.7 real seconds at 1x — full day in ~2.7 min

export default function TimeControls({ hour, onChange, playing, onTogglePlay, speed, onSpeedChange }: Props) {
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    const step = (t: number) => {
      if (last.current !== null) {
        const dt = (t - last.current) / 1000;
        onChange((hour + dt * HOURS_PER_SEC_AT_1X * speed) % 24);
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-arm each render so onChange sees latest `hour`
  }, [playing, speed, hour]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 backdrop-blur-md p-3 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time of Day</span>
        <span className="text-sm font-semibold tabular-nums text-slate-100">{formatHour(hour)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={24}
        step={0.05}
        value={hour}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-500 mb-2"
      />
      <div className="flex items-center gap-2">
        <button onClick={() => onChange((hour - 1 + 24) % 24)} className="rounded-lg bg-white/5 hover:bg-white/15 px-2 py-1.5 text-slate-200" title="Back 1h">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12l-9-6z" /></svg>
        </button>
        <button onClick={onTogglePlay} className="rounded-lg bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-white" title={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <button onClick={() => onChange((hour + 1) % 24)} className="rounded-lg bg-white/5 hover:bg-white/15 px-2 py-1.5 text-slate-200" title="Forward 1h">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l9-6z" /></svg>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded-md px-1.5 py-1 text-[11px] font-medium ${speed === s ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/15'}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
