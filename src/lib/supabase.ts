import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  url && key && !url.includes('xxxxxxxx') && !key.includes('xxxxx'),
);

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key',
);

export const DEMO_EMAIL = 'demo@e-facture.app';
export const DEMO_PASSWORD = 'demo-e-facture-2026';

/** Message lisible quand le projet Supabase est en pause / hors ligne. */
export function supabaseError(err: unknown): Error {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return new Error(
      'La base Supabase ne répond pas (projet souvent en pause). Restaure-le sur supabase.com/dashboard, attends 1–2 min, puis réessaie. En attendant, utilise le mode démo.',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}
