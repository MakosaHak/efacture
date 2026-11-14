/**
 * Base de données locale (IndexedDB) — toutes les données de l'application
 * vivent dans le navigateur : comptes, factures (avec leurs lignes), photos,
 * prix de vente et réglages. La synchronisation Supabase (facultative) vient
 * par-dessus : la file `outbox` garde les écritures à envoyer.
 */

const DB_NAME = 'efacture';
const DB_VERSION = 2;

export const STORES = {
  users: 'users',
  invoices: 'invoices',
  photos: 'photos',
  productPrices: 'product_prices',
  settings: 'settings',
  outbox: 'outbox',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Stockage local indisponible sur cet appareil.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.users)) {
        const users = db.createObjectStore(STORES.users, { keyPath: 'id' });
        users.createIndex('phone', 'phone', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORES.invoices)) {
        const invoices = db.createObjectStore(STORES.invoices, { keyPath: 'id' });
        invoices.createIndex('owner_id', 'owner_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.photos)) {
        db.createObjectStore(STORES.photos, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.productPrices)) {
        const prices = db.createObjectStore(STORES.productPrices, { keyPath: 'id' });
        prices.createIndex('owner_id', 'owner_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.outbox)) {
        const outbox = db.createObjectStore(STORES.outbox, { keyPath: 'id' });
        outbox.createIndex('owner_id', 'owner_id', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Impossible d’ouvrir le stockage local.'));
    };
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Erreur de stockage local.'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Erreur de stockage local.'));
    tx.onabort = () => reject(tx.error ?? new Error('Opération annulée.'));
  });
}

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const value = await request(tx.objectStore(store).get(key));
  await done(tx);
  return value as T | undefined;
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const rows = await request(tx.objectStore(store).getAll());
  await done(tx);
  return rows as T[];
}

export async function dbGetAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const rows = await request(tx.objectStore(store).index(index).getAll(value));
  await done(tx);
  return rows as T[];
}

export async function dbGetByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const row = await request(tx.objectStore(store).index(index).get(value));
  await done(tx);
  return row as T | undefined;
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
}

export async function dbPutMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  values.forEach((v) => os.put(v));
  await done(tx);
}

export async function dbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

export async function dbCount(store: StoreName): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const n = await request(tx.objectStore(store).count());
  await done(tx);
  return n;
}

/** Demande au navigateur de ne pas purger le stockage (PWA installée). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
