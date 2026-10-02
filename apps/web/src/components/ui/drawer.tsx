'use client';

import React, { useEffect } from 'react';
import { cn } from './utils';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'left',
  className,
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles = {
    left: 'inset-y-0 left-0 max-w-xs w-full border-r',
    right: 'inset-y-0 right-0 max-w-xs sm:max-w-md w-full border-l',
    bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full border-t rounded-t-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 flex flex-col bg-white border-border shadow-xl transition-transform duration-200 ease-in-out',
          positionStyles[position],
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          {title ? (
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
