import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByEmail } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

const resolvedAuthSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.JWT_SECRET ||
  'temporary-auth-secret-change-me-in-vercel';

export const authOptions = {
  secret: resolvedAuthSecret,
  providers: [
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase();
        const user = await getUserByEmail(email);
        const valid = user ? await verifyPassword(credentials.password, user.password) : false;
        if (!user || !valid) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title ?? null,
          storeId: user.storeId,
        } as any;
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  // Helps behind proxy deployments (e.g. Vercel) when deriving callback URLs.
  trustHost: true,
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.title = (user as any).title ?? null;
        token.storeId = (user as any).storeId ?? null;
      }

      // Backfill stale tokens (e.g. sessions created before role/store fields existed).
      if ((!token.role || token.storeId === undefined || !token.id || token.title === undefined) && token.email) {
        const existing = await getUserByEmail(String(token.email).toLowerCase());
        if (existing) {
          token.id = existing.id;
          token.role = existing.role;
          token.title = existing.title ?? null;
          token.storeId = existing.storeId ?? null;
        }
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as number;
        session.user.role = token.role as string;
        session.user.title = (token.title as string | null) ?? null;
        session.user.storeId = token.storeId as number | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
