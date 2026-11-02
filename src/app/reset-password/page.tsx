'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { adminResetPassword } from '@/lib/teamApi';
import { PASSWORD_HINT, passwordIssue } from '@/lib/password';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const issue = passwordIssue(password);
    if (issue) return setError(issue);
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await adminResetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[linear-gradient(135deg,#0B2F8F_0%,#071C40_60%,#05142F_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-10">
        <h1 className="text-center text-2xl font-bold text-[#071C40]">Set a new password</h1>
        {done ? (
          <>
            <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              Your password was changed. All other sign-ins were signed out.
            </p>
            <Link href="/login" className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] text-sm font-bold text-white hover:bg-[#1D4ED8]">Go to sign in</Link>
          </>
        ) : !token ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
            This reset link is incomplete. Request a new one from the sign-in page.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            {([['New password', password, setPassword], ['Confirm new password', confirm, setConfirm]] as const).map(([label, value, setter]) => (
              <label key={label} className="block text-sm font-semibold text-[#334155]">
                {label}
                <span className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-[#CBD5E1] px-3 focus-within:border-[#2563EB]">
                  <LockKeyhole size={18} className="text-[#94A3B8]" />
                  <input required type={shown[label] ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => setter(e.target.value)} className="w-full bg-transparent text-sm font-normal outline-none" />
                  <button type="button" onClick={() => setShown((p) => ({ ...p, [label]: !p[label] }))} aria-label={shown[label] ? 'Hide password' : 'Show password'} className="text-[#94A3B8] hover:text-[#475569]">
                    {shown[label] ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            ))}
            <p className="text-xs text-[#64748B]">{PASSWORD_HINT}</p>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#2563EB] text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-60">
              {busy ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
        {!done && (
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">Back to sign in</Link>
          </p>
        )}
      </section>
    </main>
  );
}
