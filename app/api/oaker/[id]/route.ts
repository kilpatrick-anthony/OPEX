import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getOakerInspectionById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const inspectionId = Number(params.id);
  if (!inspectionId) {
    return NextResponse.json({ error: 'Invalid inspection ID.' }, { status: 400 });
  }

  const inspection = await getOakerInspectionById(inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  return NextResponse.json({ inspection });
}
