import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createNotification, deleteRequest, getRequestById, getUserById, performRequestAction, updateRequestAmount, updateRequestReceipt, updateRequestReimbursable } from '@/lib/db';
import { sendRequestDecisionEmail, sendReceiptToAccountant } from '@/lib/notificationEmail';
import { parseReceiptList, serializeReceiptList } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const requestId = Number(params.id);
  if (!requestId) {
    return NextResponse.json({ error: 'Invalid request ID.' }, { status: 400 });
  }

  const record = await getRequestById(requestId);
  if (!record) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  // Employees may only view their own requests
  const role = session.user.role as string;
  if (role === 'employee' && record.userId !== Number(session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Managers may only view requests from their store
  if (role === 'manager' && record.storeId !== Number(session.user.storeId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ request: record });
}

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

    // Forward the receipt to the accountant when a request is approved
    const receipts = parseReceiptList(requestRecord.receipt);
    if (action === 'approved' && receipts.length > 0) {
      await sendReceiptToAccountant({
        requestId: requestRecord.id,
        storeName: requestRecord.storeName,
        category: requestRecord.category,
        amount: Number(requestRecord.amount),
        requesterName: requestRecord.requesterName ?? requestRecord.submitterName ?? 'Unknown',
        approvedAt: new Date().toISOString(),
        receiptDataUrls: receipts,
      });
    }
  }

  return NextResponse.json({ request: requestRecord });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const requestId = Number(params.id);
  if (!requestId) {
    return NextResponse.json({ error: 'Invalid request ID.' }, { status: 400 });
  }
  await deleteRequest(requestId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const requestId = Number(params.id);
  if (!requestId) {
    return NextResponse.json({ error: 'Invalid request ID.' }, { status: 400 });
  }

  const existing = await getRequestById(requestId);
  if (!existing) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const role = session.user.role as string;
  if (role === 'employee' && existing.userId !== Number(session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (role === 'manager' && existing.storeId !== Number(session.user.storeId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { receipt, receipts, reimbursable, amount } = body as {
    receipt?: string | null;
    receipts?: string[] | null;
    reimbursable?: boolean;
    amount?: number;
  };

  if (receipt !== undefined && typeof receipt !== 'string' && receipt !== null) {
    return NextResponse.json({ error: 'Invalid receipt data.' }, { status: 400 });
  }
  if (receipts !== undefined && receipts !== null && (!Array.isArray(receipts) || receipts.some((item) => typeof item !== 'string'))) {
    return NextResponse.json({ error: 'Invalid receipt data.' }, { status: 400 });
  }
  if (reimbursable !== undefined && typeof reimbursable !== 'boolean') {
    return NextResponse.json({ error: 'Invalid reimbursable value.' }, { status: 400 });
  }
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
    return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
  }
  // Only directors and super_admins may change the reimbursable flag
  if (reimbursable !== undefined && !['director', 'super_admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (amount !== undefined) {
    if (!['pending', 'queried'].includes(existing.status)) {
      return NextResponse.json({ error: 'Only pending or queried request amounts can be edited.' }, { status: 400 });
    }
    await updateRequestAmount(requestId, Number(amount));
  }
  if (receipts !== undefined) {
    await updateRequestReceipt(requestId, serializeReceiptList(receipts ?? []));
  } else if (receipt !== undefined) {
    await updateRequestReceipt(requestId, receipt ?? null);
  }
  if (reimbursable !== undefined) {
    await updateRequestReimbursable(requestId, reimbursable);
  }

  const updated = await getRequestById(requestId);
  return NextResponse.json({ request: updated });
}
