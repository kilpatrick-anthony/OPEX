import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByEmail, createUser } from '@/lib/db';

const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN || 'oakberry.ie';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
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
        if (!user || user.password !== credentials.password) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
        } as any;
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase() || profile?.email?.toLowerCase() || '';
        if (!email.endsWith(`@${allowedDomain}`)) {
          return false;
        }

        let existing = await getUserByEmail(email);
        if (!existing) {
          existing = await createUser({
            name: user.name || (profile?.name ?? email.split('@')[0]),
            email,
            password: '',
            role: 'employee',
            storeId: null,
          });
        }

        user.id = existing!.id as any;
        user.role = existing!.role as any;
        user.storeId = existing!.storeId as any;
      }
      return true;
    },
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.storeId = (user as any).storeId ?? null;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as number;
        session.user.role = token.role as string;
        session.user.storeId = token.storeId as number | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
