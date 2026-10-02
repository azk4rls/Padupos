import React from 'react';
import { cn } from './utils';
import { Button } from './button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Data gagal dimuat',
  message = 'Terjadi kendala saat menghubungkan ke server. Silakan periksa koneksi internet Anda atau coba kembali.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 sm:p-10 text-center border border-red-200 rounded-lg bg-red-50/40 text-red-900',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-red-900 mb-1">
        {title}
      </h3>
      <p className="max-w-md text-xs sm:text-sm text-red-700/80 mb-5">
        {message}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          size="sm"
          variant="outline"
          className="border-red-300 text-red-800 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
