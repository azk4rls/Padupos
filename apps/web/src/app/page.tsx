'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

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

    // Check backend health
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
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Brand Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-xl shadow-sm">
              P
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                PADUPOS
              </h1>
              <p className="text-xs text-muted-foreground">
                Global-First AI Business OS for Small &amp; Growing Businesses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'authenticated' ? (
              <Link href="/app/dashboard">
                <Button variant="primary" size="md">
                  Buka Dashboard ({activeBusiness?.name || user?.email})
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    Masuk
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Daftar Baru
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Engine Connectivity Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Status Jaringan</span>
                {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-base font-bold text-slate-900">
                {isOnline ? 'Online (Terhubung)' : 'Offline (PWA Cache)'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">IndexedDB &amp; Sync Queue Siap</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Fastify Backend API</span>
                <Server className="h-4 w-4 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">{apiStatus}</span>
                <Badge variant={apiStatus === 'CONNECTED' ? 'success' : 'warning'}>
                  {apiStatus === 'CONNECTED' ? '200 OK' : 'Offline'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Monolith Engine Port 4000</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Akuntansi &amp; Ledger</span>
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-base font-bold text-blue-700">
                Double-Entry Active
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Invarian Debit == Credit Terjaga</p>
            </CardContent>
          </Card>
        </div>

        {/* Core Architectural Pillars */}
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
            Fondasi Arsitektur Sistem
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-700">
            <div className="flex items-start gap-2.5">
              <div className="h-2 w-2 rounded-full bg-slate-900 mt-1.5 shrink-0" />
              <div>
                <strong>Global-First Architecture:</strong> Dikonfigurasi dinamis untuk multi-negara (ID, SG, MY, US, GB, AU), multi-mata uang, dan aturan pajak tanpa hardcoding.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="h-2 w-2 rounded-full bg-slate-900 mt-1.5 shrink-0" />
              <div>
                <strong>Zero Fake Data:</strong> Dashboard dan laporan hanya menampilkan metrik riil backend. Tampilan data belum cukup ditampilkan secara jujur.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="h-2 w-2 rounded-full bg-slate-900 mt-1.5 shrink-0" />
              <div>
                <strong>Offline-First POS:</strong> Dukungan PWA dan IndexedDB untuk pencatatan transaksi kasir tunai tanpa koneksi internet.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="h-2 w-2 rounded-full bg-slate-900 mt-1.5 shrink-0" />
              <div>
                <strong>Machine Learning &amp; AI:</strong> Model Ridge Regression untuk peramalan penjualan dengan gerbang data 30 hari.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <footer className="max-w-4xl mx-auto w-full pt-8 text-center text-xs text-muted-foreground border-t border-border mt-8">
        PADUPOS Engine v1.0.0 — Frontend Phase 1 Foundation Active
      </footer>
    </main>
  );
}
