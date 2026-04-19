import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getFieldTeamUsers, updateUserBudget } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DASHBOARD_ROLES = ['super_admin', 'director', 'manager', 'employee'];

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!DASHBOARD_ROLES.includes(session?.user?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await getFieldTeamUsers();
  return NextResponse.json(users);
}

export async function PATCH(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId, budget } = await request.json();
  if (typeof userId !== 'number' || typeof budget !== 'number' || budget < 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  await updateUserBudget(userId, budget);
  return NextResponse.json({ ok: true });
}
