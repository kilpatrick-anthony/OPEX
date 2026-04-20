'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { canAccess, ROLE_LABELS } from '@/lib/mockUsers';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnread() {
      if (!user) return;
      try {
        const response = await fetch('/api/notifications?limit=1', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { unreadCount?: number };
        if (!cancelled) setUnreadCount(Number(payload.unreadCount ?? 0));
      } catch {
        // Keep navbar usable even if notification fetch fails.
      }
    }

    if (user) {
      loadUnread();
    } else {
      setUnreadCount(0);
    }

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const canViewAnalytics = Boolean(user && user.role !== 'store_staff');
  const canViewForecast = user?.role === 'super_admin';

  const allNavItems = [
    { href: '/dashboard',          label: 'Dashboard', show: user ? canAccess(user.role, 'dashboard') : true },
    { href: '/approval',           label: 'Approvals', show: user ? canAccess(user.role, 'approval')  : false },
    { href: '/requests',           label: 'Requests',  show: true },
    { href: '/reports',            label: 'Reports',   show: user ? user.role !== 'store_staff' : true },
    { href: '/forecast',           label: 'Forecast',  show: canViewForecast },
    { href: '/dashboard/compare',  label: 'Compare',   show: canViewAnalytics },
    { href: '/account',            label: 'Account',   show: Boolean(user) },
    ...(user && canAccess(user.role, 'admin') ? [{ href: '/admin', label: 'Admin', show: true }] : []),
  ];
  const navItems = allNavItems.filter((i) => i.show);

  const homeHref = user && !canAccess(user.role, 'dashboard') ? '/requests' : '/dashboard';

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 50%, #3a1750 100%)' }}>
      <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="container flex items-center justify-between py-3">
        {/* Logo */}
        <Link href={homeHref} className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white drop-shadow">OAKBERRY</span>
          <span className="rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)' }}>
            OPEX
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap items-center gap-1 text-sm">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`rounded-full px-4 py-1.5 font-medium transition-all ${active ? 'text-[#4a1f60] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                style={active ? { background: 'rgba(255,255,255,0.95)' } : {}}>
                <span className="relative inline-flex items-center gap-1.5">
                  {item.label}
                  {item.href === '/account' && unreadCount > 0 ? (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                      {Math.min(unreadCount, 99)}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop user pill + sign out */}
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

        {/* Mobile: hamburger button */}
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

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 pb-4">
          {/* User info */}
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
          {/* Nav links */}
          <nav className="flex flex-col px-3 pt-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  {item.label}
                  {item.href === '/account' && unreadCount > 0 ? (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                      {Math.min(unreadCount, 99)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          {/* Sign out */}
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

      {/* ── Desktop user strip ────────────────────────────────────────── */}
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

