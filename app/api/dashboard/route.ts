import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getDashboardData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    if (!['director', 'super_admin', 'employee', 'field_team'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month';

    let from: string;
    let to: string;

    if (period === 'custom') {
      from = url.searchParams.get('from') || '';
      to = url.searchParams.get('to') || '';
      if (!from || !to) {
        return NextResponse.json({ error: 'from and to are required for custom period' }, { status: 400 });
      }
    } else if (period === 'week') {
      const now = new Date();
      const day = now.getDay(); // 0 = Sun
      const diff = day === 0 ? -6 : 1 - day; // rewind to Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      from = monday.toISOString().split('T')[0];
      to = nextMonday.toISOString().split('T')[0];
    } else {
      // 'month' (default)
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
    }

    const data = await getDashboardData(from, to);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data.' }, { status: 500 });
  }
}
