import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { performRequestAction } from '@/lib/db';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action;
  const comment = body.comment || '';

  if (!['approved', 'rejected', 'queried'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  const requestId = Number(params.id);
  const requestRecord = await performRequestAction(requestId, session.user.id, action, comment);
  return NextResponse.json({ request: requestRecord });
}
