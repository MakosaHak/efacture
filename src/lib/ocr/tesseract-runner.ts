import { createWorker, PSM } from 'tesseract.js';
import { compressFile, isMobileDevice } from './image-utils';
import { parseReceiptText } from './ocr-parser';
import type { OCRResult } from '../../types/invoice';

export async function runOcrOnFile(
  file: File,
  onProgress?: (progress: number) => Promise<void> | void,
): Promise<OCRResult> {
  const mobile = isMobileDevice();
  // Sur téléphone : image plus petite + une seule langue = beaucoup moins de RAM
  const optimized = await compressFile(file, mobile ? 480 : undefined);
  const lang = mobile ? 'fra' : 'fra+eng';

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          void onProgress?.(m.progress);
        }
      },
    });

    // Une colonne / bloc uniforme : mieux pour tickets et factures tabulées
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
      preserve_interword_spaces: '1',
    });

    const result = await worker.recognize(optimized);
    const confidence = result.data.confidence / 100;
    const lineTexts = (result.data.lines || [])
      .map((l) => String(l.text || '').trim())
      .filter((t) => t.length > 0);
    const text = lineTexts.length > 0 ? lineTexts.join('\n') : result.data.text;
    return parseReceiptText(text, confidence);
  } catch {
    if (mobile) {
      return parseReceiptText('', 0);
    }
    throw new Error(
      'Mémoire insuffisante pour l\'OCR. Réessaie avec une photo plus proche / moins nette, ou importe une image plus légère.',
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
