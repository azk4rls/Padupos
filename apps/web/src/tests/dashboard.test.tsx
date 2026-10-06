import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/app/dashboard/page';
import { renderWithAuth, mockApiRoutes, apiError } from './test-utils';
import { metricsFixture, emptyMetricsFixture, seriesFixture, testBranch } from './fixtures';

/**
 * The dashboard now issues two parallel requests: metrics and the daily series.
 * Stubbing both by default keeps each test focused on one concern while the shared
 * shape stays honest about what the backend actually returns.
 */
function stubDashboard(
  overrides: {
    metrics?: () => unknown;
    series?: () => unknown;
  } = {},
) {
  return mockApiRoutes({
    '/dashboard/metrics': () => (overrides.metrics ? overrides.metrics() : metricsFixture),
    '/dashboard/metrics/series': () => (overrides.series ? overrides.series() : seriesFixture),
  });
}

describe('Phase 7 — Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state and never renders fabricated metrics while fetching', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    global.fetch = vi.fn(async () => {
      await gate;
      return { ok: true, status: 200, json: async () => metricsFixture } as unknown as Response;
    }) as unknown as typeof fetch;

    renderWithAuth(<DashboardPage />);

    // Skeleton is shown, and no money is asserted before data arrives.
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);

    release?.();
    await waitFor(() => expect(screen.getByText('Kopi Nusantara')).toBeInTheDocument());
  });

  it('requests metrics from the real dashboard endpoint', async () => {
    const { seen } = stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Kopi Nusantara')).toBeInTheDocument());
    expect(seen.some((u) => u.includes('/dashboard/metrics'))).toBe(true);
  });

  it('renders the primary sales metric and supporting period figures', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Penjualan Hari Ini')).toBeInTheDocument());

    const today = within(screen.getByRole('region', { name: 'Penjualan Hari Ini' }));
    // salesToday 150000.0000 -> grouped, IDR has no minor unit
    expect(today.getByText('Rp 150,000')).toBeInTheDocument();
    expect(today.getByText('Rp 900,000')).toBeInTheDocument(); // this week
    expect(today.getByText('Rp 3,600,000')).toBeInTheDocument(); // this month
  });

  it('renders backend profit figures verbatim without recomputing them', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    // Scope to the period region: the trend chart also labels a "Laba kotor" column.
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /Hasil Periode Berjalan/i })).toBeInTheDocument()
    );
    const period = within(screen.getByRole('region', { name: /Hasil Periode Berjalan/i }));
    expect(period.getByText('Rp 2,400,000')).toBeInTheDocument(); // grossProfit
    expect(period.getByText('Rp 1,200,000')).toBeInTheDocument(); // totalCOGS
    expect(period.getByText('Rp 1,000,000')).toBeInTheDocument(); // operatingExpenses
    expect(period.getByText('Rp 1,400,000')).toBeInTheDocument(); // operatingProfit
  });

  it('renders business attention metrics: low stock, receivables, payables', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Perlu Perhatian')).toBeInTheDocument());
    const attention = within(screen.getByRole('region', { name: /Perlu Perhatian/i }));

    expect(attention.getByText('Stok menipis')).toBeInTheDocument();
    expect(attention.getByText('3')).toBeInTheDocument(); // lowStockCount
    expect(attention.getByText('Rp 350,000')).toBeInTheDocument(); // receivables
    expect(attention.getByText('Rp 720,000')).toBeInTheDocument(); // payables
    expect(attention.getByText('Perlu pengadaan ulang')).toBeInTheDocument();
  });

  it('renders top products and payment distribution from backend aggregates', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Performa Produk')).toBeInTheDocument());
    const perf = within(screen.getByRole('region', { name: 'Performa Produk' }));
    expect(perf.getByText(/Kopi Susu Aren/)).toBeInTheDocument();
    expect(perf.getByText(/Es Teh Manis/)).toBeInTheDocument();
    expect(perf.getByText('120 unit')).toBeInTheDocument();

    const payments = within(screen.getByRole('region', { name: 'Komposisi Pembayaran' }));
    expect(payments.getByText('Tunai')).toBeInTheDocument();
    expect(payments.getByText('QRIS')).toBeInTheDocument();
    expect(payments.getByText('Rp 2,000,000')).toBeInTheDocument();
  });

  it('shows an honest empty state instead of zero-filled history', async () => {
    stubDashboard({ metrics: () => emptyMetricsFixture, series: () => ({ series: { ...seriesFixture.series, series: [] } }) });
    renderWithAuth(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText('Belum ada performa produk')).toBeInTheDocument()
    );
    // No product bars, and no fabricated payment breakdown.
    expect(screen.getByText('Semua stok dalam batas aman')).toBeInTheDocument();
    expect(
      screen.getByText(/Belum ada pembayaran tercatat untuk periode berjalan/)
    ).toBeInTheDocument();
  });

  it('surfaces an API error with retry instead of substituting zeroes', async () => {
    let attempt = 0;
    stubDashboard({
      metrics: () => {
        attempt += 1;
        return attempt === 1 ? apiError('Metrics service unavailable') : metricsFixture;
      },
    });

    renderWithAuth(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText('Data Dashboard Gagal Dimuat')).toBeInTheDocument()
    );
    expect(screen.getByText('Metrics service unavailable')).toBeInTheDocument();
    // Must NOT have rendered fabricated zero metrics.
    expect(screen.queryByText('Penjualan Hari Ini')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Coba lagi|Retry/i }));

    await waitFor(() => expect(screen.getByText('Penjualan Hari Ini')).toBeInTheDocument());
    expect(screen.getByText('Rp 150,000')).toBeInTheDocument();
  });

  it('surfaces network errors without inventing data', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused')) as unknown as typeof fetch;
    renderWithAuth(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText('Data Dashboard Gagal Dimuat')).toBeInTheDocument()
    );
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });

  it('reflects the active branch in the scope line', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />, { activeBranch: testBranch });

    await waitFor(() => expect(screen.getByText('Kopi Nusantara')).toBeInTheDocument());
    expect(screen.getByText(new RegExp(testBranch.name))).toBeInTheDocument();
  });

  it('keeps the hierarchy structure: sections are labelled for assistive tech', async () => {
    stubDashboard();
    const { container } = renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Penjualan Hari Ini')).toBeInTheDocument());

    const labelled = Array.from(container.querySelectorAll('section[aria-labelledby]'));
    expect(labelled.length).toBeGreaterThanOrEqual(3);
  });

  it('links attention items to the surfaces that can resolve them', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Perlu Perhatian')).toBeInTheDocument());
    const attention = screen.getByRole('region', { name: /Perlu Perhatian/i });
    const links = within(attention).getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/app/inventory');
    expect(hrefs).toContain('/app/finance/receivables');
    expect(hrefs).toContain('/app/finance/payables');
  });

  it('sends an explicit startDate and endDate with both dashboard requests', async () => {
    const { seen } = stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Penjualan Hari Ini')).toBeInTheDocument());

    const dashboardCalls = seen.filter((url) => url.includes('/dashboard/metrics'));
    expect(dashboardCalls.length).toBeGreaterThanOrEqual(2);
    for (const url of dashboardCalls) {
      // Bare YYYY-MM-DD, exactly the form the backend resolves in the scope timezone.
      expect(url).toMatch(/startDate=\d{4}-\d{2}-\d{2}/);
      expect(url).toMatch(/endDate=\d{4}-\d{2}-\d{2}/);
    }
    expect(dashboardCalls.some((url) => url.includes('/dashboard/metrics/series'))).toBe(true);
  });

  it('renders the daily trend from the series endpoint and exposes a data table', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText(/Tren 3 hari/i)).toBeInTheDocument());

    // The chart is present, and its accessible equivalent lists every real day,
    // including the zero-activity day the backend legitimately reports.
    expect(screen.getByText('Pendapatan harian')).toBeInTheDocument();
    expect(screen.getByText('Lihat data harian')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Lihat data harian'));
    expect(screen.getByText('2 Okt 2026')).toBeInTheDocument();
    expect(screen.getByText('3 Okt 2026')).toBeInTheDocument();
  });

  it('never recomputes payment proportions client-side', async () => {
    stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Komposisi Pembayaran')).toBeInTheDocument());

    // The bars are sized from the backend-supplied total (3600000), so CASH at
    // 2000000 must render as ~55.56% rather than any locally summed denominator.
    const cashRow = screen.getByText('Tunai').closest('li');
    const bar = cashRow?.querySelector('div > div') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(Number.parseFloat(bar!.style.width)).toBeCloseTo(55.55, 1);
  });

  it('changes the requested window when a period preset is chosen', async () => {
    const { seen } = stubDashboard();
    renderWithAuth(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Penjualan Hari Ini')).toBeInTheDocument());
    const before = seen.filter((u) => u.includes('/dashboard/metrics/series')).pop();

    await userEvent.click(screen.getByRole('button', { name: '7 hari' }));

    await waitFor(() => {
      const after = seen.filter((u) => u.includes('/dashboard/metrics/series')).pop();
      expect(after).not.toBe(before);
      // "Hari ini" collapses both bounds onto the same day.
      expect(after).toMatch(/startDate=([^&]+).*endDate=\1/);
    });
  });
});