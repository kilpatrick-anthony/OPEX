import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getStores, updateStoreBudget } from '@/lib/db';

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
