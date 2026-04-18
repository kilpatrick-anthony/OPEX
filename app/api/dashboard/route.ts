import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getDashboardData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = (url.searchParams.get('period') as 'month' | 'last-month' | 'quarter') || 'month';
  const data = await getDashboardData(period);
  return NextResponse.json(data);
}
