import React from 'react';
import { cn } from './utils';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center border border-dashed border-border rounded-lg bg-white/50',
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
        {title}
      </h3>
      <p className="max-w-md text-xs sm:text-sm text-muted-foreground mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
