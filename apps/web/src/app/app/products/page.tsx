'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Search, Package, Edit, RefreshCw } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Product, ProductCategory, ProductPrice } from '@padupos/types';

type ProductWithPrice = Product & { price?: ProductPrice };

export default function ProductsPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchCategories = useCallback(async () => {
    const res = await api.get<{ categories: ProductCategory[] }>('/categories');
    if (res.data?.categories) {
      setCategories(res.data.categories);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', '1');
    params.append('limit', '100');
    const res = await api.get<{ items: ProductWithPrice[]; meta: any }>(`/products?${params}`);
    if (res.error) {
      setError(res.error.message || 'Failed to load products');
    } else if (res.data) {
      setProducts(res.data.items);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const formatPrice = (price: string | undefined) => {
    if (!price) return '0';
    const num = parseFloat(price);
    if (isNaN(num)) return '0';
    return num.toLocaleString('id-ID');
  };

  const currencySymbol = activeBusiness?.baseCurrency === 'IDR' ? 'Rp' : activeBusiness?.baseCurrency || '$';
  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
    return true;
  });

  if (loading && products.length === 0) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Products</h1>
        </div>
        <ErrorState title="Failed to Load Products" message={error} onRetry={fetchProducts} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage product catalog, pricing, and categories - {activeBusiness?.name}
            {activeBranch ? ` • ${activeBranch.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Product
          </Button>
        </div>
      </div>
    </div>
  );
}
