import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { DEFAULT_PORTAL_ACCESS, normalizePortalAccess, type PortalKey } from '@/lib/portalAccess';
import { OPEX_SESSION_VERSION } from '@/lib/sessionVersion';

const OPEX_PREFIXES = ['/dashboard', '/requests', '/approval', '/reports', '/audit'];

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
  const pathname = request.nextUrl.pathname;
  if (pathname === '/training' || pathname.startsWith('/training/')) {
    const trainingUrl = request.nextUrl.clone();
    trainingUrl.pathname = `/Training${pathname.slice('/training'.length)}`;
    return NextResponse.redirect(trainingUrl);
  }

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

  if (token.sessionVersion !== OPEX_SESSION_VERSION) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('forceLogout', '1');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('next-auth.session-token', '', { path: '/', expires: new Date(0) });
    response.cookies.set('__Secure-next-auth.session-token', '', { path: '/', expires: new Date(0) });
    return response;
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
    '/training/:path*',
    '/dashboard/:path*',
    '/requests/:path*',
    '/approval/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/oaker/:path*',
    '/api/dashboard',
    '/api/audit',
    '/api/requests/:path*',
    '/api/oaker/:path*',
  ],
};
