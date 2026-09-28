import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ScanBarcode,
  X,
  RefreshCw,
  AlertCircle,
  Check,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Keyboard,
  ArrowRight,
  Camera,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

// Play pleasant confirmation beep on successful barcode scan
function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // audio may be blocked or not permitted
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Leitor de Código de Barras',
  subtitle = 'Aponte a câmera diretamente para o código de barras',
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readerElementId = 'html5-barcode-scanner-viewport';

  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
  }, []);

  const handleSuccessfulScan = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      playScanBeep();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(120);
      }

      setScannedCode(cleanCode);
      stopScanner();

      // Give visual feedback then return the scanned code
      setTimeout(() => {
        onScan(cleanCode);
        handleClose();
      }, 450);
    },
    [onScan, stopScanner]
  );

  const handleClose = () => {
    stopScanner();
    setScannedCode(null);
    setManualCode('');
    setShowManualInput(false);
    setErrorMessage(null);
    onClose();
  };

  // Main camera start procedure
  const startScanner = useCallback(async () => {
    setErrorMessage(null);
    setScannedCode(null);

    // Wait slightly for DOM to mount
    await new Promise((resolve) => setTimeout(resolve, 150));

    const element = document.getElementById(readerElementId);
    if (!element) return;

    try {
      // 1. Cleanup any previous scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }

      // 2. Request user media explicitly first to prompt browser permission if needed
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
          });
          // Release immediately once permission is verified
          testStream.getTracks().forEach((track) => track.stop());
        }
      } catch (permErr: any) {
        console.warn('Initial permission check note:', permErr);
      }

      // 3. Initialize Html5Qrcode instance
      const scanner = new Html5Qrcode(readerElementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
      });

      scannerRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const w = Math.max(viewfinderWidth || 300, 200);
          const h = Math.max(viewfinderHeight || 240, 160);
          const boxWidth = Math.min(Math.floor(w * 0.88), 340);
          const boxHeight = Math.min(Math.floor(h * 0.48), 180);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.0,
      };

      const onScanSuccess = (decodedText: string) => {
        handleSuccessfulScan(decodedText);
      };

      const onScanFailure = () => {
        // Normal during frame scan
      };

      let started = false;

      // Strategy A: Enumerate camera devices and pick rear/environment camera
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setHasMultipleCameras(devices.length > 1);
          // Look for rear camera
          const rearCam = devices.find((d) =>
            /back|rear|traseira|ambiente|environment/i.test(d.label)
          );
          const chosenCameraId =
            facingMode === 'environment'
              ? rearCam
                ? rearCam.id
                : devices[devices.length - 1].id
              : devices[0].id;

          await scanner.start(chosenCameraId, config, onScanSuccess, onScanFailure);
          started = true;
        }
      } catch (devErr) {
        console.warn('Starting with cameraId failed, falling back to facingMode:', devErr);
      }

      // Strategy B: Start with facingMode string ('environment' or 'user')
      if (!started) {
        try {
          await scanner.start({ facingMode: facingMode }, config, onScanSuccess, onScanFailure);
          started = true;
        } catch (fmErr) {
          console.warn('Starting with facingMode failed:', fmErr);
        }
      }

      // Strategy C: Fallback to any user camera
      if (!started) {
        await scanner.start({ facingMode: 'user' }, config, onScanSuccess, onScanFailure);
        started = true;
      }

      setIsScanning(true);
      setErrorMessage(null);

      // Check torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities?.();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Scanner error:', err);
      let msg = 'Não foi possível acessar a câmera para ler o código de barras.';
      const errName = err?.name || '';
      const errMsg = String(err?.message || '').toLowerCase();

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('permission')
      ) {
        msg =
          'Permissão de câmera não concedida. Por favor, permita o acesso à câmera nas configurações do seu navegador para ler o código.';
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('not found') ||
        errMsg.includes('requested device')
      ) {
        msg = 'Nenhuma câmera encontrada conectada neste dispositivo.';
      }

      setErrorMessage(msg);
      setIsScanning(false);
    }
  }, [facingMode, handleSuccessfulScan]);

  // Lifecycle when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode, retryCount, startScanner, stopScanner]);

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Failed to toggle torch:', e);
    }
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Decode from file/gallery without taking a photo
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileScanner = new Html5Qrcode('barcode-file-hidden-reader', {
        verbose: false,
      });
      const decodedResult = await fileScanner.scanFile(file, true);
      fileScanner.clear();
      if (decodedResult) {
        handleSuccessfulScan(decodedResult);
      }
    } catch (err: any) {
      console.warn('Barcode not found in image:', err);
      alert('Não foi possível identificar um código de barras nesta imagem.');
    } finally {
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim());
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-slate-800 text-white z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">{title}</h3>
              <p className="text-[10px] text-slate-400">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport / Live Camera Scanning Area */}
        <div className="relative flex-1 min-h-[320px] max-h-[460px] bg-black flex items-center justify-center overflow-hidden">
          {/* HTML5 QR/Barcode Video Mount */}
          <div
            id={readerElementId}
            className={`w-full h-full min-h-[320px] flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover ${
              scannedCode ? 'opacity-40' : ''
            }`}
          />

          {/* Hidden helper for file decoding */}
          <div id="barcode-file-hidden-reader" className="hidden" />

          {/* Scanned Success Overlay */}
          {scannedCode && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center z-30 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30 animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400 mb-1">
                Código Lido com Sucesso!
              </span>
              <p className="text-lg font-mono font-bold text-white bg-slate-800/90 px-4 py-2 rounded-xl border border-slate-700 shadow-inner">
                {scannedCode}
              </p>
            </div>
          )}

          {/* Error / Fallback State */}
          {errorMessage && !scannedCode && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-white z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm mb-1 text-slate-100">Câmera Indisponível</h4>
              <p className="text-xs text-slate-300 mb-5 max-w-xs leading-relaxed">{errorMessage}</p>

              <div className="w-full max-w-xs flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setRetryCount((c) => c + 1)}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tentar Abrir Câmera Novamente</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Digitar Código Manualmente</span>
                </button>
              </div>
            </div>
          )}

          {/* Custom Overlay with Scanning Laser Animation when active */}
          {isScanning && !scannedCode && !errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Dimmed surrounding mask */}
              <div className="relative w-[85%] max-w-[320px] h-[160px] border-2 border-blue-400/80 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* 4 Glowing Corners */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-blue-400 rounded-tl-md" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-blue-400 rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-blue-400 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-blue-400 rounded-br-md" />

                {/* Animated Red Laser Line */}
                <div className="absolute left-2 right-2 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse top-1/2 -translate-y-1/2" />
              </div>

              <div className="mt-4 px-3 py-1 bg-black/60 backdrop-blur-xs rounded-full border border-white/10 text-white/90 text-[11px] font-semibold flex items-center gap-1.5">
                <ScanBarcode className="w-3.5 h-3.5 text-blue-400" />
                Posicione o código de barras dentro do quadro
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for scanning from existing image in gallery (without opening camera photo mode) */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileScan}
          className="hidden"
        />

        {/* Bottom Bar: Controls & Manual Fallback */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 text-white shrink-0">
          {showManualInput ? (
            /* Manual Input Form */
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-300">
                Digite o número do código de barras:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ex: 7891000100103"
                  className="flex-1 px-3 py-2 bg-slate-800 rounded-xl border border-slate-700 text-white text-sm font-mono placeholder-slate-500 outline-hidden focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>OK</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 self-center underline cursor-pointer mt-1"
              >
                Voltar para a câmera ao vivo
              </button>
            </form>
          ) : (
            /* Camera Quick Controls */
            <div className="flex items-center justify-between">
              {/* Upload image button from files */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                title="Carregar imagem da galeria"
              >
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span>Arquivo/Galeria</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Torch toggle if available */}
                {hasTorch && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                      torchOn
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title={torchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
                  >
                    {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}

                {/* Flip camera if multiple cameras */}
                {hasMultipleCameras && (
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border border-slate-700 cursor-pointer"
                    title="Alternar Câmera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}

                {/* Manual Type button */}
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                  title="Digitar código manualmente"
                >
                  <Keyboard className="w-4 h-4 text-slate-400" />
                  <span>Digitar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
