import React from 'react';
import { cn } from './utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-slate-200/80', className)}
      {...props}
    />
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full border border-border rounded-md bg-white p-4 space-y-3">
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
