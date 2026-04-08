import { NextResponse } from 'next/server';
import { getStores } from '@/lib/db';

export async function GET() {
  const stores = await getStores();
  return NextResponse.json(stores);
}
