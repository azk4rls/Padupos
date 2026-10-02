import { offlineDB, type OfflineSyncItem } from './db.js';
import type { OfflineSyncBatch, OfflineSyncQueueItem, SyncBatchResponse } from '@padupos/types';

export interface SyncManagerConfig {
  apiBaseUrl: string;
  businessId: string;
  branchId: string;
  deviceId: string;
  getAuthToken: () => string | null;
  onSyncSuccess?: (result: SyncBatchResponse) => void;
  onSyncError?: (error: Error) => void;
}

export class OfflineSyncManager {
  private config: SyncManagerConfig;
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(config: SyncManagerConfig) {
    this.config = config;
  }

  // Starts auto-sync listener when browser reconnects to network
  initAutoSync(intervalMs = 30000) {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[PADUPOS SYNC] Network back online. Triggering sync...');
      this.syncNow();
    });

    // Periodic heartbeat sync
    this.syncTimer = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncNow();
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Queue an offline cash sale for synchronization
  async queueOfflineSale(salePayload: Record<string, unknown>, saleId: string): Promise<string> {
    const syncItem: OfflineSyncItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clientMutationId: `cmut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      businessId: this.config.businessId,
      branchId: this.config.branchId,
      entityType: 'SALE',
      entityId: saleId,
      operation: 'CREATE',
      payload: salePayload,
      clientTimestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
    };

    await offlineDB.enqueueMutation(syncItem);

    // If online, attempt immediate sync
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncNow();
    }

    return syncItem.id;
  }

  // Trigger batch sync now
  async syncNow(): Promise<SyncBatchResponse | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;

    try {
      const pending = await offlineDB.getPendingMutations();
      if (pending.length === 0) {
        this.isSyncing = false;
        return null;
      }

      // Mark items as SYNCING
      for (const item of pending) {
        await offlineDB.updateMutationStatus(item.id, 'SYNCING');
      }

      const syncItems: OfflineSyncQueueItem[] = pending.map((p) => ({
        id: p.id,
        deviceId: this.config.deviceId,
        branchId: p.branchId,
        operation: 'FINALIZE_SALE',
        payload: p.payload,
        idempotencyKey: p.clientMutationId,
        createdAt: p.clientTimestamp,
        retryCount: p.retryCount,
      }));

      const batchPayload: OfflineSyncBatch = {
        deviceId: this.config.deviceId,
        batch: syncItems,
      };

      const token = this.config.getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-business-id': this.config.businessId,
        'x-branch-id': this.config.branchId,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/pos/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batchPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Sync HTTP error ${response.status}: ${errText}`);
      }

      const result: SyncBatchResponse = await response.json();

      // Process confirmed items
      for (const item of result.successful) {
        await offlineDB.removeSyncedMutation(item.id);
      }

      // Process conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        for (const conflict of result.conflicts) {
          await offlineDB.updateMutationStatus(conflict.id, 'FAILED', `Conflict: ${conflict.reason}`);
        }
      }

      // Process failed
      if (result.failed && result.failed.length > 0) {
        for (const failure of result.failed) {
          await offlineDB.updateMutationStatus(failure.id, 'FAILED', failure.error);
        }
      }

      this.config.onSyncSuccess?.(result);
      return result;
    } catch (err: any) {
      console.error('[PADUPOS SYNC ERROR]', err);
      // Revert status to FAILED
      const pending = await offlineDB.getPendingMutations();
      for (const item of pending) {
        await offlineDB.updateMutationStatus(item.id, 'FAILED', err.message);
      }
      this.config.onSyncError?.(err);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }
}
