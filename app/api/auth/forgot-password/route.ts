import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getUserByEmail, createPasswordResetToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function sendResetEmail(toEmail: string, toName: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 540px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4a1f60, #6d2f8e); padding: 28px 32px; border-radius: 12px 12px 0 0;">
        <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">OAKBERRY Ireland</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700;">Password Reset</h1>
      </div>
      <div style="background: #ffffff; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
        <p>Hi ${toName},</p>
        <p>We received a request to reset your OPEX portal password. Click the button below to choose a new one. This link is valid for <strong>1 hour</strong>.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4a1f60,#6d2f8e);color:#ffffff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:15px;">
            Reset Password
          </a>
        </div>
        <p style="font-size:13px;color:#64748b;">If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
        <p style="font-size:13px;color:#94a3b8;margin-top:24px;">OAKBERRY OPEX Portal</p>
      </div>
    </div>
  `;

  const text = [
    `Hi ${toName},`,
    'We received a request to reset your OPEX portal password.',
    `Reset your password here (valid for 1 hour): ${resetUrl}`,
    'If you did not request this, please ignore this email.',
    'OAKBERRY OPEX Portal',
  ].join('\n\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: 'OPEX Portal — Reset your password',
      html,
      text,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    // Always respond with the same message to prevent email enumeration
    const user = await getUserByEmail(email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await createPasswordResetToken(user.id, token, expiresAt);

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      try {
        await sendResetEmail(user.email, user.name, resetUrl);
      } catch (emailErr) {
        // Log email failure but don't expose it — the token is saved and the link still works
        console.error('Failed to send reset email:', emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
