import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, ImagePlus, ScanLine, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { canRunOcr, compressFile, isMobileDevice, ocrMaxSide, OCR_SOURCE_QUALITY } from '../lib/ocr/image-utils';
import { runOcrOnFile } from '../lib/ocr/tesseract-runner';
import { parseReceiptText } from '../lib/ocr/ocr-parser';
import { saveScannedInvoice } from '../lib/invoices';

type Screen = 'idle' | 'camera' | 'preview' | 'loading';

export default function ScannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [screen, setScreen] = useState<Screen>('idle');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');
  const mobile = isMobileDevice();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopStream();
      revokePreview();
    },
    [stopStream, revokePreview],
  );

  const showPreview = (file: File) => {
    revokePreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCapturedFile(file);
    setScreen('preview');
  };

  const handleImport = async (file: File) => {
    setMessage('');
    stopStream();
    setProgress('Préparation de la photo…');
    setScreen('loading');
    await new Promise((r) => setTimeout(r, 50));
    try {
      const optimized = await compressFile(file, ocrMaxSide(), OCR_SOURCE_QUALITY);
      showPreview(optimized);
    } catch {
      setMessage('Photo trop lourde. Choisissez une image plus légère.');
      setScreen('idle');
    }
  };

  const resetToIdle = () => {
    setCapturedFile(null);
    revokePreview();
    setPreviewUrl(null);
    stopStream();
    setScreen('idle');
  };

  const openCamera = async () => {
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Caméra non disponible ici. Importez une photo depuis la galerie.');
      return;
    }
    setScreen('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1920 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setScreen('idle');
      setMessage('Impossible d’ouvrir la caméra. Importez une photo depuis la galerie.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !canvas) return;
    const maxDim = ocrMaxSide();
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage('La capture a échoué. Réessayez.');
          return;
        }
        stopStream();
        canvas.width = 0;
        canvas.height = 0;
        showPreview(new File([blob], 'recu.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      OCR_SOURCE_QUALITY,
    );
  };

  const analyze = async () => {
    if (!capturedFile || !user) return;
    setScreen('loading');
    setProgress('Préparation…');
    const source = capturedFile;
    try {
      revokePreview();
      setPreviewUrl(null);
      let ocr = parseReceiptText('', 0);
      if (canRunOcr()) {
        setProgress('Lecture du reçu…');
        ocr = await runOcrOnFile(source, (p) => setProgress(`Lecture du reçu… ${Math.round(p * 100)} %`));
      }
      setProgress('Enregistrement sur l’appareil…');
      const stored = await compressFile(source, mobile ? 1280 : 1600, 0.8);
      const invoiceId = await saveScannedInvoice(user.id, stored, ocr);
      navigate(`/factures/${invoiceId}/valider`);
    } catch (err) {
      showPreview(source);
      const msg = err instanceof Error ? err.message : 'Enregistrement impossible';
      setMessage(/memor|mémoir|memory|quota/i.test(msg) ? 'Mémoire insuffisante. Importez une photo plus légère.' : msg);
    }
  };

  const iconButton =
    'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20';

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0b0f14] text-white">
      <header className="flex shrink-0 items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <Link to="/" className={iconButton} aria-label="Fermer">
          <X size={20} />
        </Link>
        <p className="text-sm font-semibold">Scanner un reçu</p>
        <button type="button" className={iconButton} onClick={() => fileRef.current?.click()} aria-label="Importer une photo">
          <ImagePlus size={20} />
        </button>
      </header>

      {message && (
        <div className="mx-4 mb-2 rounded-control bg-white/10 px-3 py-2 text-[13px] text-white">{message}</div>
      )}

      {screen === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
            <ScanLine size={36} />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Photographiez le reçu</h2>
          <p className="mb-8 text-sm leading-relaxed text-white/65">
            Posez-le à plat, dans un endroit bien éclairé, et cadrez-le en entier. Les montants seront lus automatiquement.
          </p>
          <Button fullWidth size="lg" onClick={openCamera} className="mb-3 max-w-xs">
            <Camera size={20} />
            Ouvrir la caméra
          </Button>
          <button type="button" className="text-sm font-medium text-white/70 underline-offset-4 hover:underline" onClick={() => fileRef.current?.click()}>
            Importer une photo existante
          </button>
        </div>
      )}

      {screen === 'camera' && (
        <div className="relative flex-1">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 aspect-[3/4] max-h-[70%] -translate-y-1/2 rounded-2xl border-2 border-white/60" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-10 bg-gradient-to-t from-black/70 to-transparent px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-16">
            <button type="button" onClick={resetToIdle} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15" aria-label="Annuler">
              <X size={22} />
            </button>
            <button
              type="button"
              onClick={capture}
              className="h-[72px] w-[72px] rounded-full border-[5px] border-white bg-white/20 transition-transform active:scale-95"
              aria-label="Prendre la photo"
            />
            <button
              type="button"
              onClick={() => {
                stopStream();
                fileRef.current?.click();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15"
              aria-label="Importer une photo"
            >
              <ImagePlus size={22} />
            </button>
          </div>
        </div>
      )}

      {screen === 'preview' && previewUrl && (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <img src={previewUrl} alt="Aperçu du reçu" className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute inset-x-0 bottom-0 flex gap-3 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-12">
            <Button variant="secondary" fullWidth size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={resetToIdle}>
              Reprendre
            </Button>
            <Button fullWidth size="lg" onClick={analyze}>
              {canRunOcr() ? 'Analyser' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="h-10 w-10 rounded-full border-[3px] border-white/20 border-t-white" style={{ animation: 'spin 0.8s linear infinite' }} />
          <p className="text-sm text-white/80">{progress || 'Analyse en cours…'}</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleImport(f);
        }}
      />
    </div>
  );
}
