import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import {
  canRunOcr,
  compressFile,
  isMobileDevice,
  ocrMaxSide,
  OCR_SOURCE_QUALITY,
} from '../lib/ocr/image-utils';
import { runOcrOnFile } from '../lib/ocr/tesseract-runner';
import { parseReceiptText } from '../lib/ocr/ocr-parser';
import { saveScannedInvoice } from '../lib/invoices';
import { isOfflineInvoiceId } from '../lib/offline/queue';

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
  const [toast, setToast] = useState('');
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

  useEffect(() => () => {
    stopStream();
    revokePreview();
  }, [stopStream, revokePreview]);

  const showPreview = (file: File) => {
    revokePreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCapturedFile(file);
    setScreen('preview');
  };

  const handleImport = async (file: File) => {
    setToast('');
    stopStream();
    setProgress('Préparation de la photo…');
    setScreen('loading');
    // Laisse le spinner s'afficher avant le décodage (sinon l'UI reste figée).
    await new Promise((r) => setTimeout(r, 50));
    try {
      // Assez de pixels pour que l'OCR lise les chiffres (la photo stockée sera réduite ensuite).
      const optimized = await compressFile(file, ocrMaxSide(), OCR_SOURCE_QUALITY);
      showPreview(optimized);
    } catch {
      setToast('Photo trop lourde. Choisis une image plus légère dans la galerie.');
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

  /** Caméra dans l'app : HD (assez pour l'OCR) sans charger une photo 12 MP en mémoire. */
  const openCamera = async () => {
    setToast('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast('Caméra non disponible. Importe une photo depuis la galerie.');
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
      setToast('Impossible d\'ouvrir la caméra. Utilise « importer une photo ».');
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
          setToast('Capture échouée. Réessaie.');
          return;
        }
        stopStream();
        canvas.width = 0;
        canvas.height = 0;
        showPreview(new File([blob], 'facture.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      OCR_SOURCE_QUALITY,
    );
  };

  const upload = async () => {
    if (!capturedFile || !user) return;
    setScreen('loading');
    setProgress('Préparation…');

    const source = capturedFile;

    try {
      revokePreview();
      setPreviewUrl(null);

      // L'OCR lit la photo haute résolution ; seule une version allégée est stockée.
      let ocr = parseReceiptText('', 0);
      if (canRunOcr()) {
        setProgress('Lecture de la facture…');
        ocr = await runOcrOnFile(source, (p) => {
          setProgress(`Lecture de la facture… ${Math.round(p * 100)} %`);
        });
      }

      setProgress('Enregistrement…');
      const stored = await compressFile(source, mobile ? 1280 : 1600, 0.8);
      const invoiceId = await saveScannedInvoice(user.id, stored, ocr);
      if (isOfflineInvoiceId(invoiceId)) {
        setProgress('Enregistré sur l’appareil…');
      }
      navigate(`/factures/${invoiceId}/valider`, {
        state: { queued: isOfflineInvoiceId(invoiceId) },
      });
    } catch (err) {
      showPreview(source);
      const msg = err instanceof Error ? err.message : 'Erreur d\'envoi';
      setToast(
        /memor|mémoir|memory|quota/i.test(msg)
          ? 'Mémoire insuffisante. Importe une photo plus légère depuis la galerie.'
          : msg,
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0F172A] text-white">
      <header className="relative z-20 flex shrink-0 items-center justify-between px-4 py-3">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          ✕
        </Link>
        <div className="text-center">
          <p className="font-bold">E-Facture</p>
          <p className="text-[10px] tracking-widest text-white/60">SCANNER</p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          onClick={() => fileRef.current?.click()}
        >
          🖼
        </button>
      </header>

      {toast && (
        <div className="mx-4 rounded-lg bg-red-500/90 px-3 py-2 text-sm">{toast}</div>
      )}

      {screen === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-400/40 bg-gradient-to-tr from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-4xl shadow-floating-cam">🧾</div>
          <h2 className="mb-2 text-xl font-bold">Numérisez votre facture</h2>
          <p className="mb-8 text-sm text-white/70">
            Pour une bonne lecture : facture à plat, bien éclairée, sans ombre, et qui remplit l’écran.
          </p>
          <Button fullWidth onClick={openCamera} className="mb-3 max-w-xs">
            Ouvrir la caméra
          </Button>
          <button
            type="button"
            className="text-sm text-white/60 underline"
            onClick={() => fileRef.current?.click()}
          >
            ou importer une photo existante
          </button>
        </div>
      )}

      {screen === 'camera' && (
        <div className="relative flex-1">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8">
            <Link to="/" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              ✕
            </Link>
            <button
              type="button"
              onClick={capture}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/30"
              aria-label="Prendre la photo"
            />
            <button
              type="button"
              onClick={() => {
                stopStream();
                fileRef.current?.click();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20"
            >
              🖼
            </button>
          </div>
        </div>
      )}

      {screen === 'preview' && previewUrl && (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <img
            src={previewUrl}
            alt="Aperçu"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="absolute inset-x-0 bottom-0 z-20 flex gap-3 bg-gradient-to-t from-black via-black/90 to-transparent p-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="secondary"
              fullWidth
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={resetToIdle}
            >
              Changer
            </Button>
            <Button fullWidth onClick={upload}>
              {canRunOcr() ? 'Analyser' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p>{progress || 'Analyse en cours…'}</p>
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
