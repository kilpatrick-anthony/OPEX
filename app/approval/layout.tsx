'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/userContext';
import { canAccess } from '@/lib/mockUsers';

export default function ApprovalLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.replace('/login');
      else if (!canAccess(user.role, 'approval')) router.replace('/requests');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || !canAccess(user.role, 'approval')) return null;
  return <>{children}</>;
}
