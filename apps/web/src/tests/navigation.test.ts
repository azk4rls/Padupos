import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../components/layout/Sidebar';

describe('PADUPOS Navigation Configuration', () => {
  it('contains all essential core business OS modules', () => {
    const labels = NAV_ITEMS.map((item) => item.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Kasir POS');
    expect(labels).toContain('Produk');
    expect(labels).toContain('Inventori');
    expect(labels).toContain('Pembelian');
    expect(labels).toContain('Pemasok');
    expect(labels).toContain('Keuangan');
    expect(labels).toContain('Laporan');
    expect(labels).toContain('AI Insights');
    expect(labels).toContain('ML Forecast');
    expect(labels).toContain('Langganan');
    expect(labels).toContain('Pengaturan');
  });

  it('provides correct route paths for all navigation items', () => {
    const paths = NAV_ITEMS.map((item) => item.href);
    expect(paths).toContain('/app/dashboard');
    expect(paths).toContain('/app/pos');
    expect(paths).toContain('/app/products');
    expect(paths).toContain('/app/inventory');
    expect(paths).toContain('/app/finance');
    expect(paths).toContain('/app/reports');
  });
});
