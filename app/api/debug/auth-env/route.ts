import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function mask(value?: string) {
  if (!value) return null;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
  const nextAuthUrl = process.env.NEXTAUTH_URL || null;
  const vercelUrl = process.env.VERCEL_URL || null;
  const dbUrl = process.env.DATABASE_URL || null;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || null;
  const jwtSecret = process.env.JWT_SECRET || null;

  return NextResponse.json({
    ok: true,
    env: {
      NODE_ENV: process.env.NODE_ENV || null,
      VERCEL_ENV: process.env.VERCEL_ENV || null,
      hasDatabaseUrl: Boolean(dbUrl),
      databaseUrlMasked: mask(dbUrl || undefined),
      hasNextAuthUrl: Boolean(nextAuthUrl),
      nextAuthUrl,
      hasVercelUrl: Boolean(vercelUrl),
      vercelUrl,
      hasNextAuthSecret: Boolean(nextAuthSecret),
      nextAuthSecretMasked: mask(nextAuthSecret || undefined),
      hasJwtSecret: Boolean(jwtSecret),
      jwtSecretMasked: mask(jwtSecret || undefined),
    },
  });
}
