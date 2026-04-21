import { NextResponse } from 'next/server';
import { getPasswordResetToken, deletePasswordResetToken, getUserById, updateUserPassword } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? '').trim();
    const newPassword = String(body?.newPassword ?? '');
    const confirmPassword = String(body?.confirmPassword ?? '');

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const record = await getPasswordResetToken(token);
    if (!record) {
      return NextResponse.json({ error: 'This reset link is invalid or has already been used.' }, { status: 400 });
    }

    if (new Date(record.expiresAt) < new Date()) {
      await deletePasswordResetToken(token);
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const user = await getUserById(record.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, passwordHash);
    await deletePasswordResetToken(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Reset password token error:', message);
    // Surface DB quota/connectivity errors more clearly
    if (message.includes('quota') || message.includes('402') || message.includes('exceeded')) {
      return NextResponse.json({ error: 'The service is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
