import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { insertRequest, queryRequests, getStoreRemainingBudget, getStores, getDirectorEmails, getAllStoreRemainingBudgets } from '@/lib/db';
import { REQUEST_CATEGORIES } from '@/lib/categories';
import { sendNewRequestEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const normalizedRole = ['employee', 'manager', 'director', 'super_admin'].includes(session.user.role)
      ? session.user.role
      : 'employee';

    if (normalizedRole === 'manager' && !session.user.storeId) {
      return NextResponse.json({ error: 'Store account is missing a store assignment.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const requestedStoreId = url.searchParams.get('storeId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const parsedStoreId = requestedStoreId && /^\d+$/.test(requestedStoreId)
      ? Number(requestedStoreId)
      : undefined;
    const effectiveStoreId = normalizedRole === 'manager'
      ? Number(session.user.storeId)
      : parsedStoreId;

    // Director/super_admin-only filters for drill-down pages
    const canViewAll = normalizedRole === 'director' || normalizedRole === 'super_admin';
    const targetUserIdParam = canViewAll ? url.searchParams.get('targetUserId') : null;
    const categoryParam = canViewAll ? url.searchParams.get('category') : null;
    const targetUserId = targetUserIdParam && /^\d+$/.test(targetUserIdParam) ? Number(targetUserIdParam) : undefined;
    const category = categoryParam || undefined;

    const filters = {
      storeId: effectiveStoreId,
      status,
      userId: session.user.id,
      role: normalizedRole,
      userStoreId: session.user.storeId,
      targetUserId,
      category,
    };
    const requests = await queryRequests(filters);
    const stores = await getStores();
    const remainingBudgets = await getAllStoreRemainingBudgets(stores);
    const requestsWithBudget = requests.map((request) => {
      const store = stores.find((item) => item.id === request.storeId);
      return {
        ...request,
        storeBudget: store?.budget || 0,
        storeRemainingBudget: remainingBudgets.get(request.storeId) ?? 0,
      };
    });

    return NextResponse.json({ requests: requestsWithBudget });
  } catch (error) {
    console.error('Requests API error:', error);
    return NextResponse.json({ error: 'Failed to load requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedRole = ['employee', 'manager', 'director', 'super_admin'].includes(session.user.role)
    ? session.user.role
    : 'employee';

  if (normalizedRole === 'manager' && !session.user.storeId) {
    return NextResponse.json({ error: 'Store account is missing a store assignment.' }, { status: 403 });
  }

  const body = await request.json();
  const requestedStoreId = Number(body.storeId);
  const storeId = normalizedRole === 'manager' ? Number(session.user.storeId) : requestedStoreId;
  const category = body.category?.trim();
  const amount = Number(body.amount);
  const description = body.description?.trim();
  const receipt = body.receipt || null;
  const submitterName = body.submitterName?.trim() || null;
  const submitterJobRole = body.submitterJobRole?.trim() || null;

  if (!storeId || !category || !amount || amount <= 0 || !description) {
    return NextResponse.json({ error: 'storeId, category, amount and description are required.' }, { status: 400 });
  }

  if (!REQUEST_CATEGORIES.includes(category)) {
    return NextResponse.json(
      {
        error: `Invalid category. Allowed categories: ${REQUEST_CATEGORIES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const requestRecord = await insertRequest({
    storeId,
    userId: session.user.id,
    category,
    amount,
    description,
    receipt,
    submitterName: submitterName || undefined,
    submitterJobRole: submitterJobRole || undefined,
  });

  // Fire-and-forget email to all directors/super_admins — never blocks the response
  if (requestRecord) {
    getDirectorEmails()
      .then((directors) => sendNewRequestEmail(requestRecord, directors))
      .catch((err) => console.error('Failed to send director notification email:', err));
  }

  return NextResponse.json({ request: requestRecord });
}
