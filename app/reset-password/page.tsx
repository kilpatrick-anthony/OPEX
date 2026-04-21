'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-sm text-rose-700">
        <p className="font-semibold">Invalid link</p>
        <p className="mt-1">This password reset link is missing or invalid. Please{' '}
          <Link href="/forgot-password" className="underline">request a new one</Link>.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-700">
        <p className="font-semibold">Password updated!</p>
        <p className="mt-1">Your password has been reset. Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm text-slate-700">
        New password
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-base"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showNew ? 'Hide password' : 'Show password'}
          >
            {showNew ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        </div>
      </label>

      <label className="block space-y-2 text-sm text-slate-700">
        Confirm new password
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-base"
            placeholder="Repeat new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        </div>
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #4a1f60, #6d2f8e)' }}
      >
        {submitting ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          <h2 className="text-xl font-semibold text-slate-900">Set a new password</h2>
          <p className="mt-1 text-sm text-slate-500">Choose a strong password of at least 8 characters.</p>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-sky-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
