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
  Play,
  RotateCcw,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

// Play pleasant confirmation beep on successful barcode scan with throttle to prevent repetitive beeping
let lastBeepTimestamp = 0;
function playScanBeep() {
  const now = Date.now();
  if (now - lastBeepTimestamp < 1500) return; // Prevent repetitive beeps
  lastBeepTimestamp = now;
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

  // Use refs for callbacks so that parent re-renders don't cause scanner restarts
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Synchronous lock ref to block consecutive frames instantly (prevents scan loop)
  const isScanLockedRef = useRef(false);

  // Zoom control for multi-camera phones
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);
  const [minZoom, setMinZoom] = useState<number>(1);
  const [supportsZoom, setSupportsZoom] = useState(false);

  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopScanner = useCallback(async () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (scannerRef.current) {
      const s = scannerRef.current;
      scannerRef.current = null;
      try {
        if (s.isScanning) {
          await s.stop();
        }
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      try {
        s.clear();
      } catch (e) {
        // ignore
      }
    }

    // Stop tracks on all video elements inside the reader element
    const element = document.getElementById(readerElementId);
    if (element) {
      const videos = element.getElementsByTagName('video');
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (v.srcObject && 'getTracks' in (v.srcObject as MediaStream)) {
          (v.srcObject as MediaStream).getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          v.srcObject = null;
        }
      }
    }

    setIsScanning(false);
    setIsPaused(false);
    setTorchOn(false);
    setSupportsZoom(false);
  }, []);

  const handleClose = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    isScanLockedRef.current = true; // Lock while closing
    stopScanner();
    setScannedCode(null);
    setIsPaused(false);
    setManualCode('');
    setShowManualInput(false);
    setShowCameraSelect(false);
    setErrorMessage(null);
    onCloseRef.current();
  }, [stopScanner]);

  const handleSuccessfulScan = useCallback(
    (code: string) => {
      // 1. Instant lock check: if already locked, reject immediately
      if (isScanLockedRef.current) {
        return;
      }

      const cleanCode = code?.trim();
      if (!cleanCode) return;

      // Lock synchronously to prevent consecutive frames from triggering duplicate beeps
      isScanLockedRef.current = true;
      setIsPaused(true);
      setScannedCode(cleanCode);

      // Pause scanner immediately so video freezes and frame decoding stops
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.pause(true);
          }
        } catch (e) {
          console.warn('Could not pause scanner:', e);
        }
      }

      // Single beep and vibration on the first successful scan
      playScanBeep();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(120);
        } catch {}
      }

      // Notify parent component with clean code
      try {
        onScanRef.current(cleanCode);
      } catch (err) {
        console.error('Error in onScan callback:', err);
      }

      // Clear any prior timer
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }

      // Automatically close after a moment (1.2s) if user doesn't click to scan another
      autoCloseTimerRef.current = setTimeout(() => {
        handleClose();
      }, 1200);
    },
    [handleClose]
  );

  // Main camera start procedure with optimizations for modern multi-lens devices
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
        } catch {}
        try {
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      // 2. Initialize Html5Qrcode instance
      const scanner = new Html5Qrcode(readerElementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });

      scannerRef.current = scanner;

      // Scanning configuration: 15 fps
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const w = viewfinderWidth || 300;
          const h = viewfinderHeight || 240;
          const boxWidth = Math.min(Math.floor(w * 0.9), 360);
          const boxHeight = Math.min(Math.floor(h * 0.55), 200);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: undefined,
      };

      const onScanSuccess = (decodedText: string) => {
        handleSuccessfulScan(decodedText);
      };

      const onScanFailure = () => {
        // Normal frame pass
      };

      let started = false;

      // Retrieve all devices
      let devicesList: Array<{ id: string; label: string }> = [];
      try {
        const found = await Html5Qrcode.getCameras();
        if (found && found.length > 0) {
          devicesList = found.map((d, index) => ({
            id: d.id,
            label: d.label || `Câmera ${index + 1}`,
          }));
          setAvailableCameras(devicesList);
          setHasMultipleCameras(devicesList.length > 1);
        }
      } catch (devErr) {
        console.warn('Could not enumerate cameras:', devErr);
      }

      // Priority 1: User explicitly picked a specific camera
      if (selectedCameraId && devicesList.some((d) => d.id === selectedCameraId)) {
        try {
          await scanner.start(selectedCameraId, config, onScanSuccess, onScanFailure);
          started = true;
        } catch (pickErr) {
          console.warn('Starting with selectedCameraId failed, falling back:', pickErr);
        }
      }

      // Priority 2: Smart choice based on device names (choose main 1x rear, skip 0.5x ultra-wide / macro)
      if (!started && devicesList.length > 0) {
        try {
          let chosenId = devicesList[0].id;
          if (facingMode === 'environment') {
            const rearCameras = devicesList.filter((d) =>
              /back|rear|traseira|ambiente|environment/i.test(d.label)
            );

            const standardMainCamera = rearCameras.find((d) => {
              const label = d.label.toLowerCase();
              return (
                !/ultra|0\.[4-6]|macro|tele|depth|wide-angle/i.test(label) &&
                (/main|principal|wide|camera 0|camera 1/i.test(label) || label.includes('0'))
              );
            }) || rearCameras[0] || devicesList[devicesList.length - 1];

            if (standardMainCamera) {
              chosenId = standardMainCamera.id;
            }
          } else {
            const front = devicesList.find((d) => /front|user|frontal/i.test(d.label)) || devicesList[0];
            chosenId = front.id;
          }

          await scanner.start(chosenId, config, onScanSuccess, onScanFailure);
          started = true;
        } catch (autoErr) {
          console.warn('Smart camera start failed:', autoErr);
        }
      }

      // Priority 3: Fallback using facingMode string
      if (!started) {
        try {
          await scanner.start({ facingMode: facingMode }, config, onScanSuccess, onScanFailure);
          started = true;
        } catch (fmErr) {
          console.warn('FacingMode start failed:', fmErr);
        }
      }

      // Priority 4: Ultimate fallback to any available camera
      if (!started && devicesList.length > 0) {
        try {
          await scanner.start(devicesList[0].id, { fps: 15 }, onScanSuccess, onScanFailure);
          started = true;
        } catch (finalErr) {
          console.warn('Ultimate fallback failed:', finalErr);
        }
      }

      if (!started) {
        throw new Error('Não foi possível iniciar nenhuma câmera neste dispositivo.');
      }

      setIsScanning(true);
      setErrorMessage(null);

      // Setup zoom and focus capabilities
      try {
        const capabilities: any = scanner.getRunningTrackCapabilities?.() || {};

        if ('torch' in capabilities) {
          setHasTorch(true);
        }

        if ('zoom' in capabilities) {
          const zMin = capabilities.zoom.min || 1;
          const zMax = Math.min(capabilities.zoom.max || 5, 5);
          setMinZoom(zMin);
          setMaxZoom(zMax);
          setSupportsZoom(zMax > zMin);
          setZoomLevel(zMin);
        }

        // Apply continuous focus
        if ('focusMode' in capabilities && Array.isArray(capabilities.focusMode)) {
          if (capabilities.focusMode.includes('continuous')) {
            try {
              await scanner.applyVideoConstraints({
                advanced: [{ focusMode: 'continuous' } as any],
              });
            } catch {
              // ignore
            }
          }
        }
      } catch (capErr) {
        console.warn('Capabilities error:', capErr);
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
      } else if (
        errName === 'NotReadableError' ||
        errMsg.includes('already in use') ||
        errMsg.includes('could not start video source')
      ) {
        msg =
          'A câmera do aparelho está ocupada ou retida pelo navegador. Clique em "Tentar Novamente" ou em "Recarregar Página".';
      }

      setErrorMessage(msg);
      setIsScanning(false);
    }
  }, [facingMode, handleSuccessfulScan, selectedCameraId]);

  const handleResumeScan = useCallback(async () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    isScanLockedRef.current = false;
    setScannedCode(null);
    setIsPaused(false);

    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
        return;
      } catch (e) {
        console.warn('Resume failed, restarting scanner:', e);
      }
    }
    await startScanner();
  }, [startScanner]);

  const handleApplyZoom = async (newZoom: number) => {
    if (!scannerRef.current || !supportsZoom) return;
    try {
      const clamped = Math.min(Math.max(newZoom, minZoom), maxZoom);
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ zoom: clamped } as any],
      });
      setZoomLevel(clamped);
    } catch (e) {
      console.warn('Failed to apply zoom:', e);
    }
  };

  const handleSelectCamera = (id: string) => {
    setSelectedCameraId(id);
    setShowCameraSelect(false);
  };

  // Lifecycle when modal opens or closes or when user changes camera or retries
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    isScanLockedRef.current = false;
    setScannedCode(null);
    setIsPaused(false);
    setErrorMessage(null);

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode, selectedCameraId, retryCount, startScanner, stopScanner]);

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
    setSelectedCameraId('');
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
    handleSuccessfulScan(manualCode.trim());
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

          <div className="flex items-center gap-2">
            {/* If device has multiple cameras, show camera switcher */}
            {availableCameras.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCameraSelect(!showCameraSelect)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Trocar lente da câmera"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>Trocar Câmera</span>
                </button>

                {showCameraSelect && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1 z-50 text-left">
                    <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                      Selecione a lente:
                    </p>
                    {availableCameras.map((cam, idx) => (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => handleSelectCamera(cam.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          selectedCameraId === cam.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span className="truncate">{cam.label || `Lente ${idx + 1}`}</span>
                        {selectedCameraId === cam.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

          {/* Scanned Success Overlay (Scanner paused immediately on first read) */}
          {scannedCode && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center z-30 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400 mb-1">
                Leitura Concluída! (Pausado)
              </span>
              <p className="text-base sm:text-lg font-mono font-bold text-white bg-slate-800/90 px-4 py-2 rounded-xl border border-slate-700 shadow-inner mb-4 max-w-xs break-all">
                {scannedCode}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeScan}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Ler Outro Código</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border border-slate-700 cursor-pointer"
                >
                  <span>Concluir</span>
                </button>
              </div>
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
                  onClick={() => {
                    setErrorMessage(null);
                    setRetryCount((c) => c + 1);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tentar Abrir Câmera Novamente</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recarregar Página</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-800 cursor-pointer"
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

              <div className="mt-3 px-3 py-1 bg-black/75 backdrop-blur-xs rounded-full border border-white/10 text-white/90 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                <ScanBarcode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Mantenha a cerca de 15 a 20cm ou use o zoom</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for scanning from existing image in gallery */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileScan}
          className="hidden"
        />

        {/* Hidden Camera Photo Input with native OS macro autofocus */}
        <input
          type="file"
          id="native-camera-barcode-input"
          accept="image/*"
          capture="environment"
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Left buttons: Tirar Foto Nítida (Macro) e Galeria */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => document.getElementById('native-camera-barcode-input')?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-blue-500/50"
                  title="Tirar foto com foco automático do celular"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Tirar Foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                  title="Carregar imagem da galeria"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Galeria</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom buttons for modern cameras (1x / 1.5x / 2x / 3x) */}
                {supportsZoom && maxZoom > 1.2 && (
                  <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleApplyZoom(1)}
                      className={`px-2 py-1 text-[11px] font-black rounded-lg transition-colors cursor-pointer ${
                        Math.abs(zoomLevel - 1) < 0.2
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Zoom 1x"
                    >
                      1x
                    </button>
                    {maxZoom >= 1.5 && (
                      <button
                        type="button"
                        onClick={() => handleApplyZoom(1.5)}
                        className={`px-2 py-1 text-[11px] font-black rounded-lg transition-colors cursor-pointer ${
                          Math.abs(zoomLevel - 1.5) < 0.2
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="Zoom 1.5x (Recomendado para foco nítido)"
                      >
                        1.5x
                      </button>
                    )}
                    {maxZoom >= 2 && (
                      <button
                        type="button"
                        onClick={() => handleApplyZoom(2)}
                        className={`px-2 py-1 text-[11px] font-black rounded-lg transition-colors cursor-pointer ${
                          Math.abs(zoomLevel - 2) < 0.2
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="Zoom 2x"
                      >
                        2x
                      </button>
                    )}
                  </div>
                )}

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
