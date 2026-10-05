'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { BookOpen } from 'lucide-react';

export default function JournalsPage() {
  const { activeBusiness } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ journalEntries: any[] }>('/accounting/journals');
    if (res.error) setError(res.error.message || 'Failed to load journals');
    else setEntries(res.data?.journalEntries || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && entries.length === 0) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Journals</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Posted journal entries • {activeBusiness?.name}</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No Journals" description="No journal entries found" />
      ) : (
        <div className="space-y-4">
          {entries.map((j) => (
            <div key={j.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{j.entryNumber} • {j.entryDate}</span>
                <span className="text-slate-600">{j.sourceType}{j.isPosted ? ' (Posted)' : ''}</span>
              </div>
              <p className="text-sm text-slate-900">{j.description}</p>
              {j.lines?.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  {j.lines.map((l: any) => (
                    <div key={l.id} className="flex justify-between">
                      <span>{l.accountId}</span>
                      <span>DR {parseFloat(l.debit).toLocaleString('id-ID')} / CR {parseFloat(l.credit).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
