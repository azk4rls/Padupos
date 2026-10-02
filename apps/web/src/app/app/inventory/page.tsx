'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Boxes, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Inventory, InventoryMovement, Product } from '@padupos/types';

type InventoryWithProduct = Inventory & { product?: { name: string; sku?: string; unit: string } };

export default function InventoryPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, movRes, prodRes] = await Promise.all([
        api.get<{ inventory: InventoryWithProduct[] }>(`/inventory${activeBranch?.id ? `?branchId=${activeBranch.id}` : ''}`),
        api.get<{ movements: InventoryMovement[] }>(`/inventory/movements${activeBranch?.id ? `?branchId=${activeBranch.id}` : ''}`),
        api.get<{ items: Product[] }>(`/products?page=1&limit=1000`),
      ]);
      if (invRes.error || movRes.error || prodRes.error) {
        setError(invRes.error?.message || movRes.error?.message || prodRes.error?.message || 'Failed to load inventory');
      } else {
        setInventory(invRes.data?.inventory || []);
        setMovements(movRes.data?.movements || []);
        setProducts(prodRes.data?.items || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatNum = (n: string) => {
    const v = parseFloat(n);
    if (isNaN(v)) return '0';
    return v.toLocaleString('id-ID', { maximumFractionDigits: 4 });
  };

  const getProductName = (item: InventoryWithProduct) => {
    return item.product?.name || products.find((p) => p.id === item.productId)?.name || item.productId;
  };

  const filteredInventory = inventory.filter((item) => {
    if (!search) return true;
    const name = getProductName(item).toLowerCase();
    const sku = (item.product?.sku || products.find((p) => p.id === item.productId)?.sku || '').toLowerCase();
    return name.includes(search.toLowerCase()) || sku.includes(search.toLowerCase());
  });

  if (loading && inventory.length === 0) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
        </div>
        <ErrorState title="Failed to Load Inventory" message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time stock levels and movements • {activeBusiness?.name}
            {activeBranch ? ` • ${activeBranch.name}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>
      <div className="flex gap-1 border-b border-border">
        <button className={cn('px-3 py-1.5 text-sm font-medium border-b-2 transition-colors', activeTab === 'stock' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700')} onClick={() => setActiveTab('stock')}>Stock</button>
        <button className={cn('px-3 py-1.5 text-sm font-medium border-b-2 transition-colors', activeTab === 'movements' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700')} onClick={() => setActiveTab('movements')}>Movements</button>
      </div>
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
          </div>
          {filteredInventory.length === 0 ? (
            <EmptyState icon={<Boxes className="h-6 w-6" />} title="No Inventory" description="No stock records found" />
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3 font-medium text-slate-900">Product</th>
                    <th className="text-left p-3 font-medium text-slate-900">SKU</th>
                    <th className="text-right p-3 font-medium text-slate-900">Quantity</th>
                    <th className="text-right p-3 font-medium text-slate-900">Available</th>
                    <th className="text-right p-3 font-medium text-slate-900">Avg Cost</th>
                    <th className="text-left p-3 font-medium text-slate-900">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const low = parseFloat(item.availableQuantity) <= parseFloat(item.minimumStock || '0');
                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-900">{item.product?.name || prod?.name || item.productId}</td>
                        <td className="p-3 text-slate-600">{item.product?.sku || prod?.sku || '-'}</td>
                        <td className="p-3 text-right tabular-nums">{formatNum(item.quantity)}</td>
                        <td className="p-3 text-right tabular-nums flex items-center justify-end gap-1">{low && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}{formatNum(item.availableQuantity)}</td>
                        <td className="p-3 text-right tabular-nums">{formatNum(item.averageCost)}</td>
                        <td className="p-3 text-slate-600">{item.product?.unit || prod?.unit || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {movements.length === 0 ? (
            <EmptyState icon={<Boxes className="h-6 w-6" />} title="No Movements" description="No stock movements recorded yet" />
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3 font-medium text-slate-900">Date</th>
                    <th className="text-left p-3 font-medium text-slate-900">Type</th>
                    <th className="text-left p-3 font-medium text-slate-900">Product</th>
                    <th className="text-right p-3 font-medium text-slate-900">Quantity</th>
                    <th className="text-left p-3 font-medium text-slate-900">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const prod = products.find((p) => p.id === m.productId);
                    return (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-3 text-slate-600">{new Date(m.createdAt).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-medium text-slate-900">{m.type}</td>
                        <td className="p-3 text-slate-900">{prod?.name || m.productId}</td>
                        <td className="p-3 text-right tabular-nums">{formatNum(m.quantity)}</td>
                        <td className="p-3 text-slate-600 text-xs truncate max-w-xs">{m.referenceType}:{m.referenceId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
