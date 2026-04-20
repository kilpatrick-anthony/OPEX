import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getDirectorEmails } from '@/lib/db';
import { sendNewRequestEmail } from '@/lib/email';
import type { RequestRecord } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Only super_admin can trigger this
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let directors: { name: string; email: string }[] = [];
  try {
    directors = await getDirectorEmails();
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: 'fetch_directors',
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  if (directors.length === 0) {
    return NextResponse.json({
      ok: false,
      stage: 'fetch_directors',
      error: 'No director or super_admin users found in the database with an email address.',
    }, { status: 500 });
  }

  const mockRequest: RequestRecord = {
    id: 0,
    storeId: 1,
    userId: session.user.id,
    storeName: 'Test Store',
    requesterName: session.user.name ?? 'Test User',
    requesterRole: 'super_admin',
    submitterName: null,
    submitterJobRole: null,
    category: 'Supplies',
    amount: 123.45,
    description: 'This is a test email to verify SMTP is configured correctly.',
    receipt: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await sendNewRequestEmail(mockRequest, directors);
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: 'send_email',
      error: err instanceof Error ? err.message : String(err),
      recipients: directors.map((d) => d.email),
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Test email sent successfully.',
    recipients: directors.map((d) => d.email),
  });
}
