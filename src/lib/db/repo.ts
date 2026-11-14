/**
 * Accès aux données locales (IndexedDB). Toutes les fonctions sont scopées
 * par propriétaire (`ownerId`) : plusieurs comptes peuvent coexister sur
 * le même appareil sans voir les données des autres.
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
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export const getUserById = (id: string) => dbGet<LocalUserRecord>(STORES.users, id);
export const getUserByPhone = (phone: string) => dbGetByIndex<LocalUserRecord>(STORES.users, 'phone', phone);
export const putUser = (user: LocalUserRecord) => dbPut(STORES.users, user);

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
export const putInvoice = (invoice: Invoice) => dbPut(STORES.invoices, invoice);
export const putInvoices = (invoices: Invoice[]) => dbPutMany(STORES.invoices, invoices);
export const removeInvoice = (id: string) => dbDelete(STORES.invoices, id);

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

export async function putPhoto(id: string, blob: Blob): Promise<string> {
  await dbPut<PhotoRecord>(STORES.photos, { id, blob, created_at: new Date().toISOString() });
  return `${PHOTO_PREFIX}${id}`;
}

export async function getPhotoBlob(path: string): Promise<Blob | null> {
  const id = photoIdFromPath(path);
  if (!id) return null;
  const row = await dbGet<PhotoRecord>(STORES.photos, id);
  return row?.blob ?? null;
}

export async function removePhoto(path: string): Promise<void> {
  const id = photoIdFromPath(path);
  if (id) await dbDelete(STORES.photos, id);
}

/* ------------------------------------------------------------------ */
/* Prix de vente                                                        */
/* ------------------------------------------------------------------ */

interface ProductPriceRecord extends ProductPrice {
  id: string;
  owner_id: string;
}

const priceId = (ownerId: string, key: string) => `${ownerId}:${key}`;

export async function listProductPrices(ownerId: string): Promise<ProductPrice[]> {
  const rows = await dbGetAllByIndex<ProductPriceRecord>(STORES.productPrices, 'owner_id', ownerId);
  return rows.map(({ id: _id, owner_id: _owner, ...rest }) => rest);
}

export async function putProductPrices(ownerId: string, rows: ProductPrice[]): Promise<void> {
  await dbPutMany<ProductPriceRecord>(
    STORES.productPrices,
    rows.map((r) => ({ ...r, id: priceId(ownerId, r.product_key), owner_id: ownerId })),
  );
}

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
