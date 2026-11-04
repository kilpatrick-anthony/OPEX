'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { canAccess, ROLE_LABELS } from '@/lib/mockUsers';
import { PlatformSwitcher } from '@/components/PlatformSwitcher';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const desktopMoreRef = useRef<HTMLDivElement | null>(null);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setDesktopMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!desktopMoreRef.current?.contains(event.target as Node)) {
        setDesktopMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDesktopMoreOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

    const handleNotificationsUpdated = () => { loadUnread(); };
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
    };
  }, [user, pathname]);

  function handleLogout() {
    logout();
  }

  const canViewAnalytics = Boolean(user && user.role !== 'store_staff' && user.role !== 'field_team');
  const canViewAudit = user?.role === 'super_admin' || user?.role === 'director';

  const allNavItems = [
    { href: '/dashboard',          label: 'Dashboard', show: user ? canAccess(user.role, 'dashboard') : true },
    { href: '/approval',           label: 'Approvals', show: user ? canAccess(user.role, 'approval')  : false },
    { href: '/requests',           label: 'Requests',  show: true },
    { href: '/reports',            label: 'Reports',   show: user ? user.role !== 'store_staff' : true },
    { href: '/audit',              label: 'Audit',     show: canViewAudit },
    { href: '/dashboard/compare',  label: 'Compare',   show: canViewAnalytics },
    { href: '/account',            label: 'Account',   show: Boolean(user) },
    ...(user && canAccess(user.role, 'admin') ? [{ href: '/admin', label: 'Admin', show: true }] : []),
  ];
  const navItems = allNavItems.filter((i) => i.show);
  const primaryLabels = ['Dashboard', 'Approvals', 'Requests', 'Reports'];
  const primaryNavItems = navItems.filter((item) => primaryLabels.includes(item.label));
  const moreNavItems = navItems.filter((item) => !primaryLabels.includes(item.label));

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #4a1f60 0%, #6d2f8e 50%, #3a1750 100%)' }}>
      <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="container flex items-center justify-between py-3">
        {/* Logo */}
        <PlatformSwitcher current="opex" />

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap items-center gap-1 text-sm">
          {primaryNavItems.map((item) => {
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

          {moreNavItems.length > 0 ? (
            <div ref={desktopMoreRef} className="relative">
              <button
                type="button"
                onClick={() => setDesktopMoreOpen((open) => !open)}
                className={`flex items-center gap-1 rounded-full px-4 py-1.5 font-medium transition-all ${desktopMoreOpen ? 'bg-white text-[#4a1f60]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                aria-expanded={desktopMoreOpen}
                aria-haspopup="menu"
              >
                More
                {unreadCount > 0 && moreNavItems.some((item) => item.href === '/account') ? (
                  <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#5c256f]" aria-label={`${unreadCount} unread notifications`} />
                ) : null}
                <svg className={`h-3.5 w-3.5 transition-transform ${desktopMoreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {desktopMoreOpen ? (
                <div role="menu" className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {moreNavItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {item.label}
                        {item.href === '/account' && unreadCount > 0 ? (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                            {Math.min(unreadCount, 99)}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
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
