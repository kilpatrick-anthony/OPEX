import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getFieldTeamUsers, updateUserBudget, createUser, deleteUser } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const DASHBOARD_ROLES = ['super_admin', 'director', 'manager', 'employee'];

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!DASHBOARD_ROLES.includes(session?.user?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await getFieldTeamUsers();
  return NextResponse.json(users);
}

export async function PATCH(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId, budget } = await request.json();
  if (typeof userId !== 'number' || typeof budget !== 'number' || budget < 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  await updateUserBudget(userId, budget);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const hashed = await hashPassword(password);
    const user = await createUser({ name, email, password: hashed, role: 'field_team' as any, title, storeId: null });
    const { password: _pw, ...safeUser } = user as any;

    // Send welcome email — fire-and-forget so a delivery failure doesn't block account creation
    sendWelcomeEmail({ name, email }, password).catch(() => {});

    return NextResponse.json(safeUser, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('unique') || err?.code === '23505') {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(body.userId);

  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Valid userId is required.' }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === Number(session.user.id)) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  await deleteUser(userId);
  return NextResponse.json({ ok: true });
}
