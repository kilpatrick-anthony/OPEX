'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { userCanAccessPortal } from '@/lib/portalAccess';

type Platform = {
  key: 'opex' | 'oaker';
  label: string;
  description: string;
  href: string;
};

const PLATFORMS: Platform[] = [
  { key: 'opex', label: 'OPEX', description: 'Operational Expenditure', href: '/dashboard' },
  { key: 'oaker', label: 'OAKER Experience', description: 'Store Standards', href: '/oaker' },
];

export function PlatformSwitcher({ current }: { current: Platform['key'] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const availablePlatforms = PLATFORMS.filter((platform) => (
    !user ||
    user.role === 'super_admin' ||
    userCanAccessPortal(user.portalAccess, platform.key)
  ));
  const visiblePlatforms = availablePlatforms.length > 0 ? availablePlatforms : PLATFORMS.slice(0, 1);
  const active = visiblePlatforms.find((platform) => platform.key === current) ?? visiblePlatforms[0];
  const opexHref = user?.role === 'store_staff' ? '/requests' : '/dashboard';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="text-lg font-bold tracking-tight text-white drop-shadow">OAKBERRY</span>
        <span className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:max-w-none sm:text-xs sm:tracking-widest"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span className="truncate">{active.label}</span>
          <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-white p-2 shadow-2xl"
        >
          {visiblePlatforms.map((platform) => {
            const selected = platform.key === active.key;
            const href = platform.key === 'opex' ? opexHref : platform.href;
            return (
              <Link
                key={platform.key}
                href={href}
                role="menuitem"
                className={`flex items-center justify-between rounded-xl px-3 py-3 transition-colors ${selected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{platform.label}</span>
                  <span className="block text-xs text-slate-500">{platform.description}</span>
                </span>
                {selected ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Current
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-sky-700">Open</span>
                )}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
