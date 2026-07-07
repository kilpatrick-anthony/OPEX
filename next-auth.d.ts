import 'next-auth';
import 'next-auth/jwt';
import type { PortalKey } from '@/lib/portalAccess';

type AuthRole = 'employee' | 'field_team' | 'manager' | 'director' | 'super_admin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      name?: string | null;
      email?: string | null;
      role: AuthRole;
      title?: string | null;
      storeId: number | null;
      portalAccess?: PortalKey[];
      canManageOakerQuestions?: boolean;
    };
  }

  interface User {
    id: number;
    name?: string | null;
    email?: string | null;
    role: AuthRole;
    title?: string | null;
    storeId: number | null;
    portalAccess?: PortalKey[];
    canManageOakerQuestions?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number;
    role: AuthRole;
    title?: string | null;
    storeId: number | null;
    portalAccess?: PortalKey[];
    canManageOakerQuestions?: boolean;
  }
}
