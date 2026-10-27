'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import {
  authenticateDemoUser,
  DEMO_SESSION_KEY,
  type DemoSession,
} from '@/lib/demoAuth';
import { loginAdmin, loginMember } from '@/lib/teamApi';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    setBusy(true);
    try {
      const u = username.trim();
      let session: DemoSession | null = null;
      if (u.includes('@')) {
        // Administrator: email + password, checked against the database.
        const result = await loginAdmin(u, password);
        if ('session' in result) {
          session = result.session;
          if (result.token) localStorage.setItem('adminToken', result.token);
        } else {
          setError(result.error);
          return;
        }
      } else {
        // Team members sign in against the backend.
        const result = await loginMember(u, password);
        if ('session' in result) {
          session = result.session;
        } else {
          // Old local accounts that have not been uploaded to the backend yet.
          session = result.denied ? authenticateDemoUser(u, password) : null;
          if (!session) {
            setError(result.error);
            return;
          }
        }
      }

      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      document.cookie = 'demoAuth=1; path=/; samesite=lax';
      router.replace('/dashboard');
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[linear-gradient(135deg,#0B2F8F_0%,#071C40_60%,#05142F_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <LockKeyhole size={25} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2563EB]">
            Magnify Workspace
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#071C40]">
            Sign in to your dashboard
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Use the credentials provided by your administrator.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-semibold text-[#334155]">
            Email or username
            <span className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-[#CBD5E1] px-3 focus-within:border-[#2563EB]">
              <UserRound size={18} className="text-[#94A3B8]" />
              <input
                required
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Admin email or your username"
                className="w-full bg-transparent text-sm font-normal outline-none"
              />
            </span>
          </label>

          <label className="block text-sm font-semibold text-[#334155]">
            Password
            <span className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-[#CBD5E1] px-3 focus-within:border-[#2563EB]">
              <LockKeyhole size={18} className="text-[#94A3B8]" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full bg-transparent text-sm font-normal outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-[#64748B]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-[#2563EB] text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

      </section>
    </main>
  );
}
