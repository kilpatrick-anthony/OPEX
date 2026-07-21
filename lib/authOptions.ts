import CredentialsProvider from 'next-auth/providers/credentials';
import { getStoreByName, getUserByEmail, updateUserStoreAssignment } from '@/lib/db';
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
        if (!user || !user.isActive || !valid) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title ?? null,
          storeId: user.storeId,
          portalAccess: user.portalAccess,
          canManageOakerQuestions: user.canManageOakerQuestions,
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
        token.portalAccess = (user as any).portalAccess ?? ['opex', 'oaker'];
        token.canManageOakerQuestions = Boolean((user as any).canManageOakerQuestions);
      }

      // Keep session token aligned with database user state (role/title/store assignment).
      if (token.email) {
        const existing = await getUserByEmail(String(token.email).toLowerCase());
        if (existing) {
          if (!existing.isActive) {
            token.id = undefined;
            token.role = undefined;
            token.storeId = null;
            return token;
          }
          let resolvedStoreId = existing.storeId ?? null;

          if (existing.role === 'manager' && !resolvedStoreId) {
            const matchedStore = await getStoreByName(existing.name);
            if (matchedStore) {
              resolvedStoreId = matchedStore.id;
              await updateUserStoreAssignment(existing.id, matchedStore.id);
            }
          }

          token.id = existing.id;
          token.role = existing.role;
          token.title = existing.title ?? null;
          token.storeId = resolvedStoreId;
          token.portalAccess = existing.portalAccess;
          token.canManageOakerQuestions = Boolean(existing.canManageOakerQuestions);
        }
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (!token.id) {
        session.user = undefined;
        return session;
      }
      if (session.user) {
        session.user.id = token.id as number;
        session.user.role = token.role as string;
        session.user.title = (token.title as string | null) ?? null;
        session.user.storeId = token.storeId as number | null;
        session.user.portalAccess = (token.portalAccess as string[]) ?? ['opex', 'oaker'];
        session.user.canManageOakerQuestions = Boolean(token.canManageOakerQuestions);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
