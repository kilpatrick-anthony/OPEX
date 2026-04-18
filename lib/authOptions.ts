import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByEmail } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
