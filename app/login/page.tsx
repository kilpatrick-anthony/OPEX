'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'authenticated') return null;

  async function handleCredentialsSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/dashboard',
    });

    setSubmitting(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 60%, #3a1750 100%)' }}>
      <div className="flex items-center justify-center pt-14 pb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-lg">OAKBERRY</h1>
            <span className="rounded-lg px-3 py-1 text-sm font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              OPEX
            </span>
          </div>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>Operational Expenditure Portal</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center pb-14 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>

          <form className="mt-6 space-y-4" onSubmit={handleCredentialsSignIn}>
            <label className="block space-y-2 text-sm text-slate-700">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                placeholder="name@oakberry.ie"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                placeholder="Your password"
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #4a1f60, #6d2f8e)' }}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
