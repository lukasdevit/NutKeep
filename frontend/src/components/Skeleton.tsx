import type { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

/** Generic shimmer skeleton block */
export function Skeleton({ className = '', children }: SkeletonProps) {
  return (
    <div className={`skeleton rounded-md ${className}`}>
      {children}
    </div>
  );
}

/** Skeleton for a list item row */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30">
      <Skeleton className="w-8 h-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/** Skeleton for a card */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
