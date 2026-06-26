import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { DEFAULT_PORTAL_ACCESS, normalizePortalAccess, type PortalKey } from '@/lib/portalAccess';

const OPEX_PREFIXES = ['/dashboard', '/requests', '/approval', '/reports', '/audit', '/forecast'];

function requiredPortalForPath(pathname: string): PortalKey | null {
  if (pathname === '/api/oaker' || pathname.startsWith('/api/oaker/')) return 'oaker';
  if (
    pathname === '/api/dashboard' ||
    pathname === '/api/audit' ||
    pathname === '/api/requests' ||
    pathname.startsWith('/api/requests/')
  ) return 'opex';
  if (pathname === '/oaker' || pathname.startsWith('/oaker/')) return 'oaker';
  if (OPEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return 'opex';
  return null;
}

export async function middleware(request: NextRequest) {
  const requiredPortal = requiredPortalForPath(request.nextUrl.pathname);
  if (!requiredPortal) return NextResponse.next();

  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'temporary-auth-secret-change-me-in-vercel';
  const token = await getToken({ req: request, secret });

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token.role === 'super_admin') return NextResponse.next();

  const portalAccess = normalizePortalAccess(token.portalAccess ?? DEFAULT_PORTAL_ACCESS);
  if (portalAccess.includes(requiredPortal)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const portalUrl = new URL('/portal', request.url);
  return NextResponse.redirect(portalUrl);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/requests/:path*',
    '/approval/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/forecast/:path*',
    '/oaker/:path*',
    '/api/dashboard',
    '/api/audit',
    '/api/requests/:path*',
    '/api/oaker/:path*',
  ],
};
