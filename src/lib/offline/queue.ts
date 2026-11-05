import type { Invoice, InvoiceItem, OCRResult } from '../../types/invoice';
import { normalizeSupplierName } from '../supplier';

const DB_NAME = 'efacture-offline';
const STORE = 'scans';
const VERSION = 1;

export const OFFLINE_ID_PREFIX = 'offline-';
export const OFFLINE_PHOTO_PREFIX = 'offline-blob:';

export interface OfflineScan {
  id: string;
  userId: string;
  createdAt: string;
  photo: Blob;
  ocr: OCRResult;
  status: 'pending' | 'validated' | 'rejected';
  supplier_name_raw: string;
  invoice_date: string | null;
  total_amount: number;
  transport_fee?: number;
  notes: string;
  items: InvoiceItem[];
  lastError?: string;
}

export function isOfflineInvoiceId(id: string): boolean {
  return id.startsWith(OFFLINE_ID_PREFIX);
}

export function offlineRecordId(invoiceId: string): string {
  return invoiceId.startsWith(OFFLINE_ID_PREFIX) ? invoiceId.slice(OFFLINE_ID_PREFIX.length) : invoiceId;
}

export function isOfflinePhotoPath(path: string): boolean {
  return path.startsWith(OFFLINE_PHOTO_PREFIX);
}

export function offlinePhotoId(path: string): string {
  return path.slice(OFFLINE_PHOTO_PREFIX.length);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB abort'));
  });
}

export async function putOfflineScan(scan: OfflineScan): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(scan);
  await txDone(tx);
  db.close();
}

export async function getOfflineScan(id: string): Promise<OfflineScan | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(id);
  const row = await new Promise<OfflineScan | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as OfflineScan | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function deleteOfflineScan(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function listOfflineScans(userId: string): Promise<OfflineScan[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.objectStore(STORE).index('userId');
  const req = index.getAll(userId);
  const rows = await new Promise<OfflineScan[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OfflineScan[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countOfflineScans(userId: string): Promise<number> {
  const list = await listOfflineScans(userId);
  return list.filter((s) => s.status !== 'rejected').length;
}

export function scanToInvoice(scan: OfflineScan): Invoice {
  return {
    id: `${OFFLINE_ID_PREFIX}${scan.id}`,
    owner_id: scan.userId,
    supplier_id: null,
    supplier_name_raw: scan.supplier_name_raw,
    invoice_date: scan.invoice_date,
    total_amount: scan.total_amount,
    transport_fee: scan.transport_fee || 0,
    photo_path: `${OFFLINE_PHOTO_PREFIX}${scan.id}`,
    status: scan.status,
    ocr_raw_data: {
      provider: scan.ocr.provider,
      confidence: scan.ocr.confidence,
      raw_text: scan.ocr.raw_text,
      transport_fee: scan.transport_fee || 0,
    },
    notes: scan.lastError ? `${scan.notes} Échec d'envoi : ${scan.lastError}` : scan.notes,
    created_at: scan.createdAt,
    updated_at: scan.createdAt,
    invoice_items: scan.items.map((item) => ({ ...item })),
  };
}

export async function enqueueOfflineScan(userId: string, file: Blob, ocr: OCRResult): Promise<string> {
  const id = crypto.randomUUID();
  const items: InvoiceItem[] = ocr.items.map((item, idx) => ({
    id: `off-${idx}`,
    product_name: item.product_name,
    quantity: parseFloat(item.quantity) || 1,
    unit: item.unit || 'pièce',
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0,
  }));
  await putOfflineScan({
    id,
    userId,
    createdAt: new Date().toISOString(),
    photo: file,
    ocr,
    status: 'pending',
    supplier_name_raw: normalizeSupplierName(ocr.supplier_name),
    invoice_date: ocr.invoice_date || null,
    total_amount: parseFloat(ocr.total_amount) || 0,
    transport_fee: 0,
    notes: [
      ocr.confidence < 0.3 ? 'OCR faible — vérifiez les champs.' : '',
      'Hors-ligne — sera envoyé dès que le réseau reviendra.',
    ]
      .filter(Boolean)
      .join(' '),
    items,
  });
  return `${OFFLINE_ID_PREFIX}${id}`;
}

export function isNetworkFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|offline|timeout|failed to fetch|load failed|connexion|connection|ERR_|QUIC|internet/i.test(
    msg,
  );
}
