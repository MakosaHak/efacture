import { useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { getPhotoUrl } from '../../lib/invoices';

/** Vignette de la photo du reçu, lue depuis le stockage local. */
export function InvoiceThumbnail({ photoPath, size = 48 }: { photoPath: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    if (!photoPath) return;
    getPhotoUrl(photoPath).then((next) => {
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      blobUrl = next;
      setUrl(next);
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoPath]);

  if (!url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface-2 text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <ReceiptText size={Math.round(size * 0.42)} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-[10px] border border-line bg-surface-2 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** Grande image du reçu (page détail / validation). */
export function InvoicePhoto({ photoPath, className = '' }: { photoPath: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    if (!photoPath) return;
    getPhotoUrl(photoPath).then((next) => {
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      blobUrl = next;
      setUrl(next);
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoPath]);

  if (!url) {
    return (
      <div className={`flex h-48 items-center justify-center rounded-card border border-line bg-surface-2 text-muted ${className}`}>
        <ReceiptText size={32} />
      </div>
    );
  }
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface-2 ${className}`}>
      <img src={url} alt="Photo du reçu" className="max-h-80 w-full object-contain" />
    </div>
  );
}
