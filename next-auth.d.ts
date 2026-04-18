import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      name?: string | null;
      email?: string | null;
      role: 'employee' | 'manager' | 'director' | 'super_admin';
      title?: string | null;
      storeId: number | null;
    };
  }

  interface User {
    id: number;
    name?: string | null;
    email?: string | null;
    role: 'employee' | 'manager' | 'director' | 'super_admin';
    title?: string | null;
    storeId: number | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number;
    role: 'employee' | 'manager' | 'director' | 'super_admin';
    title?: string | null;
    storeId: number | null;
  }
}
