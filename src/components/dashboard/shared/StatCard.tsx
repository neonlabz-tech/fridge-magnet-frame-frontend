import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/* One look for every summary card: soft tinted card, icon on top, label, bold value. */
const TONES = {
  blue: { card: 'border-blue-200 bg-blue-100/70 shadow-sm', icon: 'text-[#2563EB]' },
  green: { card: 'border-emerald-200 bg-emerald-100/70 shadow-sm', icon: 'text-emerald-600' },
  rose: { card: 'border-rose-200 bg-rose-100/70 shadow-sm', icon: 'text-rose-500' },
  amber: { card: 'border-amber-200 bg-amber-100/70 shadow-sm', icon: 'text-amber-500' },
  violet: { card: 'border-violet-200 bg-violet-100/70 shadow-sm', icon: 'text-violet-600' },
  sky: { card: 'border-sky-200 bg-sky-100/70 shadow-sm', icon: 'text-sky-600' },
} as const;

export type StatTone = keyof typeof TONES;

/** Accepts a tone name or an old Tailwind class string such as "bg-emerald-50 text-emerald-600". */
export function toneOf(tone: string): StatTone {
  if (tone in TONES) return tone as StatTone;
  if (tone.includes('emerald') || tone.includes('green')) return 'green';
  if (tone.includes('rose') || tone.includes('red')) return 'rose';
  if (tone.includes('amber') || tone.includes('yellow') || tone.includes('orange')) return 'amber';
  if (tone.includes('violet') || tone.includes('purple')) return 'violet';
  if (tone.includes('sky') || tone.includes('cyan')) return 'sky';
  return 'blue';
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  note,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  note?: string;
  href?: string;
}) {
  const t = TONES[toneOf(tone)];
  const cls = `block rounded-xl border p-3 transition hover:shadow-md ${t.card}`;
  const body = (
    <>
      <span className={`flex size-8 items-center justify-center rounded-lg bg-white shadow-xs ${t.icon}`}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <p className="mt-2 truncate text-xs font-medium text-[#64748B]">{label}</p>
      <p className="truncate text-base font-bold text-[#0F172A]">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </p>
      {note && <p className="truncate text-xs text-[#94A3B8]">{note}</p>}
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
