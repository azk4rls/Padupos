'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Semua kolom wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      // In dev/standard auth flow, register token user
      const userToken = `usr_${email.split('@')[0]}_${Date.now().toString(36)}`;
      const success = await login(userToken);
      if (success) {
        router.push('/onboarding');
      } else {
        setErrorMsg('Pendaftaran gagal. Silakan coba kembali.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mendaftar.');
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
            Daftar Akun Bisnis Baru
          </p>
        </div>

        {/* Register Form Card */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Buat Akun Pemilik</CardTitle>
            <CardDescription>
              Mulai kelola kasir, inventori, dan akuntansi bisnis Anda
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <ErrorState
                  title="Pendaftaran Gagal"
                  message={errorMsg}
                  className="p-3 text-xs"
                />
              )}

              <Input
                label="Nama Lengkap"
                type="text"
                placeholder="Budi Santoso"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <Input
                label="Email Bisnis"
                type="email"
                placeholder="budi@toko.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label="Kata Sandi"
                type="password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                variant="primary"
                isLoading={isLoading}
              >
                Daftar &amp; Siapkan Bisnis
              </Button>

              <div className="w-full text-center text-xs text-slate-500 pt-2 border-t border-border">
                Sudah memiliki akun?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Masuk di Sini
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
