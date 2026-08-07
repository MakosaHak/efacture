import Tesseract from 'tesseract.js';
import { compressFile, isMobileDevice } from './image-utils';
import { parseReceiptText } from './ocr-parser';
import type { OCRResult } from '../../types/invoice';

export async function runOcrOnFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<OCRResult> {
  const optimized = await compressFile(file);

  try {
    const result = await Tesseract.recognize(optimized, 'fra+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress?.(m.progress);
        }
      },
    });
    const confidence = result.data.confidence / 100;
    return parseReceiptText(result.data.text, confidence);
  } catch {
    if (isMobileDevice()) {
      return parseReceiptText('', 0);
    }
    throw new Error('OCR impossible');
  }
}
