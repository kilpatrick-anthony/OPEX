import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getOakerEmailRecipients, getOakerInspectionById } from '@/lib/db';
import { sendOakerCheckCompletedEmail } from '@/lib/oakerEmail';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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

  const recipients = await getOakerEmailRecipients();
  const emailStatus = await sendOakerCheckCompletedEmail(inspection, recipients);
  return NextResponse.json({ emailStatus });
}
