import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getNotificationsByUser, getUnreadNotificationCount, markAllNotificationsRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get('limit') || 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 50)) : 10;

  const [notifications, unreadCount] = await Promise.all([
    getNotificationsByUser(Number(session.user.id), limit),
    getUnreadNotificationCount(Number(session.user.id)),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'mark-all-read') {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  await markAllNotificationsRead(Number(session.user.id));
  return NextResponse.json({ ok: true });
}
