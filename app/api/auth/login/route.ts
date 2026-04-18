import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  const valid = user ? await verifyPassword(password, user.password) : false;
  if (!user || !valid) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const token = signToken({ userId: user.id, role: user.role, storeId: user.storeId });
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId } });
  response.cookies.set({ name: 'opex_token', value: token, httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600, sameSite: 'lax' });
  return response;
}
