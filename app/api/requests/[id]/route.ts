import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createNotification, getUserById, performRequestAction } from '@/lib/db';
import { sendRequestDecisionEmail } from '@/lib/notificationEmail';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  if (!['director', 'super_admin'].includes(session.user.role)) {
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

  if (requestRecord?.userId) {
    const actionLabel = action === 'approved' ? 'Approved' : action === 'rejected' ? 'Rejected' : 'Queried';
    const title = `Request #${requestRecord.id} ${actionLabel}`;
    const message = [
      `${requestRecord.storeName} · ${requestRecord.category} · EUR ${Number(requestRecord.amount).toFixed(2)}`,
      action === 'queried'
        ? 'Your request needs changes before it can be approved.'
        : `Your request was ${actionLabel.toLowerCase()}.`,
      comment ? `Director note: ${comment}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    await createNotification({
      userId: Number(requestRecord.userId),
      requestId: requestRecord.id,
      type: action,
      title,
      message,
    });

    const recipient = await getUserById(Number(requestRecord.userId));
    if (recipient?.email) {
      await sendRequestDecisionEmail({
        toEmail: recipient.email,
        toName: recipient.name,
        action,
        requestId: requestRecord.id,
        storeName: requestRecord.storeName,
        category: requestRecord.category,
        amount: Number(requestRecord.amount),
        comment,
      });
    }
  }

  return NextResponse.json({ request: requestRecord });
}
