import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getStores, updateStoreBudget, createStore, deleteStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stores = await getStores();
  const visibleStores = stores
    .filter((store) => store.name.trim().toLowerCase() !== 'nutgrove')
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(visibleStores);
}

export async function PATCH(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const storeId = Number(body.storeId);
  const budget = Number(body.budget);

  if (!storeId || isNaN(budget) || budget < 0) {
    return NextResponse.json({ error: 'Valid storeId and budget are required.' }, { status: 400 });
  }

  await updateStoreBudget(storeId, budget);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const budget = Number(body.budget ?? 0);

  if (!name) {
    return NextResponse.json({ error: 'Store name is required.' }, { status: 400 });
  }
  if (isNaN(budget) || budget < 0) {
    return NextResponse.json({ error: 'Budget must be a non-negative number.' }, { status: 400 });
  }

  try {
    const store = await createStore(name, budget);
    return NextResponse.json(store, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('unique') || err?.code === '23505') {
      return NextResponse.json({ error: 'A store with that name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create store.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const storeId = Number(body.storeId);

  if (!storeId || isNaN(storeId)) {
    return NextResponse.json({ error: 'Valid storeId is required.' }, { status: 400 });
  }

  await deleteStore(storeId);
  return NextResponse.json({ ok: true });
}
