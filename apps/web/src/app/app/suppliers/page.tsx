'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, Search, RefreshCw } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Supplier } from '@padupos/types';

export default function SuppliersPage() {
  const { activeBusiness } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ suppliers: Supplier[] }>('/suppliers');
    if (res.error) setError(res.error.message || 'Failed to load suppliers');
    else setSuppliers(res.data?.suppliers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  });

  if (loading && suppliers.length === 0) return <SkeletonPage />;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
        </div>
        <ErrorState title="Failed to Load Suppliers" message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage suppliers and contacts • {activeBusiness?.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="pl-9" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No Suppliers" description="No suppliers found" />
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 font-medium text-slate-900">Name</th>
                <th className="text-left p-3 font-medium text-slate-900">Contact</th>
                <th className="text-left p-3 font-medium text-slate-900">Email</th>
                <th className="text-left p-3 font-medium text-slate-900">Phone</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-slate-900">{s.name}</td>
                  <td className="p-3 text-slate-600">{s.contactPerson || '-'}</td>
                  <td className="p-3 text-slate-600">{s.email || '-'}</td>
                  <td className="p-3 text-slate-600">{s.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
