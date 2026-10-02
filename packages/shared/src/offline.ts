// ================================================================
// PADUPOS — Offline-First POS Queue & Sync Contracts
// ================================================================

export type SyncOperation = 'FINALIZE_SALE' | 'OPEN_CASH_SESSION' | 'CLOSE_CASH_SESSION' | 'RECORD_CASH_MOVEMENT';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface OfflineSyncQueueItem {
  id: string;
  deviceId: string;
  businessId: string;
  branchId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncBatchResult {
  successful: Array<{ id: string; idempotencyKey: string; serverId?: string }>;
  conflicts: Array<{ id: string; idempotencyKey: string; reason: string }>;
  failed: Array<{ id: string; idempotencyKey: string; error: string; shouldRetry: boolean }>;
}

/**
 * Validates whether an offline cash sale can be safely queued
 */
export function validateOfflineCashSale(payload: Record<string, unknown>): { isValid: boolean; error?: string } {
  if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
    return { isValid: false, error: 'Cannot queue empty sale' };
  }
  if (payload.paymentMethod !== 'CASH') {
    return { isValid: false, error: 'Only CASH payment is supported in offline mode' };
  }
  if (!payload.branchId) {
    return { isValid: false, error: 'Branch ID is required for offline sale' };
  }
  return { isValid: true };
}

/**
 * Deduplicates sync queue items by idempotencyKey to prevent duplicate replay
 */
export function deduplicateSyncBatch(items: OfflineSyncQueueItem[]): OfflineSyncQueueItem[] {
  const seen = new Set<string>();
  const uniqueItems: OfflineSyncQueueItem[] = [];

  for (const item of items) {
    if (!seen.has(item.idempotencyKey)) {
      seen.add(item.idempotencyKey);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}
