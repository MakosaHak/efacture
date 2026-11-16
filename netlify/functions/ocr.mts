import type { Config } from '@netlify/functions';
import { handleOcrRequest, type OcrRequestBody } from './lib/gemini-ocr';

/**
 * POST /api/ocr  { image: <base64>, mimeType }
 * Relaie la photo du reçu à Gemini avec la clé gardée côté serveur.
 */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  let body: OcrRequestBody | null = null;
  try {
    body = (await req.json()) as OcrRequestBody;
  } catch {
    body = null;
  }
  const { status, body: out } = await handleOcrRequest(body, req.headers.get('authorization'), process.env);
  return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
};

export const config: Config = { path: '/api/ocr' };
