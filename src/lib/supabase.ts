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
