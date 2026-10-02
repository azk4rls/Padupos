'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SkeletonPage } from '@/components/ui/skeleton';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, activeBusiness, businesses } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (
      status === 'authenticated' &&
      businesses.length === 0 &&
      pathname !== '/onboarding'
    ) {
      router.replace('/onboarding');
    }
  }, [status, businesses.length, pathname, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <SkeletonPage />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
