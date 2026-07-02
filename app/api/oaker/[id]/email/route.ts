import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getOakerInspectionById } from '@/lib/db';
import { sendOakerCheckCompletedEmail } from '@/lib/oakerEmail';

export const dynamic = 'force-dynamic';

function parseRecipients(value: unknown) {
  const rawRecipients = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;]+/)
      : [];

  const recipients = new Map<string, { name: string; email: string }>();
  for (const item of rawRecipients) {
    if (typeof item !== 'string') continue;
    const email = item.trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: `"${item.trim()}" is not a valid email address.` };
    }
    recipients.set(email, { name: email, email });
  }

  return { recipients: Array.from(recipients.values()) };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  const body = await request.json().catch(() => ({}));
  const parsed = parseRecipients(body?.recipients);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const recipients = parsed.recipients ?? [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Enter at least one email address.' }, { status: 400 });
  }
  if (recipients.length > 20) {
    return NextResponse.json({ error: 'You can send to up to 20 recipients at a time.' }, { status: 400 });
  }

  try {
    const emailStatus = await sendOakerCheckCompletedEmail(inspection, recipients);
    console.info('Manual OAKER report email status:', {
      inspectionId,
      sent: emailStatus.sent,
      recipientCount: emailStatus.recipientCount,
      accepted: emailStatus.accepted,
      rejected: emailStatus.rejected,
      reason: emailStatus.reason,
      messageId: emailStatus.messageId,
    });
    return NextResponse.json({ emailStatus });
  } catch (err) {
    console.error('Failed to send manual OAKER report email:', err);
    const message = err instanceof Error ? err.message : '';
    return NextResponse.json({
      error: 'Failed to email report.',
      emailStatus: {
        sent: false,
        recipientCount: recipients.length,
        reason: message.includes('SMTP_HOST') ? 'email_config_missing' : 'send_failed',
      },
    }, { status: 500 });
  }
}
