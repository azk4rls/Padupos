'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, ShoppingCart, Plus, Minus, Trash2, Loader2, Package } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Product, ProductCategory, ProductPrice, CashSession } from '@padupos/types';

type ProductWithPrice = Product & { price?: ProductPrice };

interface CartItem {
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  sellingPrice: string;
}

export default function PosPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [session, setSession] = useState<CashSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchCategories = useCallback(async () => {
    const res = await api.get<{ categories: ProductCategory[] }>('/categories');
    if (res.data?.categories) setCategories(res.data.categories);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', '1');
    params.append('limit', '100');
    const res = await api.get<{ items: ProductWithPrice[]; meta: any }>(`/products?${params}`);
    if (res.error) setError(res.error.message || 'Failed to load products');
    else if (res.data) setProducts(res.data.items);
    setLoading(false);
  }, [search]);

  const fetchSession = useCallback(async () => {
    setSessionLoading(true);
    const res = await api.get<{ session: CashSession }>('/pos/sessions/current');
    if (res.data?.session) setSession(res.data.session);
    setSessionLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchSession();
  }, [fetchCategories, fetchProducts, fetchSession]);

  const addToCart = (product: ProductWithPrice) => {
    const price = product.price?.sellingPrice || '0';
    const existing = cart.find((i) => i.productId === product.id);
    if (existing) {
      setCart(cart.map((i) => (i.productId === product.id ? { ...i, quantity: (parseFloat(i.quantity) + 1).toString() } : i)));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, quantity: '1', unitPrice: price, sellingPrice: price }]);
    }
    setCheckoutError(null);
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeItem(id);
    setCart(cart.map((i) => (i.productId === id ? { ...i, quantity: qty.toString() } : i)));
  };

  const removeItem = (id: string) => setCart(cart.filter((i) => i.productId !== id));

  const clearCart = () => { setCart([]); setCheckoutError(null); };

  const total = cart.reduce((sum, i) => sum + parseFloat(i.sellingPrice) * parseFloat(i.quantity), 0);
  const currencySymbol = activeBusiness?.baseCurrency === 'IDR' ? 'Rp' : activeBusiness?.baseCurrency || '$';
  const formatPrice = (n: number) => n.toLocaleString('id-ID');

  const filteredProducts = products.filter((p) => (!categoryFilter || p.categoryId === categoryFilter) && p.isActive);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: '0' }));
      const payload = {
        branchId: activeBranch?.id || '',
        cashSessionId: session?.id,
        items,
        orderDiscountAmount: '0',
        taxRatePercentage: '0',
        isTaxInclusive: false,
        feeAmount: '0',
        paymentMethod: 'CASH' as const,
        idempotencyKey: Date.now().toString(),
      };
      const res = await api.post('/pos/sales', payload);
      if (res.error) {
        setCheckoutError(res.error.message || 'Checkout failed');
      } else {
        setSuccess(true);
        setCart([]);
        setTimeout(() => setSuccess(false), 1500);
      }
    } catch (e: any) {
      setCheckoutError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading && products.length === 0) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">POS</h1>
        </div>
        <ErrorState title="Failed to Load Products" message={error} onRetry={fetchProducts} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">POS</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeBranch?.name || 'Branch'} • {activeBusiness?.name}{session ? ' • Session open' : ' • No active session'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSession} disabled={sessionLoading}>
            {sessionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            Refresh Session
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} className="w-full sm:w-64" />
          </div>
          {filteredProducts.length === 0 ? (
            <EmptyState icon={<Package className="h-6 w-6" />} title="No Products" description="No products match your search" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className={cn('text-left rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50 transition-colors space-y-1', 'focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2')}>
                  <p className="font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-sm font-semibold text-slate-900">{currencySymbol} {formatPrice(parseFloat(p.price?.sellingPrice || '0'))}</p>
                  {p.sku && <p className="text-xs text-slate-500 truncate">{p.sku}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Cart ({cart.length})</h2>
              {cart.length > 0 && (<Button variant="ghost" size="sm" onClick={clearCart}><Trash2 className="h-3.5 w-3.5 mr-1" />Clear</Button>)}
            </div>
            {cart.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">Cart is empty</p> : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-96 overflow-auto">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500">{currencySymbol} {formatPrice(parseFloat(item.sellingPrice))} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, parseFloat(item.quantity) - 1)}><Minus className="h-3 w-3" /></Button>
                        <span className="text-sm w-8 text-center tabular-nums">{parseFloat(item.quantity)}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, parseFloat(item.quantity) + 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <span className="text-sm font-medium w-20 text-right tabular-nums">{currencySymbol} {formatPrice(parseFloat(item.sellingPrice) * parseFloat(item.quantity))}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.productId)}><Trash2 className="h-3 w-3 text-slate-500" /></Button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg tabular-nums">{currencySymbol} {formatPrice(total)}</span>
                  </div>
                  {checkoutError && <p className="text-xs text-red-600 bg-red-50 rounded-md p-2">{checkoutError}</p>}
                  {success && <p className="text-xs text-green-700 bg-green-50 rounded-md p-2">Sale completed successfully</p>}
                  <Button onClick={handleCheckout} disabled={checkoutLoading || cart.length === 0 || !activeBranch?.id} className="w-full" size="lg">
                    {checkoutLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                    Checkout
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
