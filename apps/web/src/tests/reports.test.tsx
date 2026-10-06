import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReportsIndexPage from '@/app/app/reports/page';
import SalesReportPage from '@/app/app/reports/sales/page';
import ProductsReportPage from '@/app/app/reports/products/page';
import InventoryReportPage from '@/app/app/reports/inventory/page';
import ProfitReportPage from '@/app/app/reports/profit/page';
import ExpensesReportPage from '@/app/app/reports/expenses/page';
import ReceivablesReportPage from '@/app/app/reports/receivables/page';
import PayablesReportPage from '@/app/app/reports/payables/page';

import { renderWithAuth, mockApiRoutes, apiError } from './test-utils';
import {
  salesReportFixture,
  emptySalesReportFixture,
  productsFixture,
  inventoryFixture,
  inventoryMovementsFixture,
  profitLossFixture,
  expensesFixture,
  expenseCategoriesFixture,
  receivablesFixture,
  payablesFixture,
  testBranch,
} from './fixtures';

describe('Phase 7 — Reports workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('report index', () => {
    it('only lists reports whose backend endpoint exists', () => {
      renderWithAuth(<ReportsIndexPage />);
      const links = screen.getAllByRole('link');
      const hrefs = links.map((l) => l.getAttribute('href'));

      expect(hrefs).toEqual(
        expect.arrayContaining([
          '/app/reports/sales',
          '/app/reports/products',
          '/app/reports/inventory',
          '/app/reports/profit',
          '/app/reports/expenses',
          '/app/reports/receivables',
          '/app/reports/payables',
        ])
      );
    });

    it('advertises date filters and CSV export, and only withholds unimplemented formats', () => {
      renderWithAuth(<ReportsIndexPage />);
      // Backend now supports all three, so the index must claim them.
      expect(screen.getByText('Filter rentang tanggal')).toBeInTheDocument();
      expect(screen.getByText('Filter outlet')).toBeInTheDocument();
      expect(screen.getByText('Ekspor CSV')).toBeInTheDocument();
      // PDF/XLSX have no backend route, so they must stay marked as absent.
      expect(screen.getByText('Ekspor PDF / XLSX')).toBeInTheDocument();
      expect(screen.getByText('Belum ada')).toBeInTheDocument();
    });
  });

  describe('sales report', () => {
    it('renders summary and rows from GET /reports/sales', async () => {
      const { seen } = mockApiRoutes({ '/reports/sales': () => salesReportFixture });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/reports/sales'))).toBe(true);
      expect(screen.getByText('Rp 3,600,000')).toBeInTheDocument(); // totalRevenue
      expect(screen.getByText('Rp 2,400,000')).toBeInTheDocument(); // grossProfit
      expect(screen.getByText('66.67%')).toBeInTheDocument(); // margin from backend
      expect(screen.getByText('42')).toBeInTheDocument(); // transactionCount
      expect(screen.getByText('INV-0002')).toBeInTheDocument();
    });

    it('shows an honest empty state when the backend returns no sales', async () => {
      mockApiRoutes({ '/reports/sales': () => emptySalesReportFixture });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('Tidak ada transaksi')).toBeInTheDocument());
      expect(screen.getByText(/tidak mengembalikan transaksi penjualan/i)).toBeInTheDocument();
    });

    it('shows the error state and never substitutes zeroes', async () => {
      mockApiRoutes({ '/reports/sales': () => apiError('Reports service unavailable') });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('Reports service unavailable')).toBeInTheDocument();
      expect(screen.queryByText('INV-0001')).not.toBeInTheDocument();
    });

    it('sends branchId only when a branch filter is chosen', async () => {
      const { seen } = mockApiRoutes({ '/reports/sales': () => salesReportFixture });
      renderWithAuth(<SalesReportPage />, { activeBranch: testBranch });

      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
      // Default = all branches: no branchId param is invented.
      expect(seen[0]).not.toContain('branchId=');

      await userEvent.selectOptions(screen.getByLabelText('Filter outlet'), testBranch.id);

      await waitFor(() => expect(seen.some((u) => u.includes(`branchId=${testBranch.id}`))).toBe(true));
    });

    it('requests an explicit date window alongside the branch filter', async () => {
      const { seen } = mockApiRoutes({ '/reports/sales': () => salesReportFixture });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
      expect(seen[0]).toMatch(/startDate=\d{4}-\d{2}-\d{2}/);
      expect(seen[0]).toMatch(/endDate=\d{4}-\d{2}-\d{2}/);

      await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }));

      // "Hari ini" pins both bounds to the same calendar day.
      await waitFor(() => {
        const latest = seen[seen.length - 1];
        expect(latest).toMatch(/startDate=([^&]+).*endDate=\1/);
      });
    });

    it('re-requests the report when the selected period changes', async () => {
      const { seen } = mockApiRoutes({ '/reports/sales': () => salesReportFixture });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
      const before = seen.length;

      await userEvent.click(screen.getByRole('button', { name: '7 hari' }));

      await waitFor(() => expect(seen.length).toBeGreaterThan(before));
      const after = seen[seen.length - 1];
      expect(after).not.toBe(seen[before - 1]);
    });
  });

  describe('products report', () => {
    it('renders products with exact decimal formatting', async () => {
      const { seen } = mockApiRoutes({ '/products': () => productsFixture });
      renderWithAuth(<ProductsReportPage />);

      await waitFor(() => expect(screen.getByText('Kopi Susu Aren')).toBeInTheDocument());

      expect(seen[0]).toContain('page=1');
      expect(seen[0]).toContain('limit=20');
      expect(screen.getByText('Rp 18,000')).toBeInTheDocument();
      expect(screen.getByText('Rp 7,000')).toBeInTheDocument();
      expect(screen.getByText('KSA-001')).toBeInTheDocument();
    });

    it('forwards the search term to the backend query', async () => {
      const { seen } = mockApiRoutes({ '/products': () => productsFixture });
      renderWithAuth(<ProductsReportPage />);

      await waitFor(() => expect(screen.getByText('Kopi Susu Aren')).toBeInTheDocument());

      await userEvent.type(screen.getByLabelText('Cari produk'), 'kopi');

      await waitFor(() => expect(seen.some((u) => u.includes('search=kopi'))).toBe(true));
    });

    it('surfaces a backend error', async () => {
      mockApiRoutes({ '/products': () => apiError('Catalog unavailable') });
      renderWithAuth(<ProductsReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('Catalog unavailable')).toBeInTheDocument();
    });
  });

  describe('products report pagination', () => {
    it('requests the next page when the backend reports more pages', async () => {
      const paged = {
        products: [productsFixture.products[0]],
        pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
      };
      const { seen } = mockApiRoutes({ '/products': () => paged });
      renderWithAuth(<ProductsReportPage />);

      await waitFor(() => expect(screen.getByText('Halaman 1 dari 3 · 45 produk')).toBeInTheDocument());

      const next = screen.getByRole('button', { name: /Berikutnya/i });
      await userEvent.click(next);

      await waitFor(() => expect(seen.some((u) => u.includes('page=2'))).toBe(true));
    });

    it('hides pagination when the backend reports a single page', async () => {
      mockApiRoutes({ '/products': () => productsFixture });
      renderWithAuth(<ProductsReportPage />);

      await waitFor(() => expect(screen.getByText('Kopi Susu Aren')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /Berikutnya/i })).not.toBeInTheDocument();
    });
  });

  describe('inventory report', () => {
    it('renders stock levels and flags low stock using backend values', async () => {
      const { seen } = mockApiRoutes({
        '/inventory': () => inventoryFixture,
        '/inventory/movements': () => inventoryMovementsFixture,
      });
      renderWithAuth(<InventoryReportPage />);

      await waitFor(() => expect(screen.getByText('prd_1')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/inventory/movements'))).toBe(true);
      // availableQuantity 20 > minimumStock 10 -> Aman
      expect(screen.getByText('Aman')).toBeInTheDocument();
      // availableQuantity 4 <= minimumStock 10 -> Menipis
      expect(screen.getByText('Menipis')).toBeInTheDocument();
    });

    it('switches to the movements tab fed by /inventory/movements', async () => {
      mockApiRoutes({
        '/inventory': () => inventoryFixture,
        '/inventory/movements': () => inventoryMovementsFixture,
      });
      renderWithAuth(<InventoryReportPage />);

      await waitFor(() => expect(screen.getByText('prd_1')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('tab', { name: 'Pergerakan stok' }));

      await waitFor(() => expect(screen.getByText('SALE')).toBeInTheDocument());
      expect(screen.getByText(/SALE · sal_1/)).toBeInTheDocument();
    });

    it('shows an error state instead of an empty table on failure', async () => {
      mockApiRoutes({
        '/inventory': () => apiError('Inventory unavailable'),
        '/inventory/movements': () => inventoryMovementsFixture,
      });
      renderWithAuth(<InventoryReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('Inventory unavailable')).toBeInTheDocument();
    });
  });

  describe('profit report', () => {
    it('renders the backend P&L without deriving margin locally', async () => {
      const { seen } = mockApiRoutes({ '/finance/profit-loss': () => profitLossFixture });
      renderWithAuth(<ProfitReportPage />);

      await waitFor(() => expect(screen.getByText('Laba kotor')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/finance/profit-loss'))).toBe(true);
      expect(screen.getByText('Pendapatan')).toBeInTheDocument();
      expect(screen.getByText('Harga pokok penjualan')).toBeInTheDocument();
      expect(screen.getByText('Beban operasional')).toBeInTheDocument();
      expect(screen.getByText('Laba operasional')).toBeInTheDocument();
      expect(screen.getAllByText('Rp 3,600,000').length).toBeGreaterThan(0);
      expect(screen.getByText('Rp 1,400,000')).toBeInTheDocument();
    });

    it('reports a backend failure rather than rendering a zeroed statement', async () => {
      mockApiRoutes({ '/finance/profit-loss': () => apiError('GL unavailable') });
      renderWithAuth(<ProfitReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('GL unavailable')).toBeInTheDocument();
      expect(screen.queryByText('Laba kotor')).not.toBeInTheDocument();
    });
  });

  describe('expenses report', () => {
    it('renders expenses and totals', async () => {
      const { seen } = mockApiRoutes({
        '/finance/expenses': () => expensesFixture,
        '/finance/expense-categories': () => expenseCategoriesFixture,
      });
      renderWithAuth(<ExpensesReportPage />);

      await waitFor(() => expect(screen.getByText('Sewa kios Maret')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/finance/expenses'))).toBe(true);
      const table = within(screen.getByRole('table'));
      expect(table.getByText('Rp 250,000')).toBeInTheDocument();
      expect(table.getByText('Sewa')).toBeInTheDocument(); // category name resolved
      expect(table.getByText('Listrik')).toBeInTheDocument();
      // Honest total of the two visible rows, no fictitious "overall" duplicate.
      expect(screen.getByText('Rp 370,000')).toBeInTheDocument();
    });

    it('filters already-fetched rows by search term', async () => {
      mockApiRoutes({
        '/finance/expenses': () => expensesFixture,
        '/finance/expense-categories': () => expenseCategoriesFixture,
      });
      renderWithAuth(<ExpensesReportPage />);

      await waitFor(() => expect(screen.getByText('Sewa kios Maret')).toBeInTheDocument());

      await userEvent.type(screen.getByLabelText('Cari beban'), 'listrik');

      await waitFor(() => expect(screen.queryByText('Sewa kios Maret')).not.toBeInTheDocument());
      expect(screen.getByText('Listrik')).toBeInTheDocument();
    });

    it('surfaces a failure', async () => {
      mockApiRoutes({
        '/finance/expenses': () => apiError('Expenses unavailable'),
        '/finance/expense-categories': () => expenseCategoriesFixture,
      });
      renderWithAuth(<ExpensesReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('Expenses unavailable')).toBeInTheDocument();
    });
  });

  describe('receivables report', () => {
    it('renders receivables and outstanding totals', async () => {
      const { seen } = mockApiRoutes({ '/finance/receivables': () => receivablesFixture });
      renderWithAuth(<ReceivablesReportPage />);

      await waitFor(() => expect(screen.getByText('cus_1')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/finance/receivables'))).toBe(true);
      const table = within(screen.getByRole('table'));
      expect(table.getByText('Rp 300,000')).toBeInTheDocument(); // remaining
      expect(table.getByText('Sebagian')).toBeInTheDocument();
      expect(table.getAllByText('Jatuh tempo').length).toBeGreaterThan(0); // OVERDUE row
      expect(screen.getByText('Lewat jatuh tempo')).toBeInTheDocument();
      // 300k + 400k outstanding
      expect(screen.getByText('Rp 700,000')).toBeInTheDocument();
    });

    it('filters by status using backend-provided status values', async () => {
      mockApiRoutes({ '/finance/receivables': () => receivablesFixture });
      renderWithAuth(<ReceivablesReportPage />);

      await waitFor(() => expect(screen.getByText('cus_1')).toBeInTheDocument());

      await userEvent.selectOptions(screen.getByLabelText('Filter status piutang'), 'OVERDUE');

      await waitFor(() => expect(screen.queryByText('cus_1')).not.toBeInTheDocument());
      expect(screen.getByText('cus_2')).toBeInTheDocument();
    });

    it('shows an error state', async () => {
      mockApiRoutes({ '/finance/receivables': () => apiError('AR unavailable') });
      renderWithAuth(<ReceivablesReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('AR unavailable')).toBeInTheDocument();
    });
  });

  describe('payables report', () => {
    it('renders payables and remaining obligations', async () => {
      const { seen } = mockApiRoutes({ '/finance/payables': () => payablesFixture });
      renderWithAuth(<PayablesReportPage />);

      await waitFor(() => expect(screen.getByText('sup_1')).toBeInTheDocument());

      expect(seen.some((u) => u.includes('/finance/payables'))).toBe(true);
      const table = within(screen.getByRole('table'));
      expect(table.getByText('Rp 800,000')).toBeInTheDocument();
      expect(table.getByText('Rp 500,000')).toBeInTheDocument();
      expect(table.getByText('Sebagian')).toBeInTheDocument();
    });

    it('shows an honest empty state', async () => {
      mockApiRoutes({ '/finance/payables': () => ({ payables: [] }) });
      renderWithAuth(<PayablesReportPage />);

      await waitFor(() => expect(screen.getByText('Belum ada hutang')).toBeInTheDocument());
      expect(screen.getByText(/tidak mengembalikan kewajiban pemasok/i)).toBeInTheDocument();
    });

    it('shows an error state', async () => {
      mockApiRoutes({ '/finance/payables': () => apiError('AP unavailable') });
      renderWithAuth(<PayablesReportPage />);

      await waitFor(() => expect(screen.getByText('Laporan gagal dimuat')).toBeInTheDocument());
      expect(screen.getByText('AP unavailable')).toBeInTheDocument();
    });
  });

  describe('tenant scope', () => {
    it('never sends a business identifier as an authorization decision from the page', async () => {
      const { seen } = mockApiRoutes({ '/reports/sales': () => salesReportFixture });
      renderWithAuth(<SalesReportPage />);

      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

      // The API client attaches x-business-id from the authenticated session,
      // and the page itself never appends a business id to the query string.
      expect(seen[0]).not.toContain('businessId=');
      expect(seen[0]).not.toContain('biz_test_001');
    });
  });

  describe('CSV export', () => {
    it('requests a ticket, then downloads the bytes with the tenant headers', async () => {
      localStorage.setItem('padupos_auth_token', 'token_xyz');
      localStorage.setItem('padupos_business_id', 'biz_test_001');

      const created = (URL.createObjectURL = vi.fn(() => 'blob:mock')) as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn();

      // Routes are matched on the path, not an absolute URL, because the api client
      // prefixes NEXT_PUBLIC_API_URL.
      global.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (new URL(url, 'http://x').pathname.endsWith('/reports/export')) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              token: 'tok_abc123',
              downloadUrl: '/reports/exports/tok_abc123',
              reportType: 'SALES',
              format: 'CSV',
              rowCount: 2,
              fileName: 'padupos-sales.csv',
              expiresAt: '2026-10-30T10:15:00.000Z',
            }),
          } as unknown as Response;
        }
        if (new URL(url, 'http://x').pathname.includes('/reports/exports/')) {
          return {
            ok: true,
            status: 200,
            blob: async () => new Blob(['a,b\n1,2'], { type: 'text/csv' }),
            json: async () => ({}),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => salesReportFixture,
        } as unknown as Response;
      }) as unknown as typeof fetch;

      renderWithAuth(<SalesReportPage />);
      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: /Ekspor CSV/i }));

      await waitFor(() =>
        expect(
          screen.getByText(/baris diekspor|Gagal|Ekspor ditolak/i)
        ).toBeInTheDocument()
      );

      const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const exportCall = calls.find(([url]) => String(url).endsWith('/reports/export'));
      expect(exportCall).toBeDefined();
      expect(JSON.parse(String(exportCall![1]?.body))).toMatchObject({
        format: 'CSV',
        reportType: 'SALES',
      });

      // The download must carry auth + business headers; it is not a public link.
      const downloadCall = calls.find(([url]) => String(url).includes('/reports/exports/'));
      expect(downloadCall).toBeDefined();
      const downloadHeaders = downloadCall![1]?.headers as Record<string, string>;
      expect(downloadHeaders.Authorization).toBe('Bearer token_xyz');
      expect(downloadHeaders['x-business-id']).toBe('biz_test_001');
      expect(created).toHaveBeenCalled();
    });

    it('surfaces an export failure instead of pretending a file was produced', async () => {
      global.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/reports/export')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({ error: { code: 'PERMISSION_DENIED', message: 'Ekspor ditolak' } }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => salesReportFixture,
        } as unknown as Response;
      }) as unknown as typeof fetch;

      renderWithAuth(<SalesReportPage />);
      await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: /Ekspor CSV/i }));

      await waitFor(() => expect(screen.getByText('Ekspor ditolak')).toBeInTheDocument());
    });
  });
});