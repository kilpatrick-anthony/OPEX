'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type LoginState = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const [form, setForm] = useState<LoginState>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      email: form.email,
      password: form.password,
    });

    if (result?.ok) {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setLoading(false);
      router.push(data.user.role === 'director' ? '/dashboard' : '/requests');
    } else {
      setLoading(false);
      setError(result?.error || 'Login failed.');
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    await signIn('google', { callbackUrl: '/requests' });
  }

  return (
    <main className="container py-10">
      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <Card className="p-8">
          <div className="mb-6">
            <p className="text-sm uppercase text-sky-600">Login</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">OAKBERRY OPEX Portal</h1>
            <p className="mt-2 text-slate-600">Sign in with your work account to submit requests, manage approvals, and review budgets.</p>
          </div>

          <div className="space-y-5">
            <Button type="button" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
              {loading ? 'Redirecting to Google…' : 'Sign in with Google'}
            </Button>

            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>or use existing account</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form className="space-y-5" onSubmit={handleCredentialsSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </label>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>
        </Card>

        <Card className="space-y-4 bg-slate-950 text-white p-8">
          <div>
            <p className="text-sm uppercase text-sky-400">Quick access</p>
            <h2 className="mt-3 text-2xl font-semibold">Sample accounts</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-3xl bg-slate-900 p-4">
              <p className="font-semibold">Director</p>
              <p>director@oakberry.ie</p>
              <p>Password: Director123!</p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-4">
              <p className="font-semibold">Store Manager</p>
              <p>manager.dublin@oakberry.ie</p>
              <p>Password: Manager123!</p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-4">
              <p className="font-semibold">Field Employee</p>
              <p>employee.field@oakberry.ie</p>
              <p>Password: Field123!</p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
