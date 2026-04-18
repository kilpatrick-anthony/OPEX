import NextAuth from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
