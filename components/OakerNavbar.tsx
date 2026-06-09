'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { ROLE_LABELS } from '@/lib/mockUsers';
import { PlatformSwitcher } from '@/components/PlatformSwitcher';

export function OakerNavbar() {
  const pathname = usePathname();
  const { user, logout } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function handleLogout() {
    logout();
  }

  const navItems = [
    { href: '/oaker', label: 'Dashboard', activePath: '/oaker', exact: true },
    { href: '/oaker/stores', label: 'Stores', activePath: '/oaker/stores' },
    { href: '/oaker/reports', label: 'Reports', activePath: '/oaker/reports' },
    { href: '/oaker/checks', label: 'New Check', activePath: '/oaker/checks' },
  ];

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 52%, #3a1750 100%)' }}>
      <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
      <div className="container flex items-center justify-between py-3">
        <PlatformSwitcher current="oaker" />

        <nav className="hidden md:flex flex-wrap items-center gap-1 text-sm">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.activePath : pathname === item.activePath || pathname.startsWith(item.activePath + '/');
            return (
              <Link key={item.label} href={item.href}
                className={`rounded-full px-4 py-1.5 font-medium transition-all ${active ? 'text-[#4a1f60] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                style={active ? { background: 'rgba(255,255,255,0.95)' } : {}}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="hidden md:flex items-center gap-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </span>
            <button onClick={handleLogout}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.65)' }}>
              Sign out
            </button>
          </div>
        )}

        <button
          type="button"
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/10 pb-4">
          {user && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.25)' }}>
                {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {user.role === 'store_staff' ? 'Store' : (user.title || ROLE_LABELS[user.role])}
                </p>
              </div>
            </div>
          )}
          <nav className="flex flex-col px-3 pt-2">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.activePath : pathname === item.activePath || pathname.startsWith(item.activePath + '/');
              return (
                <Link key={item.label} href={item.href}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {user && (
            <div className="px-3 pt-2 border-t border-white/10 mt-2">
              <button onClick={handleLogout}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white transition-all">
                Sign out
              </button>
            </div>
          )}
        </div>
      )}

      <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />

      {user && (
        <div className="hidden md:flex container items-center justify-end gap-1.5 py-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>{user.name}</span>
          <span>·</span>
          <span>{user.role === 'store_staff' ? 'Store' : (user.title || ROLE_LABELS[user.role])}</span>
        </div>
      )}
    </header>
  );
}
