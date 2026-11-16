/**
 * Lecture du reçu par IA (Gemini) via la fonction serveur /api/ocr.
 * Le client n'a jamais la clé : il envoie la photo et son jeton de connexion.
 */
import type { OCRResult } from '../../types/invoice';
import { isOnline, supabase } from '../supabase';

export const AI_OCR_ENDPOINT = '/api/ocr';
const TIMEOUT_MS = 20_000;

export function aiOcrAvailable(): boolean {
  return isOnline() && (import.meta.env.VITE_AI_OCR ?? 'on') !== 'off';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',', 2)[1] ?? '');
    fr.onerror = () => reject(fr.error ?? new Error('Lecture du fichier impossible'));
    fr.readAsDataURL(blob);
  });
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface AiResponse {
  supplier_name: string;
  invoice_date: string | null;
  total_amount: number;
  items: { product_name: string; quantity: number; unit: string; unit_price: number; total_price: number }[];
  raw_text: string;
  confidence: number;
  model: string;
  error?: string;
}

/** Lance la lecture IA ; lève une erreur si indisponible (l'appelant retombe sur Tesseract). */
export async function runAiOcr(image: Blob): Promise<OCRResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(AI_OCR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ image: await blobToBase64(image), mimeType: image.type || 'image/jpeg' }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as Partial<AiResponse>;
    if (!res.ok || body.error) throw new Error(body.error || `Lecture IA indisponible (${res.status})`);
    return {
      provider: `ia:${body.model ?? 'gemini'}`,
      raw_text: body.raw_text ?? '',
      confidence: typeof body.confidence === 'number' ? body.confidence : 0.85,
      supplier_name: body.supplier_name ?? '',
      invoice_date: body.invoice_date ?? '',
      total_amount: String(body.total_amount ?? 0),
      items: (body.items ?? []).map((it) => ({
        product_name: it.product_name,
        quantity: String(it.quantity),
        unit: it.unit || 'pièce',
        unit_price: String(it.unit_price),
        total_price: String(it.total_price),
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}
