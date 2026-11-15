const MOBILE_MAX = 560;
const DESKTOP_MAX = 1200;
const MOBILE_QUALITY = 0.58;
const DESKTOP_QUALITY = 0.82;

/**
 * Résolution de l'image envoyée à Tesseract (côté le plus long).
 * Mesuré sur photos de tickets : à 480 px le texte est illisible, à 1200 px les zéros
 * deviennent des lettres ; vers 1600-2000 px la lecture est fiable.
 */
const OCR_MAX_MOBILE = 1600;
const OCR_MAX_DESKTOP = 2000;
/** Qualité JPEG de la photo source gardée pour l'OCR (les artefacts JPEG gênent la lecture). */
export const OCR_SOURCE_QUALITY = 0.9;

export function ocrMaxSide(): number {
  return isMobileDevice() ? OCR_MAX_MOBILE : OCR_MAX_DESKTOP;
}

/** Téléphone très limité en mémoire (≤ 1 Go) : on évite Tesseract, saisie manuelle. */
export function canRunOcr(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return !(isMobileDevice() && typeof mem === 'number' && mem <= 1);
}

export function isMobileDevice(): boolean {
  return (
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
  );
}

function canvasToJpegFile(canvas: HTMLCanvasElement, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Compression impossible'));
          return;
        }
        resolve(new File([blob], 'facture.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Redimensionne sans charger toute la photo en mémoire (meilleur sur téléphone). */
async function compressWithBitmap(file: File, maxPixels: number, quality: number): Promise<File> {
  let bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    if (w !== bitmap.width || h !== bitmap.height) {
      const resized = await createImageBitmap(bitmap, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'medium',
      });
      bitmap.close();
      bitmap = resized;
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const out = await canvasToJpegFile(canvas, quality);
    canvas.width = 0;
    canvas.height = 0;
    return out;
  } catch (err) {
    bitmap.close();
    throw err;
  }
}

function compressWithImageElement(file: File, maxPixels: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxPixels / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          reject(new Error('Canvas indisponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = await canvasToJpegFile(canvas, quality);
        canvas.width = 0;
        canvas.height = 0;
        resolve(out);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };

    img.src = url;
  });
}

/**
 * Prépare l'image pour Tesseract : redimensionnement vers `maxSide` (agrandit aussi les
 * petites photos, jusqu'à ×2), niveaux de gris, étirement du contraste (percentiles 1-99 %).
 * Pas de seuillage binaire : testé, il casse les zéros fins des tickets thermiques.
 */
export async function prepareOcrImage(file: Blob, maxSide = ocrMaxSide()): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(maxSide / longSide, 2);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas indisponible');
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    px[i] = g;
    hist[g]++;
  }
  const n = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < n * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < n * 0.01; hi--);
  const range = Math.max(hi - lo, 1);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((px[i] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('Préparation de l’image impossible');
  return blob;
}

export async function compressFile(file: File, maxPixels?: number, quality?: number): Promise<File> {
  const mobile = isMobileDevice();
  maxPixels = maxPixels ?? (mobile ? MOBILE_MAX : DESKTOP_MAX);
  quality = quality ?? (mobile ? MOBILE_QUALITY : DESKTOP_QUALITY);

  // Toujours recompresser sur mobile : une photo caméra reste souvent trop grande en pixels.
  if (!mobile && file.size < 120_000 && file.type === 'image/jpeg') {
    return file;
  }

  try {
    if (typeof createImageBitmap === 'function') {
      return await compressWithBitmap(file, maxPixels, quality);
    }
    return await compressWithImageElement(file, maxPixels, quality);
  } catch {
    // Dernier essai plus agressif — ne jamais renvoyer la photo originale
    // (une image galerie 12 MP fige l'écran et recouvre les boutons).
    return await compressWithImageElement(file, Math.min(maxPixels, 480), 0.5);
  }
}
