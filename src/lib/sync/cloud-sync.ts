/**
 * Synchronisation local ↔ Supabase.
 *
 * Le stockage local (IndexedDB) reste la source affichée à l'écran. Ce module :
 *  1. envoie la file `outbox` (reçus, prix, profil, photos) vers Supabase ;
 *  2. rapatrie ce qui a changé côté cloud depuis la dernière fois (autres appareils) ;
 *  3. écoute le temps réel pour appliquer les changements au fil de l'eau ;
 *  4. télécharge à la demande une photo absente de l'appareil.
 *
 * Sans client Supabase configuré, rien de tout cela ne s'exécute.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Invoice, ProductPrice, Profile } from '../../types/invoice';
import { isNetworkError, isOnline, PHOTO_BUCKET, supabase } from '../supabase';
import {
  getInvoice,
  getLocalPhotoBlob,
  getProductPriceRecord,
  getSetting,
  getUserById,
  listOutbox,
  onOutboxChange,
  putInvoice,
  putProductPrices,
  putSetting,
  putUser,
  removeOutbox,
  setPhotoFallback,
  withRemote,
  type OutboxItem,
} from '../db/repo';
import { dbDelete, STORES } from '../db/local-db';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncAt: string | null;
  error?: string;
}

let owner: string | null = null;
let channel: RealtimeChannel | null = null;
let timer: number | null = null;
let flushing = false;
let flushAgain = false;
let state: SyncState = { status: 'off', pending: 0, lastSyncAt: null };

const stateListeners = new Set<(s: SyncState) => void>();
const dataListeners = new Set<() => void>();

export function onSyncState(cb: (s: SyncState) => void): () => void {
  stateListeners.add(cb);
  cb(state);
  return () => stateListeners.delete(cb);
}

/** Prévient l'interface qu'une donnée locale a changé suite au cloud. */
export function onRemoteData(cb: () => void): () => void {
  dataListeners.add(cb);
  return () => dataListeners.delete(cb);
}

export function getSyncState(): SyncState {
  return state;
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  stateListeners.forEach((cb) => cb(state));
}

function notifyData() {
  dataListeners.forEach((cb) => cb());
}

async function refreshPending() {
  if (!owner) return;
  const rows = await listOutbox(owner);
  setState({ pending: rows.length });
}

/* ------------------------------------------------------------------ */
/* Démarrage / arrêt                                                   */
/* ------------------------------------------------------------------ */

let unsubscribeOutbox: (() => void) | null = null;

export async function startSync(ownerId: string): Promise<void> {
  if (!supabase) return;
  if (owner === ownerId && channel) return;
  stopSync();
  owner = ownerId;
  setState({ status: isOnline() ? 'idle' : 'offline' });

  setPhotoFallback(downloadPhoto);
  unsubscribeOutbox = onOutboxChange(() => {
    void refreshPending();
    scheduleFlush();
  });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  timer = window.setInterval(() => void syncNow(), 60_000);

  channel = supabase
    .channel(`efacture:${ownerId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `owner_id=eq.${ownerId}` }, (p) => void applyRemoteInvoice(p.new as CloudRow))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices', filter: `owner_id=eq.${ownerId}` }, (p) => void applyRemotePrice(p.new as CloudRow))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${ownerId}` }, (p) => void applyRemoteProfile(p.new as CloudRow))
    .subscribe();

  await refreshPending();
  await syncNow();
}

export function stopSync(): void {
  if (channel) {
    void channel.unsubscribe();
    channel = null;
  }
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  unsubscribeOutbox?.();
  unsubscribeOutbox = null;
  setPhotoFallback(null);
  owner = null;
  setState({ status: 'off', pending: 0 });
}

function onOnline() {
  setState({ status: 'idle' });
  void syncNow();
}
function onOffline() {
  setState({ status: 'offline' });
}

let flushTimeout: number | null = null;
function scheduleFlush() {
  if (flushTimeout) window.clearTimeout(flushTimeout);
  flushTimeout = window.setTimeout(() => void flush(), 400);
}

/** Envoi puis rapatriement. Sans effet hors connexion. */
export async function syncNow(): Promise<void> {
  if (!supabase || !owner || !isOnline()) return;
  await flush();
  await pull();
}

/* ------------------------------------------------------------------ */
/* Envoi (outbox → cloud)                                              */
/* ------------------------------------------------------------------ */

type CloudRow = { id: string; owner_id?: string; data: unknown; deleted?: boolean; updated_at: string };

async function flush(): Promise<void> {
  if (!supabase || !owner || !isOnline()) return;
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  setState({ status: 'syncing', error: undefined });
  const me = owner;
  try {
    const items = await listOutbox(me);
    for (const item of items) {
      await sendItem(me, item);
      await removeOutbox(item.id);
    }
    setState({ status: 'idle', pending: 0, lastSyncAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setState({ status: isNetworkError(err) ? 'offline' : 'error', error: msg });
    await refreshPending();
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      scheduleFlush();
    }
  }
}

async function sendItem(me: string, item: OutboxItem): Promise<void> {
  if (!supabase) return;
  switch (item.kind) {
    case 'invoice': {
      const inv = await getInvoice(item.ref);
      if (!inv) return;
      const { error } = await supabase.from('invoices').upsert({ id: inv.id, owner_id: me, data: inv, deleted: false });
      if (error) throw new Error(error.message);
      return;
    }
    case 'delete_invoice': {
      const { error } = await supabase.from('invoices').upsert({ id: item.ref, owner_id: me, data: {}, deleted: true });
      if (error) throw new Error(error.message);
      return;
    }
    case 'price': {
      const row = await getProductPriceRecord(me, item.ref);
      if (!row) return;
      const { id, owner_id: _o, ...data } = row;
      const { error } = await supabase.from('product_prices').upsert({ id, owner_id: me, data });
      if (error) throw new Error(error.message);
      return;
    }
    case 'profile': {
      const user = await getUserById(me);
      if (!user) return;
      const { error } = await supabase.from('profiles').upsert({ id: me, data: { ...user.profile, phone: user.phone } });
      if (error) throw new Error(error.message);
      return;
    }
    case 'photo': {
      const blob = await getLocalPhotoBlob(`local:${item.ref}`);
      if (!blob) return;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(`${me}/${item.ref}`, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (error) throw new Error(error.message);
      return;
    }
    case 'delete_photo': {
      await supabase.storage.from(PHOTO_BUCKET).remove([`${me}/${item.ref}`]);
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rapatriement (cloud → local)                                        */
/* ------------------------------------------------------------------ */

const LAST_PULL = 'sync.lastPull';

async function pull(): Promise<void> {
  if (!supabase || !owner || !isOnline()) return;
  const me = owner;
  try {
    const since = (await getSetting<string>(me, LAST_PULL)) ?? '1970-01-01T00:00:00Z';
    let newest = since;
    let changed = false;

    const [inv, prices, prof] = await Promise.all([
      supabase.from('invoices').select('id,data,deleted,updated_at').eq('owner_id', me).gt('updated_at', since).order('updated_at'),
      supabase.from('product_prices').select('id,data,updated_at').eq('owner_id', me).gt('updated_at', since).order('updated_at'),
      supabase.from('profiles').select('id,data,updated_at').eq('id', me).gt('updated_at', since).maybeSingle(),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    if (prices.error) throw new Error(prices.error.message);
    if (prof.error) throw new Error(prof.error.message);

    for (const row of (inv.data ?? []) as CloudRow[]) {
      if (await applyRemoteInvoice(row, false)) changed = true;
      if (row.updated_at > newest) newest = row.updated_at;
    }
    for (const row of (prices.data ?? []) as CloudRow[]) {
      if (await applyRemotePrice(row, false)) changed = true;
      if (row.updated_at > newest) newest = row.updated_at;
    }
    if (prof.data) {
      if (await applyRemoteProfile(prof.data as CloudRow, false)) changed = true;
      if (prof.data.updated_at > newest) newest = prof.data.updated_at;
    }
    await putSetting(me, LAST_PULL, newest);
    setState({ status: 'idle', lastSyncAt: new Date().toISOString(), error: undefined });
    if (changed) notifyData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setState({ status: isNetworkError(err) ? 'offline' : 'error', error: msg });
  }
}

/** Vrai si quelque chose a changé localement. */
async function applyRemoteInvoice(row: CloudRow, notify = true): Promise<boolean> {
  if (!row?.id) return false;
  if (row.deleted) {
    const local = await getInvoice(row.id);
    if (!local) return false;
    await withRemote(() => dbDelete(STORES.invoices, row.id));
    await withRemote(() => dbDelete(STORES.photos, (local.photo_path || '').replace('local:', '')));
    if (notify) notifyData();
    return true;
  }
  const remote = row.data as Invoice;
  if (!remote?.id) return false;
  const local = await getInvoice(remote.id);
  if (local && local.updated_at >= remote.updated_at) return false;
  await withRemote(() => putInvoice(remote));
  if (notify) notifyData();
  return true;
}

async function applyRemotePrice(row: CloudRow, notify = true): Promise<boolean> {
  if (!row?.id || !owner) return false;
  const remote = row.data as ProductPrice;
  if (!remote?.product_key) return false;
  const local = await getProductPriceRecord(owner, remote.product_key);
  if (local && local.updated_at >= remote.updated_at) return false;
  await withRemote(() => putProductPrices(owner!, [remote]));
  if (notify) notifyData();
  return true;
}

async function applyRemoteProfile(row: CloudRow, notify = true): Promise<boolean> {
  if (!row?.id || !owner) return false;
  const remote = row.data as Omit<Profile, 'id'> & { phone?: string };
  const user = await getUserById(owner);
  if (!user) return false;
  if (user.profile.updated_at && remote.updated_at && user.profile.updated_at >= remote.updated_at) return false;
  const { phone: _phone, ...profile } = remote;
  await withRemote(() => putUser({ ...user, profile: { ...user.profile, ...profile } }, { sync: false }));
  if (notify) notifyData();
  return true;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

async function downloadPhoto(id: string): Promise<Blob | null> {
  if (!supabase || !owner || !isOnline()) return null;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(`${owner}/${id}`);
  if (error || !data) return null;
  return data;
}

/** Lit le profil cloud d'un utilisateur (après connexion sur un nouvel appareil). */
export async function fetchCloudProfile(userId: string): Promise<(Omit<Profile, 'id'> & { phone?: string }) | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('data').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return data.data as Omit<Profile, 'id'> & { phone?: string };
}

/** Nombre de reçus présents dans le cloud pour cet utilisateur. */
export async function countCloudInvoices(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('deleted', false);
  return error ? 0 : (count ?? 0);
}
