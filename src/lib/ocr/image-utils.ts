const MOBILE_MAX = 720;
const DESKTOP_MAX = 1200;

export function isMobileDevice(): boolean {
  return (
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
  );
}

function drawScaled(source: CanvasImageSource, targetW: number, targetH: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  canvas.getContext('2d')!.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

export function compressFile(file: File, maxPixels?: number): Promise<File> {
  maxPixels = maxPixels ?? (isMobileDevice() ? MOBILE_MAX : DESKTOP_MAX);
  const quality = isMobileDevice() ? 0.68 : 0.82;

  if (file.size < 180_000 && isMobileDevice()) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (!w || !h) {
        resolve(file);
        return;
      }

      let tw = w;
      let th = h;
      let source: CanvasImageSource = img;
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d')!;

      while (Math.max(tw, th) > maxPixels! * 1.5) {
        tw = Math.max(1, Math.round(tw * 0.5));
        th = Math.max(1, Math.round(th * 0.5));
        canvas.width = tw;
        canvas.height = th;
        ctx.drawImage(source, 0, 0, tw, th);
        source = canvas;
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d')!;
      }

      const scale = Math.min(1, maxPixels! / Math.max(tw, th));
      const fw = Math.max(1, Math.round(tw * scale));
      const fh = Math.max(1, Math.round(th * scale));

      const finalCanvas =
        fw === tw && fh === th
          ? (() => {
              canvas.width = fw;
              canvas.height = fh;
              ctx.drawImage(source, 0, 0, fw, fh);
              return canvas;
            })()
          : drawScaled(source, fw, fh);

      finalCanvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], 'facture.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
