'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

function PageLoader() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
}

/** Wraps authenticated pages: handles loading state, auth redirect, and errors. */
export function ProtectedPage({ children, adminOnly }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
    if (!loading && adminOnly && user && !user.isAdmin) router.replace('/');
  }, [user, loading, router, adminOnly]);

  if (loading) return <PageLoader />;
  if (!user) return <PageLoader />;
  if (adminOnly && !user.isAdmin) return <PageLoader />;

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
