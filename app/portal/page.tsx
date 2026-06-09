'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';

function getOpexHref(user: ReturnType<typeof useCurrentUser>['user']) {
  if (!user) return '/requests';
  return user.role === 'store_staff' ? '/requests' : '/dashboard';
}

export default function PortalPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  const tiles = [
    {
      title: 'OPEX',
      subtitle: 'Operational Expenditure',
      description: 'Requests, approvals, budgets, reporting, and spend control.',
      href: getOpexHref(user),
      active: true,
      color: 'from-sky-500 to-cyan-500',
    },
    {
      title: 'OAKER Experience',
      subtitle: 'Store Standards',
      description: 'Experience checks, store scorecards, reports, and location comparison.',
      href: '/oaker',
      active: true,
      color: 'from-emerald-500 to-lime-500',
    },
    {
      title: 'Recruitment Hub',
      subtitle: 'Hiring & Onboarding',
      description: 'Candidate tracking and onboarding workflows.',
      href: '#',
      active: false,
      color: 'from-fuchsia-500 to-rose-500',
    },
    {
      title: 'HR',
      subtitle: 'People & Policies',
      description: 'People records, policies, and team support.',
      href: '#',
      active: false,
      color: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 58%, #3a1750 100%)' }}>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <div className="mb-8 grid items-center gap-5 text-center md:grid-cols-[1fr_auto_1fr] md:text-left">
          <img src="/oakberry-logo.png" alt="OAKBERRY" className="mx-auto h-14 w-auto drop-shadow-lg md:order-2" />
          <p className="text-sm font-medium leading-6 text-white/70 md:order-1">
            Hi {user.name},
            <br />
            select where you want to work today.
          </p>
          <button
            type="button"
            onClick={logout}
            className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white md:order-3 md:block md:justify-self-end"
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tiles.map((tile) => {
            const content = (
              <div className={`flex min-h-56 flex-col rounded-2xl border p-6 text-left shadow-2xl transition ${tile.active ? 'border-white/20 bg-white/95 hover:-translate-y-1 hover:bg-white' : 'border-white/10 bg-white/10 opacity-65'}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tile.color} text-lg font-bold text-white shadow-lg`}>
                  {tile.title.slice(0, 1)}
                </div>
                <div className="mt-6 flex-1">
                  <p className={`text-xs font-semibold uppercase tracking-widest ${tile.active ? 'text-slate-400' : 'text-white/45'}`}>{tile.subtitle}</p>
                  <h2 className={`mt-2 text-2xl font-semibold ${tile.active ? 'text-slate-950' : 'text-white/80'}`}>{tile.title}</h2>
                  <p className={`mt-3 text-sm leading-6 ${tile.active ? 'text-slate-500' : 'text-white/50'}`}>{tile.description}</p>
                </div>
                <span className={`mt-6 inline-flex self-start rounded-xl px-4 py-2 text-sm font-semibold ${tile.active ? 'bg-slate-950 text-white' : 'bg-white/10 text-white/60'}`}>
                  {tile.active ? 'Open platform' : 'Coming soon'}
                </span>
              </div>
            );

            return tile.active ? (
              <Link key={tile.title} href={tile.href}>
                {content}
              </Link>
            ) : (
              <div key={tile.title}>{content}</div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={logout}
          className="mx-auto mt-8 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}
