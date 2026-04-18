'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { canAccess } from '@/lib/mockUsers';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.replace('/login');
      else if (!canAccess(user.role, 'admin')) router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || !canAccess(user.role, 'admin')) return null;
  return <>{children}</>;
}
