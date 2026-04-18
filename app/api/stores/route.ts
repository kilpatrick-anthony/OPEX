import { NextResponse } from 'next/server';
import { getStores } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stores = await getStores();
  const visibleStores = stores
    .filter((store) => store.name.trim().toLowerCase() !== 'nutgrove')
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(visibleStores);
}
