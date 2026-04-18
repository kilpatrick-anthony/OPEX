import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { insertRequest, queryRequests, getStoreRemainingBudget, getStores } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = ['employee', 'manager', 'director', 'super_admin'].includes(session.user.role)
      ? session.user.role
      : 'employee';

    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const filters = {
      storeId: storeId ? Number(storeId) : undefined,
      status,
      userId: session.user.id,
      role: normalizedRole,
      userStoreId: session.user.storeId,
    };
    const requests = await queryRequests(filters);
    const stores = await getStores();
    const requestsWithBudget = await Promise.all(
      requests.map(async (request) => {
        const store = stores.find((item) => item.id === request.storeId);
        const remaining = store ? await getStoreRemainingBudget(store.id) : 0;
        return {
          ...request,
          storeBudget: store?.budget || 0,
          storeRemainingBudget: remaining,
        };
      }),
    );

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

  const body = await request.json();
  const storeId = Number(body.storeId);
  const category = body.category?.trim();
  const amount = Number(body.amount);
  const description = body.description?.trim();
  const receipt = body.receipt || null;

  if (!storeId || !category || !amount || amount <= 0 || !description) {
    return NextResponse.json({ error: 'storeId, category, amount and description are required.' }, { status: 400 });
  }

  const requestRecord = await insertRequest({
    storeId,
    userId: session.user.id,
    category,
    amount,
    description,
    receipt,
  });

  return NextResponse.json({ request: requestRecord });
}
