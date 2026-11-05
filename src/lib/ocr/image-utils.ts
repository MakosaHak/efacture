const MOBILE_MAX = 560;
const DESKTOP_MAX = 1200;
const MOBILE_QUALITY = 0.58;
const DESKTOP_QUALITY = 0.82;

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

export async function compressFile(file: File, maxPixels?: number): Promise<File> {
  const mobile = isMobileDevice();
  maxPixels = maxPixels ?? (mobile ? MOBILE_MAX : DESKTOP_MAX);
  const quality = mobile ? MOBILE_QUALITY : DESKTOP_QUALITY;

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
