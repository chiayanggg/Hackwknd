import type { DistrictData } from '../types';

interface Props {
  district: DistrictData;
}

const SIZE = 160;
const PAD = 10;

export default function MiniMap({ district }: Props) {
  const { minX, maxX, minZ, maxZ } = district.bounds;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxZ - minZ);
  const scale = Math.min((SIZE - PAD * 2) / w, (SIZE - PAD * 2) / h);
  const toScreen = (x: number, z: number) => [PAD + (x - minX) * scale, PAD + (z - minZ) * scale];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-2 shadow-2xl">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="rounded-lg">
        <rect x={0} y={0} width={SIZE} height={SIZE} fill="#1e293b" />
        {district.roads.map((r) => {
          const pts = r.points.map((p) => toScreen(p.x, p.z).join(',')).join(' ');
          return <polyline key={r.id} points={pts} fill="none" stroke="#64748b" strokeWidth={r.baseLanes >= 2 ? 2 : 1.2} />;
        })}
        <rect x={2} y={2} width={SIZE - 4} height={SIZE - 4} fill="none" stroke="#38bdf8" strokeWidth={1.5} rx={6} />
      </svg>
    </div>
  );
}
