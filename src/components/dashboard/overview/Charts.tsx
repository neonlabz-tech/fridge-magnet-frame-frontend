'use client';

import { useState } from 'react';

const money = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));

export function Empty({ text = 'No data for this week' }: { text?: string }) {
  return <div className="flex h-40 items-center justify-center text-xs text-[#94A3B8]">{text}</div>;
}

/* ---------- area / line ---------- */
export function AreaChart({ labels, values, color = '#2563EB', format = (n: number) => `LKR ${n.toLocaleString('en-US')}` }: {
  labels: string[];
  values: number[];
  color?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!values.some((v) => v > 0)) return <Empty />;
  const W = 560, H = 190, L = 38, B = 22, T = 10, R = 8;
  const max = Math.max(...values) * 1.15;
  const x = (i: number) => L + (values.length === 1 ? (W - L - R) / 2 : (i / (values.length - 1)) * (W - L - R));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const gid = `g${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((g) => {
        const v = (max * (4 - g)) / 4;
        return (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">{money(v)}</text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {values.map((v, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <rect x={x(i) - 20} y={T} width="40" height={H - T - B} fill="transparent" />
          <circle cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill="#fff" stroke={color} strokeWidth="2" />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8">{labels[i]}</text>
        </g>
      ))}
      {hover !== null && (
        <g>
          <rect x={Math.min(Math.max(x(hover) - 50, L), W - 110)} y={Math.max(y(values[hover]) - 34, 0)} width="100" height="24" rx="5" fill="#0F172A" />
          <text x={Math.min(Math.max(x(hover) - 50, L), W - 110) + 50} y={Math.max(y(values[hover]) - 34, 0) + 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            {format(values[hover])}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ---------- grouped bars ---------- */
export function BarChart({ labels, series }: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  if (!all.some((v) => v > 0)) return <Empty />;
  const W = 560, H = 190, L = 38, B = 22, T = 10, R = 8;
  const max = Math.max(...all) * 1.15;
  const slot = (W - L - R) / labels.length;
  const bw = Math.min(22, (slot * 0.7) / series.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {[0, 1, 2, 3, 4].map((g) => {
          const v = (max * (4 - g)) / 4;
          return (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" />
              <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">{money(v)}</text>
            </g>
          );
        })}
        {labels.map((l, i) => {
          const cx = L + slot * i + slot / 2;
          const start = cx - (bw * series.length) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill={hover === i ? '#F1F5F9' : 'transparent'} />
              {series.map((s, k) => (
                <rect key={s.name} x={start + k * bw} y={y(s.values[i])} width={bw - 2} height={Math.max(0, H - B - y(s.values[i]))} rx="3" fill={s.color} />
              ))}
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8">{l}</text>
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <rect x={Math.min(Math.max(L + slot * hover + slot / 2 - 62, L), W - 134)} y={T} width="124" height={8 + series.length * 14} rx="5" fill="#0F172A" />
            {series.map((s, k) => (
              <text key={s.name} x={Math.min(Math.max(L + slot * hover + slot / 2 - 62, L), W - 134) + 8} y={T + 17 + k * 14} fontSize="10" fontWeight="600" fill="#fff">
                {s.name}: {s.values[hover].toLocaleString('en-US')}
              </text>
            ))}
          </g>
        )}
      </svg>
      <div className="mt-1 flex justify-center gap-4">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-[#64748B]">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- donut (pie) ---------- */
export function Donut({ data, centerLabel }: { data: { label: string; value: number; color: string }[]; centerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const R = 52, r = 34, cx = 70, cy = 70;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const full = d.value === total;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const path = full
      ? `M${cx},${cy - R} A${R},${R} 0 1 1 ${cx - 0.01},${cy - R} L${cx - 0.01},${cy - r} A${r},${r} 0 1 0 ${cx},${cy - r} Z`
      : `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
    return { ...d, path, i };
  });
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0">
        {arcs.map((a) => (
          <path
            key={a.label}
            d={a.path}
            fill={a.color}
            opacity={hover === null || hover === a.i ? 1 : 0.45}
            onMouseEnter={() => setHover(a.i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x="70" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0F172A">{active ? active.value : total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="8" fill="#94A3B8">{active ? active.label : centerLabel ?? 'Total'}</text>
      </svg>
      <ul className="w-full max-w-[190px] space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#475569]">
              <span className="size-2.5 rounded-full" style={{ background: d.color }} /> {d.label}
            </span>
            <span className="font-bold text-[#0F172A]">{d.value} <span className="font-medium text-[#94A3B8]">({Math.round((d.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- horizontal bars ---------- */
export function HBars({ items }: { items: { label: string; value: number; display: string; color?: string }[] }) {
  if (!items.length || !items.some((i) => i.value > 0)) return <Empty text="No sales this week" />;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="truncate pr-2 font-semibold text-[#334155]">{i.label}</span>
            <span className="shrink-0 font-bold text-[#0F172A]">{i.display}</span>
          </div>
          <div className="h-2 rounded-full bg-[#F1F5F9]">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (i.value / max) * 100)}%`, background: i.color ?? '#2563EB' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
