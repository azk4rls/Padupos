// PADUPOS Offline IndexedDB Storage Layer
// Provides offline storage for Catalog, Active Cash Session, and Outbound Sync Queue.

export interface OfflineProduct {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: string;
  costPrice: string;
  currentStock: string;
  categoryId?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface OfflineSyncItem {
  id: string; // client sync item UUID
  clientMutationId: string;
  businessId: string;
  branchId: string;
  entityType: 'SALE' | 'CASH_SESSION' | 'INVENTORY_ADJUSTMENT' | 'CUSTOMER';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  clientTimestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'padupos_offline_db';
const DB_VERSION = 1;

export class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available in current environment');
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Products Catalog Cache
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('sku', 'sku', { unique: false });
          productStore.createIndex('barcode', 'barcode', { unique: false });
        }

        // Outbound Sync Mutation Queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('clientTimestamp', 'clientTimestamp', { unique: false });
        }

        // Active Cashier Session Cache
        if (!db.objectStoreNames.contains('activeSession')) {
          db.createObjectStore('activeSession', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // --- Products ---
  async saveProducts(products: OfflineProduct[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      for (const p of products) {
        store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllProducts(): Promise<OfflineProduct[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Sync Queue ---
  async enqueueMutation(item: OfflineSyncItem): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingMutations(): Promise<OfflineSyncItem[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflineSyncItem[] = req.result || [];
        const pending = all.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
        resolve(pending.sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateMutationStatus(id: string, status: OfflineSyncItem['status'], error?: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item: OfflineSyncItem = getReq.result;
        if (!item) return resolve();
        item.status = status;
        if (error) {
          item.lastError = error;
          item.retryCount = (item.retryCount || 0) + 1;
        }
        store.put(item);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeSyncedMutation(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDB = new OfflineDB();
