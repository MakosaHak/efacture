import { createWorker, PSM } from 'tesseract.js';
import { isMobileDevice, prepareOcrImage } from './image-utils';
import { parseReceiptText } from './ocr-parser';
import type { OCRResult } from '../../types/invoice';

type Worker = Awaited<ReturnType<typeof createWorker>>;

const PLACEHOLDER = 'Article détecté (à compléter)';

function realItemCount(r: OCRResult): number {
  return r.items.filter((it) => it.product_name !== PLACEHOLDER).length;
}

async function readWith(worker: Worker, image: Blob, psm: PSM): Promise<OCRResult> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    // l'image est déjà mise à l'échelle : évite l'estimation de résolution erronée
    user_defined_dpi: '300',
  });
  const result = await worker.recognize(image);
  const lineTexts = (result.data.lines || [])
    .map((l) => String(l.text || '').trim())
    .filter((t) => t.length > 0);
  const text = lineTexts.length > 0 ? lineTexts.join('\n') : result.data.text;
  return parseReceiptText(text, result.data.confidence / 100);
}

/**
 * OCR d'une photo de facture.
 * 1. Prétraitement (taille 1600-2000 px, gris, contraste).
 * 2. Lecture en bloc (PSM 6) : garde ensemble désignation, quantité, prix et total d'une ligne.
 * 3. Si aucun article n'est reconnu, seconde lecture en colonne (PSM 4) et on garde la meilleure.
 */
export async function runOcrOnFile(
  file: Blob,
  onProgress?: (progress: number) => Promise<void> | void,
): Promise<OCRResult> {
  const mobile = isMobileDevice();
  // Une seule langue sur téléphone : deux modèles doublent la mémoire utilisée.
  const lang = mobile ? 'fra' : 'fra+eng';
  let pass = 0;
  const passes = 2;

  let worker: Worker | null = null;
  try {
    const image = await prepareOcrImage(file);
    worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          void onProgress?.(Math.min(1, (pass + m.progress) / passes));
        }
      },
    });

    const block = await readWith(worker, image, PSM.SINGLE_BLOCK);
    if (realItemCount(block) > 0) return block;

    pass = 1;
    const column = await readWith(worker, image, PSM.SINGLE_COLUMN);
    return realItemCount(column) > realItemCount(block) ? column : block;
  } catch {
    if (mobile) {
      // Mémoire insuffisante sur ce téléphone : la photo est gardée, saisie manuelle.
      return parseReceiptText('', 0);
    }
    throw new Error(
      'Lecture impossible. Réessaie avec une photo plus nette, prise de plus près et bien éclairée.',
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }
  }
}
