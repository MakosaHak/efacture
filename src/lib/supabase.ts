import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Client Supabase, présent seulement si les deux variables d'environnement
 * sont renseignées. Sans lui, l'application reste 100 % locale.
 */
export const supabase: SupabaseClient | null = url && key && !url.includes('xxxx') ? createClient(url, key) : null;

export const cloudEnabled = supabase !== null;

/** Bucket privé où sont rangées les photos (reçus et profils). */
export const PHOTO_BUCKET = 'receipt-photos';

/** Domaine interne : le téléphone sert d'identifiant, Supabase veut un e-mail. */
export const PHONE_EMAIL_DOMAIN = 'phone.e-facture.app';

export function phoneToEmail(digits: string): string {
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|offline|timeout|load failed|ERR_|connexion|connection/i.test(msg);
}
