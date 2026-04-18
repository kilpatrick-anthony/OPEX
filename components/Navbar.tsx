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
  ];
  const navItems = allNavItems.filter((i) => i.show);

  const homeHref = user && !canAccess(user.role, 'dashboard') ? '/requests' : '/dashboard';

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 50%, #3a1750 100%)' }}>
      <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
      <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white drop-shadow">OAKBERRY</span>
            <span className="rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)' }}>
              OPEX
            </span>
          </Link>
          <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Operational Expenditure Portal</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-1 text-sm">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={`rounded-full px-4 py-1.5 font-medium transition-all ${active ? 'text-[#4a1f60] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                  style={active ? { background: 'rgba(255,255,255,0.95)' } : {}}>
                  {item.label}
                  {item.href === '/account' && unreadCount > 0 ? ` (${Math.min(unreadCount, 99)})` : ''}
                </Link>
              );
            })}
            {user && canAccess(user.role, 'admin') && (
              <Link href="/admin"
                className={`rounded-full px-4 py-1.5 font-medium transition-all ${pathname === '/admin' ? 'text-[#4a1f60] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                style={pathname === '/admin' ? { background: 'rgba(255,255,255,0.95)' } : {}}>
                Admin
              </Link>
            )}
          </nav>

          {user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(255,255,255,0.25)' }}>
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
                <span className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{user.role === 'store_staff' ? 'Store' : (user.title || ROLE_LABELS[user.role])}</span>
              </div>
              <button onClick={handleLogout}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.65)' }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
    </header>
  );
}
