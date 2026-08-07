import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { compressFile, isMobileDevice } from '../lib/ocr/image-utils';
import { runOcrOnFile } from '../lib/ocr/tesseract-runner';
import { saveScannedInvoice } from '../lib/invoices';

type Screen = 'idle' | 'camera' | 'preview' | 'loading';

export default function ScannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [screen, setScreen] = useState<Screen>('idle');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [progress, setProgress] = useState('');

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
    setToast('Préparation de l\'image…');
    stopStream();
    try {
      const optimized = await compressFile(file);
      showPreview(optimized);
      setToast('');
    } catch {
      showPreview(file);
      setToast('');
    }
  };

  const openCamera = async () => {
    setToast('');
    if (isMobileDevice() || !navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
      return;
    }
    setScreen('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      cameraRef.current?.click();
      setScreen('idle');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !canvas) return;

    const maxDim = isMobileDevice() ? 960 : 1400;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        showPreview(new File([blob], 'facture.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      isMobileDevice() ? 0.72 : 0.88,
    );
  };

  const upload = async () => {
    if (!capturedFile || !user) return;
    setScreen('loading');
    setProgress('Lecture OCR…');

    try {
      const ocr = await runOcrOnFile(capturedFile, (p) => {
        setProgress(`Lecture OCR… ${Math.round(p * 100)}%`);
      });
      setProgress('Enregistrement…');
      const invoiceId = await saveScannedInvoice(user.id, capturedFile, ocr);
      navigate(`/factures/${invoiceId}/valider`);
    } catch (err) {
      setScreen('preview');
      setToast(err instanceof Error ? err.message : 'Erreur d\'envoi');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0b] text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          ✕
        </Link>
        <div className="text-center">
          <p className="font-bold">E-Facture</p>
          <p className="text-[10px] tracking-widest text-white/60">SCANNER</p>
        </div>
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" onClick={() => fileRef.current?.click()}>
          🖼
        </button>
      </header>

      {toast && (
        <div className="mx-4 rounded-lg bg-red-500/90 px-3 py-2 text-sm">{toast}</div>
      )}

      {screen === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#006d41] text-4xl">🧾</div>
          <h2 className="mb-2 text-xl font-bold">Numérisez votre facture</h2>
          <p className="mb-8 text-sm text-white/70">
            Photo légère → OCR Tesseract.js (gratuit) dans le navigateur
          </p>
          <Button fullWidth onClick={openCamera} className="mb-3 max-w-xs">
            Ouvrir la caméra
          </Button>
          <button type="button" className="text-sm text-white/60 underline" onClick={() => fileRef.current?.click()}>
            ou importer une photo existante
          </button>
        </div>
      )}

      {screen === 'camera' && (
        <div className="relative flex-1">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8">
            <Link to="/" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">✕</Link>
            <button type="button" onClick={capture} className="h-16 w-16 rounded-full border-4 border-white bg-white/30" />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">🖼</button>
          </div>
        </div>
      )}

      {screen === 'preview' && previewUrl && (
        <div className="flex flex-1 flex-col">
          <img src={previewUrl} alt="Aperçu" className="flex-1 object-contain" />
          <div className="flex gap-3 p-4">
            <Button variant="secondary" fullWidth onClick={() => { setCapturedFile(null); revokePreview(); setPreviewUrl(null); openCamera(); }}>
              Reprendre
            </Button>
            <Button fullWidth onClick={upload}>Analyser</Button>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
          <p>{progress || 'Analyse en cours…'}</p>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
    </div>
  );
}
