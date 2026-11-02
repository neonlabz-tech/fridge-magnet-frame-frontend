'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { adminForgotPassword } from '@/lib/teamApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await adminForgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[linear-gradient(135deg,#0B2F8F_0%,#071C40_60%,#05142F_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-10">
        <h1 className="text-center text-2xl font-bold text-[#071C40]">Reset admin password</h1>
        <p className="mb-6 mt-2 text-center text-sm text-[#64748B]">
          Enter the administrator email. We will send a link that works once and expires in 15 minutes.
        </p>
        {sent ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            If that email belongs to an administrator, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-semibold text-[#334155]">
              Admin email
              <span className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-[#CBD5E1] px-3 focus-within:border-[#2563EB]">
                <Mail size={18} className="text-[#94A3B8]" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm font-normal outline-none" />
              </span>
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#2563EB] text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-60">
              {busy ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}
