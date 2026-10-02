'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/app/dashboard');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ token: string }>('/auth/login', { email, password });
      if (res.error) {
        setError(res.error.message);
        setIsSubmitting(false);
        return;
      }
      if (res.data?.token) {
        const ok = await login(res.data.token);
        if (ok) {
          router.push('/app/dashboard');
          return;
        }
      }
      setError('Failed to sign in');
    } catch (err: any) {
      setError(err.message || 'System error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">Welcome back to PADUPOS</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
            {!isSubmitting && <ArrowRight className="h-4 w-4 ml-2" />}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-slate-900 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
