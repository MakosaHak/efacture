import { useEffect, useState } from 'react';
import { getPhotoUrl } from '../../lib/invoices';

/** Photo de profil lue depuis le stockage local, avec repli sur l'initiale. */
export function Avatar({ path, name, size = 48, className = '' }: { path?: string; name?: string; size?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    setUrl(null);
    if (!path) return;
    getPhotoUrl(path).then((next) => {
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
  }, [path]);

  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (url) {
    return <img src={url} alt="" className={`shrink-0 rounded-full border border-line object-cover ${className}`} style={style} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-ink ${className}`} style={style} aria-hidden>
      {initial}
    </div>
  );
}
