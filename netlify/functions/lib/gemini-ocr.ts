/**
 * Lecture d'un reçu par Gemini (API Google AI). Code partagé entre la
 * fonction Netlify (production) et le serveur de développement Vite.
 *
 * Entrée : image en base64 + type MIME. Sortie : structure prête pour
 * l'application (fournisseur, date, total, lignes).
 */

export interface AiOcrItem {
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface AiOcrResult {
  supplier_name: string;
  invoice_date: string | null;
  total_amount: number;
  items: AiOcrItem[];
  raw_text: string;
  confidence: number;
  model: string;
}

// Les modèles « lite » répondent en quelques secondes ; les modèles standard « réfléchissent » trop longtemps pour une fonction serveur.
const DEFAULT_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

const PROMPT = `Tu lis une facture ou un ticket de caisse d'un commerce au Togo (montants en francs CFA, photo parfois manuscrite ou de travers).
Réponds UNIQUEMENT avec un objet JSON, sans commentaire, de la forme :
{
  "supplier_name": "nom du vendeur ou du magasin, chaîne vide si absent",
  "invoice_date": "AAAA-MM-JJ ou null si absente",
  "total_amount": nombre entier en FCFA (le total à payer, TTC si indiqué),
  "items": [
    { "product_name": "désignation", "quantity": nombre, "unit": "pièce|sac|carton|kg|L|paquet|bidon|boîte", "unit_price": nombre, "total_price": nombre }
  ],
  "raw_text": "le texte lu, ligne par ligne",
  "confidence": nombre entre 0 et 1 (ta certitude globale)
}
Règles : une ligne par article réellement acheté ; si la quantité manque, déduis-la du total divisé par le prix unitaire, sinon 1 ; ignore les lignes de taxe, sous-total, remise, client, paiement ; montants sans séparateur de milliers ; ne jamais inventer d'article.`;

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Réponse IA sans JSON');
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function normalize(raw: Record<string, unknown>, model: string): AiOcrResult {
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  const out: AiOcrItem[] = items
    .map((it) => {
      const quantity = Math.max(0, num(it.quantity)) || 1;
      const unit_price = Math.max(0, num(it.unit_price));
      let total_price = Math.max(0, num(it.total_price));
      if (!total_price && unit_price) total_price = unit_price * quantity;
      return {
        product_name: String(it.product_name ?? '').trim().slice(0, 120),
        quantity,
        unit: String(it.unit ?? 'pièce').trim() || 'pièce',
        unit_price: unit_price || (quantity ? total_price / quantity : 0),
        total_price,
      };
    })
    .filter((it) => it.product_name && it.total_price > 0)
    .slice(0, 60);

  let invoice_date: string | null = null;
  const d = String(raw.invoice_date ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) invoice_date = d;

  let total_amount = Math.round(num(raw.total_amount));
  if (!total_amount && out.length) total_amount = Math.round(out.reduce((s, it) => s + it.total_price, 0));

  return {
    supplier_name: String(raw.supplier_name ?? '').trim().slice(0, 120),
    invoice_date,
    total_amount,
    items: out,
    raw_text: String(raw.raw_text ?? '').slice(0, 6000),
    confidence: Math.min(1, Math.max(0, num(raw.confidence) || 0.8)),
    model,
  };
}

export async function readReceiptWithGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  preferredModel?: string,
): Promise<AiOcrResult> {
  const models = [...new Set([preferredModel, ...DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
  let lastError = 'Modèle indisponible';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });

    if (res.status === 404) {
      lastError = `Modèle ${model} introuvable`;
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
    if (!res.ok) {
      if (res.status === 429) throw new Error('Quota IA atteint pour aujourd’hui.');
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Réponse IA vide');
    return normalize(parseJson(text), model);
  }
  throw new Error(lastError);
}

/** Vérifie que l'appelant est une utilisatrice connectée à Supabase (évite l'usage anonyme du quota). */
export async function verifySupabaseUser(authorization: string | null, supabaseUrl: string, anonKey: string): Promise<boolean> {
  if (!authorization?.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface OcrRequestBody {
  image: string;
  mimeType?: string;
}

/** Traitement commun : lit le corps, vérifie, appelle Gemini. Renvoie { status, body }. */
export async function handleOcrRequest(
  body: OcrRequestBody | null,
  authorization: string | null,
  env: Record<string, string | undefined>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return { status: 503, body: { error: 'Lecture IA non configurée (GEMINI_API_KEY manquante).' } };
  if (!body?.image) return { status: 400, body: { error: 'Image manquante.' } };
  if (body.image.length > 8_000_000) return { status: 413, body: { error: 'Image trop lourde.' } };

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    const ok = await verifySupabaseUser(authorization, supabaseUrl, anonKey);
    if (!ok) return { status: 401, body: { error: 'Connexion requise.' } };
  }

  try {
    const result = await readReceiptWithGemini(body.image, body.mimeType || 'image/jpeg', apiKey, env.GEMINI_MODEL);
    return { status: 200, body: result as unknown as Record<string, unknown> };
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : 'Lecture IA impossible.' } };
  }
}
