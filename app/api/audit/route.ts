import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getAuditTrail } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (!['director', 'super_admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const actorId  = searchParams.get('actorId')  ? Number(searchParams.get('actorId'))  : undefined;
  const action   = searchParams.get('action')   ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo   = searchParams.get('dateTo')   ?? undefined;

  const entries = await getAuditTrail({ actorId, action, dateFrom, dateTo });
  return NextResponse.json({ entries });
}
