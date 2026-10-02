'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ token: string }>('/auth/register', { email, password });
      if (res.error) {
        setError(res.error.message);
        setIsSubmitting(false);
        return;
      }
      router.push('/login');
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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Create account</h1>
          <p className="text-sm text-slate-600">Get started with PADUPOS</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
          <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
            {!isSubmitting && <ArrowRight className="h-4 w-4 ml-2" />}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
