import { NextResponse } from 'next/server';
import { getStores } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stores = await getStores();
  return NextResponse.json(stores);
}
