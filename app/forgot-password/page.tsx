'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 60%, #3a1750 100%)' }}>
      <div className="flex items-center justify-center pt-14 pb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight drop-shadow-lg">OAKBERRY</h1>
            <span className="rounded-lg px-3 py-1 text-sm font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              OPEX
            </span>
          </div>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>Operational Expenditure Portal</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center pb-14 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900">Forgot password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your account email and we&apos;ll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-700">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1">If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent. It expires in 1 hour.</p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm text-slate-700">
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base"
                  placeholder="name@oakberry.ie"
                />
              </label>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #4a1f60, #6d2f8e)' }}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-sky-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
