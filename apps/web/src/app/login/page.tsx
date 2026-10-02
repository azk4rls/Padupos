'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [emailOrToken, setEmailOrToken] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = emailOrToken.trim();
    if (!identifier) {
      setErrorMsg('Email atau User Token wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      // Pass token/identifier to backend auth
      const success = await login(identifier);
      if (success) {
        router.push('/app/dashboard');
      } else {
        setErrorMsg('Autentikasi gagal. Pastikan token atau kredensial Anda valid.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa koneksi backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoToken: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const success = await login(demoToken);
      if (success) {
        router.push('/app/dashboard');
      } else {
        setErrorMsg('Gagal menggunakan akun demo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100/60 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-xl mb-3 shadow-sm">
            P
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            PADUPOS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Business Operating System for Small &amp; Growing Businesses
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Masuk ke Akun</CardTitle>
            <CardDescription>
              Gunakan email bisnis atau token otentikasi Anda
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <ErrorState
                  title="Gagal Masuk"
                  message={errorMsg}
                  className="p-3 text-xs"
                />
              )}

              <Input
                label="Email / User Token"
                type="text"
                placeholder="nama@bisnis.com atau test_owner_1"
                value={emailOrToken}
                onChange={(e) => setEmailOrToken(e.target.value)}
                autoComplete="username"
                required
              />

              <Input
                label="Kata Sandi"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                helperText="Untuk mode pengembangan/sandbox, kata sandi opsional saat menggunakan token."
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                variant="primary"
                isLoading={isLoading}
              >
                Masuk
              </Button>

              <div className="w-full text-center text-xs text-slate-500 pt-2 border-t border-border">
                Belum memiliki akun?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Daftar Baru
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Quick Demo Access Bar */}
        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Akses Cepat Pengujian / Demo
          </p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickLogin('test_owner_1')}
            >
              Owner Demo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickLogin('test_cashier_1')}
            >
              Kasir Demo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
