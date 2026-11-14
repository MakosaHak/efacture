/**
 * Accès aux données locales (IndexedDB). Toutes les fonctions sont scopées
 * par propriétaire (`ownerId`) : plusieurs comptes peuvent coexister sur
 * le même appareil sans voir les données des autres.
 *
 * Chaque écriture locale est aussi notée dans la file `outbox` pour être
 * envoyée à Supabase quand la synchronisation est active (voir sync/cloud-sync).
 */
import type { Invoice, ProductPrice } from '../../types/invoice';
import type { LocalUserRecord } from '../../types/auth';
import {
  dbDelete,
  dbGet,
  dbGetAllByIndex,
  dbGetByIndex,
  dbPut,
  dbPutMany,
  STORES,
} from './local-db';

/* ------------------------------------------------------------------ */
/* File d'envoi (outbox)                                               */
/* ------------------------------------------------------------------ */

export type OutboxKind = 'invoice' | 'delete_invoice' | 'price' | 'profile' | 'photo' | 'delete_photo';

export interface OutboxItem {
  /** `${kind}:${ref}` — une seule entrée par objet, la dernière écriture gagne. */
  id: string;
  owner_id: string;
  kind: OutboxKind;
  ref: string;
  created_at: string;
}

/** Vrai pendant l'application de données venues du cloud : rien n'est renvoyé. */
let applyingRemote = false;

export async function withRemote<T>(fn: () => Promise<T>): Promise<T> {
  const previous = applyingRemote;
  applyingRemote = true;
  try {
    return await fn();
  } finally {
    applyingRemote = previous;
  }
}

async function enqueue(ownerId: string | undefined, kind: OutboxKind, ref: string): Promise<void> {
  if (applyingRemote || !ownerId) return;
  await dbPut<OutboxItem>(STORES.outbox, { id: `${kind}:${ref}`, owner_id: ownerId, kind, ref, created_at: new Date().toISOString() });
  notifyOutbox();
}

export const listOutbox = (ownerId: string) =>
  dbGetAllByIndex<OutboxItem>(STORES.outbox, 'owner_id', ownerId).then((rows) => rows.sort((a, b) => a.created_at.localeCompare(b.created_at)));
export const removeOutbox = (id: string) => dbDelete(STORES.outbox, id);

const outboxListeners = new Set<() => void>();
export function onOutboxChange(cb: () => void): () => void {
  outboxListeners.add(cb);
  return () => outboxListeners.delete(cb);
}
function notifyOutbox() {
  outboxListeners.forEach((cb) => cb());
}

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export const getUserById = (id: string) => dbGet<LocalUserRecord>(STORES.users, id);
export const getUserByPhone = (phone: string) => dbGetByIndex<LocalUserRecord>(STORES.users, 'phone', phone);
export async function putUser(user: LocalUserRecord, { sync = true } = {}): Promise<void> {
  await dbPut(STORES.users, user);
  if (sync) await enqueue(user.id, 'profile', user.id);
}
export const removeUser = (id: string) => dbDelete(STORES.users, id);

/* ------------------------------------------------------------------ */
/* Factures (lignes incluses dans l'objet)                             */
/* ------------------------------------------------------------------ */

export async function listInvoices(ownerId: string): Promise<Invoice[]> {
  const rows = await dbGetAllByIndex<Invoice>(STORES.invoices, 'owner_id', ownerId);
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listValidatedInvoices(ownerId: string): Promise<Invoice[]> {
  return (await listInvoices(ownerId)).filter((inv) => inv.status === 'validated');
}

export const getInvoice = (id: string) => dbGet<Invoice>(STORES.invoices, id);

export async function putInvoice(invoice: Invoice): Promise<void> {
  await dbPut(STORES.invoices, invoice);
  await enqueue(invoice.owner_id, 'invoice', invoice.id);
}

export async function putInvoices(invoices: Invoice[]): Promise<void> {
  await dbPutMany(STORES.invoices, invoices);
  for (const inv of invoices) await enqueue(inv.owner_id, 'invoice', inv.id);
}

export async function removeInvoice(id: string): Promise<void> {
  const existing = await dbGet<Invoice>(STORES.invoices, id);
  await dbDelete(STORES.invoices, id);
  if (existing) {
    await dbDelete(STORES.outbox, `invoice:${id}`);
    await enqueue(existing.owner_id, 'delete_invoice', id);
  }
}

/* ------------------------------------------------------------------ */
/* Photos (Blob)                                                        */
/* ------------------------------------------------------------------ */

interface PhotoRecord {
  id: string;
  blob: Blob;
  created_at: string;
}

export const PHOTO_PREFIX = 'local:';

export function photoIdFromPath(path: string): string | null {
  return path?.startsWith(PHOTO_PREFIX) ? path.slice(PHOTO_PREFIX.length) : null;
}

export async function putPhoto(id: string, blob: Blob, ownerId?: string): Promise<string> {
  await dbPut<PhotoRecord>(STORES.photos, { id, blob, created_at: new Date().toISOString() });
  await enqueue(ownerId, 'photo', id);
  return `${PHOTO_PREFIX}${id}`;
}

/** Lecture brute (sans repli cloud). */
export async function getLocalPhotoBlob(path: string): Promise<Blob | null> {
  const id = photoIdFromPath(path);
  if (!id) return null;
  const row = await dbGet<PhotoRecord>(STORES.photos, id);
  return row?.blob ?? null;
}

/** Repli facultatif : branché par la synchronisation pour télécharger une photo absente. */
let photoFallback: ((id: string) => Promise<Blob | null>) | null = null;
export function setPhotoFallback(fn: ((id: string) => Promise<Blob | null>) | null): void {
  photoFallback = fn;
}

export async function getPhotoBlob(path: string): Promise<Blob | null> {
  const local = await getLocalPhotoBlob(path);
  if (local) return local;
  const id = photoIdFromPath(path);
  if (!id || !photoFallback) return null;
  try {
    const blob = await photoFallback(id);
    if (blob) await dbPut<PhotoRecord>(STORES.photos, { id, blob, created_at: new Date().toISOString() });
    return blob;
  } catch {
    return null;
  }
}

export async function removePhoto(path: string, ownerId?: string): Promise<void> {
  const id = photoIdFromPath(path);
  if (!id) return;
  await dbDelete(STORES.photos, id);
  await dbDelete(STORES.outbox, `photo:${id}`);
  await enqueue(ownerId, 'delete_photo', id);
}

/* ------------------------------------------------------------------ */
/* Prix de vente                                                        */
/* ------------------------------------------------------------------ */

export interface ProductPriceRecord extends ProductPrice {
  id: string;
  owner_id: string;
}

export const priceId = (ownerId: string, key: string) => `${ownerId}:${key}`;

export async function listProductPrices(ownerId: string): Promise<ProductPrice[]> {
  const rows = await dbGetAllByIndex<ProductPriceRecord>(STORES.productPrices, 'owner_id', ownerId);
  return rows.map(({ id: _id, owner_id: _owner, ...rest }) => rest);
}

export async function putProductPrices(ownerId: string, rows: ProductPrice[]): Promise<void> {
  await dbPutMany<ProductPriceRecord>(
    STORES.productPrices,
    rows.map((r) => ({ ...r, id: priceId(ownerId, r.product_key), owner_id: ownerId })),
  );
  for (const r of rows) await enqueue(ownerId, 'price', r.product_key);
}

export const getProductPriceRecord = (ownerId: string, key: string) =>
  dbGet<ProductPriceRecord>(STORES.productPrices, priceId(ownerId, key));

/* ------------------------------------------------------------------ */
/* Réglages par compte                                                 */
/* ------------------------------------------------------------------ */

interface SettingRecord<T> {
  id: string;
  value: T;
}

export async function getSetting<T>(ownerId: string, key: string): Promise<T | undefined> {
  const row = await dbGet<SettingRecord<T>>(STORES.settings, `${ownerId}:${key}`);
  return row?.value;
}

export function putSetting<T>(ownerId: string, key: string, value: T): Promise<void> {
  return dbPut<SettingRecord<T>>(STORES.settings, { id: `${ownerId}:${key}`, value });
}
