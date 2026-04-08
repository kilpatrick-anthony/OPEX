'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'director';
  storeId: number | null;
};

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    });
  }, []);

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' });
    router.push('/login');
  }

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <Link href="/requests" className="text-lg font-semibold text-slate-900">
            OAKBERRY OPEX
          </Link>
          <p className="text-sm text-slate-500">Ireland request & approval dashboard</p>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-2 text-sm text-slate-600">
              <Link href="/requests" className="rounded-full px-3 py-2 hover:bg-slate-100">
                Requests
              </Link>
              {(user.role === 'director' || user.role === 'manager') && (
                <Link href="/approval" className="rounded-full px-3 py-2 hover:bg-slate-100">
                  Approvals
                </Link>
              )}
              {user.role === 'director' && (
                <Link href="/dashboard" className="rounded-full px-3 py-2 hover:bg-slate-100">
                  Dashboard
                </Link>
              )}
            </nav>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              {user.name} · {user.role}
            </div>
            <Button variant="ghost" type="button" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-slate-700 hover:text-slate-900">
              Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
