import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getFieldTeamUsers, updateUserBudget, updateUserPortalAccess, updateUserProfile, updateUserPassword, createUser, deleteUser } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { sendWelcomeEmail } from '@/lib/email';
import { DEFAULT_PORTAL_ACCESS, normalizePortalAccess, serializePortalAccess } from '@/lib/portalAccess';

export const dynamic = 'force-dynamic';

const DASHBOARD_ROLES = ['super_admin', 'director', 'manager', 'employee', 'field_team'];

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
  const body = await request.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if ('budget' in body) {
    const budget = Number(body.budget);
    if (isNaN(budget) || budget < 0) {
      return NextResponse.json({ error: 'Budget must be a non-negative number.' }, { status: 400 });
    }
    await updateUserBudget(userId, budget);
  }

  if ('portalAccess' in body) {
    const portalAccess = normalizePortalAccess(body.portalAccess);
    if (portalAccess.length === 0) {
      return NextResponse.json({ error: 'Select at least one portal area.' }, { status: 400 });
    }
    await updateUserPortalAccess(userId, portalAccess);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if ('password' in body || body.sendWelcomeEmail) {
    if (!password) {
      return NextResponse.json({ error: 'Enter a temporary password to reset or re-send login details.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
  }

  let updatedUser: Awaited<ReturnType<typeof updateUserProfile>> | undefined;
  if ('name' in body || 'email' in body || 'title' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    try {
      updatedUser = await updateUserProfile(userId, { name, email, title });
    } catch (err: any) {
      if (err?.message?.includes('unique') || err?.code === '23505') {
        return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update user details.' }, { status: 500 });
    }
  }

  if ('password' in body || body.sendWelcomeEmail) {
    const hashed = await hashPassword(password);
    await updateUserPassword(userId, hashed);

    if (body.sendWelcomeEmail) {
      const emailName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : updatedUser?.name;
      const emailAddress = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : updatedUser?.email;
      if (!emailName || !emailAddress) {
        return NextResponse.json({ error: 'Name and email are required to send login details.' }, { status: 400 });
      }
      sendWelcomeEmail({ name: emailName, email: emailAddress }, password).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, user: updatedUser });
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
  const portalAccess = normalizePortalAccess(body.portalAccess ?? DEFAULT_PORTAL_ACCESS);

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  if (portalAccess.length === 0) {
    return NextResponse.json({ error: 'Select at least one portal area.' }, { status: 400 });
  }

  try {
    const hashed = await hashPassword(password);
    const user = await createUser({ name, email, password: hashed, role: 'field_team', title, storeId: null, portalAccess });
    const { password: _pw, ...safeUser } = user as any;

    // Send welcome email — fire-and-forget so a delivery failure doesn't block account creation
    sendWelcomeEmail({ name, email }, password).catch(() => {});

    return NextResponse.json({ ...safeUser, portalAccess: serializePortalAccess(safeUser.portalAccess).split(',') }, { status: 201 });
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
