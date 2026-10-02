'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, Server, Layers, Wifi, WifiOff } from 'lucide-react';

export default function HomePage() {
  const { status, user, activeBusiness } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [apiStatus, setApiStatus] = useState<'CHECKING' | 'CONNECTED' | 'DISCONNECTED'>('CHECKING');

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
    fetch(`${apiUrl}/health`)
      .then((res) => (res.ok ? setApiStatus('CONNECTED') : setApiStatus('DISCONNECTED')))
      .catch(() => setApiStatus('DISCONNECTED'));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 lg:px-12 py-6">
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
            PADUPOS
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Business OS for small and growing businesses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <Link href="/app/dashboard">
              <Button variant="primary" size="sm">
                Dashboard{activeBusiness?.name ? ` • ${activeBusiness?.name}` : ''}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Get started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>
    </main>
  );
}
