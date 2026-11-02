'use client';

import { useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { changeMemberPassword } from '@/lib/teamApi';
import { PASSWORD_HINT, passwordIssue } from '@/lib/password';
import { useToastStore } from '@/store/toastStore';

/** Team members change their own password here (current / new / confirm). */
export default function MemberPasswordCard({
  embedded = false,
  onDone,
}: {
  /** Inside a modal: no card border / title of its own. */
  embedded?: boolean;
  onDone?: () => void;
} = {}) {
  const { addToast } = useToastStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!current) return addToast('Enter your current password.', 'error');
    const issue = passwordIssue(next);
    if (issue) return addToast(issue, 'error');
    if (next !== confirm) return addToast('New password and confirmation do not match.', 'error');
    if (next === current) return addToast('New password must be different from the current one.', 'error');
    setBusy(true);
    try {
      await changeMemberPassword(current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      addToast('Password changed. Your other sign-ins were signed out.', 'success');
      onDone?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not change password.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold uppercase tracking-[0.7px] text-[#747784]">{label}</label>
      <div className="relative">
        <input
          type={shown[label] ? 'text' : 'password'}
          value={value}
          onChange={(e) => set(e.target.value)}
          autoComplete="new-password"
          className="h-[43px] w-full rounded-lg border border-[#C3C6D4] bg-white pl-3 pr-10 text-[#1A1C1F] outline-none focus:border-[#0040A1]"
        />
        <button
          type="button"
          onClick={() => setShown((m) => ({ ...m, [label]: !m[label] }))}
          aria-label={shown[label] ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747784] hover:text-[#1A1C1F]"
        >
          {shown[label] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <section className={embedded ? 'w-full' : 'w-full max-w-md rounded-xl border border-[#C3C6D4] bg-white p-5 shadow-sm sm:p-6'}>
      <div className={`mb-5 flex items-center gap-2 ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded && (
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#0040A1]" />
            <h2 className="text-[18px] font-semibold text-[#1A1C1F]">Change Password</h2>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {field('Current Password', current, setCurrent)}
        {field('New Password', next, setNext)}
        {field('Confirm New Password', confirm, setConfirm)}
        <p className="text-xs text-[#64748B]">{PASSWORD_HINT}</p>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="h-11 rounded-lg bg-[#0040A1] text-sm font-bold text-white hover:bg-[#003585] disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </section>
  );
}
