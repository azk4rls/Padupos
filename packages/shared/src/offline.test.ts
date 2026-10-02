import { describe, it, expect } from 'vitest';
import { validateOfflineCashSale, deduplicateSyncBatch, type OfflineSyncQueueItem } from './offline.js';

describe('PADUPOS — Offline-First POS Contracts', () => {
  it('allows valid offline cash sale', () => {
    const res = validateOfflineCashSale({
      branchId: 'branch_1',
      paymentMethod: 'CASH',
      items: [{ productId: 'prod_1', quantity: '1', unitPrice: '10000' }],
    });
    expect(res.isValid).toBe(true);
  });

  it('rejects online payment methods in offline queue', () => {
    const res = validateOfflineCashSale({
      branchId: 'branch_1',
      paymentMethod: 'QR',
      items: [{ productId: 'prod_1', quantity: '1', unitPrice: '10000' }],
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Only CASH payment is supported in offline mode');
  });

  it('rejects empty sales', () => {
    const res = validateOfflineCashSale({
      branchId: 'branch_1',
      paymentMethod: 'CASH',
      items: [],
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Cannot queue empty sale');
  });

  it('deduplicates offline batch by idempotencyKey to prevent duplicate execution', () => {
    const items: OfflineSyncQueueItem[] = [
      {
        id: 'sync_1',
        deviceId: 'dev_A',
        businessId: 'biz_1',
        branchId: 'branch_1',
        operation: 'FINALIZE_SALE',
        payload: { invoice: 'INV-001' },
        idempotencyKey: 'idem_key_1',
        retryCount: 0,
        status: 'PENDING',
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'sync_2',
        deviceId: 'dev_A',
        businessId: 'biz_1',
        branchId: 'branch_1',
        operation: 'FINALIZE_SALE',
        payload: { invoice: 'INV-001' },
        idempotencyKey: 'idem_key_1', // Duplicate!
        retryCount: 1,
        status: 'PENDING',
        createdAt: '2026-10-01T00:01:00Z',
      },
      {
        id: 'sync_3',
        deviceId: 'dev_A',
        businessId: 'biz_1',
        branchId: 'branch_1',
        operation: 'FINALIZE_SALE',
        payload: { invoice: 'INV-002' },
        idempotencyKey: 'idem_key_2',
        retryCount: 0,
        status: 'PENDING',
        createdAt: '2026-10-01T00:02:00Z',
      },
    ];

    const deduplicated = deduplicateSyncBatch(items);
    expect(deduplicated.length).toBe(2);
    expect(deduplicated[0].id).toBe('sync_1');
    expect(deduplicated[1].id).toBe('sync_3');
  });
});
