import { useEffect, useState } from 'react';
import { getPhotoUrl } from '../../lib/invoices';

export function InvoiceThumbnail({ photoPath, size = 48 }: { photoPath: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath) return;
    getPhotoUrl(photoPath).then(setUrl);
  }, [photoPath]);

  if (!url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-[#e8f5ee] text-[#006d41]"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.4} height={size * 0.4} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-xl object-cover"
      style={{ width: size, height: size }}
    />
  );
}
