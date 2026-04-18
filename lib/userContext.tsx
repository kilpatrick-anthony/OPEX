'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

type CurrentUser = {
  id: string;
  name: string;
  role: 'super_admin' | 'director' | 'field_team' | 'store_staff';
  title: string | null;
  store: string | null;
  employeeSlug: string | null;
};

type UserContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (_userId?: string) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [storeNameById, setStoreNameById] = useState<Record<number, string>>({});

  useEffect(() => {
    let canceled = false;
    async function loadStores() {
      try {
        const response = await fetch('/api/stores', { cache: 'no-store' });
        if (!response.ok) return;
        const stores = (await response.json()) as Array<{ id: number; name: string }>;
        if (canceled) return;
        const map: Record<number, string> = {};
        for (const store of stores) {
          map[store.id] = store.name;
        }
        setStoreNameById(map);
      } catch {
        // Keep role/session functional even if store names cannot be loaded.
      }
    }

    if (status === 'authenticated') {
      loadStores();
    }

    return () => {
      canceled = true;
    };
  }, [status]);

  const user = useMemo<CurrentUser | null>(() => {
    if (status !== 'authenticated' || !session?.user?.id || !session.user.name) {
      return null;
    }

    const appRole: CurrentUser['role'] =
      session.user.role === 'super_admin'
        ? 'super_admin'
        : session.user.role === 'director'
        ? 'director'
        : session.user.role === 'manager'
        ? 'store_staff'
        : session.user.storeId
          ? 'store_staff'
          : 'field_team';

    const employeeSlug =
      appRole === 'field_team'
        ? session.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : null;

    return {
      id: String(session.user.id),
      name: session.user.name,
      role: appRole,
      title: session.user.title ?? null,
      store: session.user.storeId ? (storeNameById[session.user.storeId] ?? null) : null,
      employeeSlug,
    };
  }, [session, status, storeNameById]);

  const isLoading = status === 'loading';

  function login() {
    // Authentication is handled via NextAuth signIn.
  }

  function logout() {
    signOut({ callbackUrl: '/login' });
  }

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}
