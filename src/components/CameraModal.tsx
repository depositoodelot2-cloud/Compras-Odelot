import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Sparkles, Smartphone, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  title?: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Tirar Foto do Produto',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Stop camera tracks helper
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start video stream
  useEffect(() => {
    if (!isOpen || capturedPhoto) {
      stopStream();
      return;
    }

    let isMounted = true;
    setIsLoadingCamera(true);
    setCameraError(null);

    const startCamera = async () => {
      stopStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Seu navegador não suporta streaming direto de câmera. Use a câmera nativa do celular ou selecione uma imagem dos arquivos.'
        );
        setIsLoadingCamera(false);
        return;
      }

      // Check available devices first if enumerateDevices is available
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);

          // If device enumeration explicitly reports 0 video inputs, don't trigger a failing getUserMedia
          if (devices.length > 0 && videoInputs.length === 0) {
            setCameraError(
              'Nenhuma câmera foi encontrada conectada neste dispositivo. Você pode selecionar ou carregar uma foto abaixo.'
            );
            setIsLoadingCamera(false);
            return;
          }
        }
      } catch (enumErr) {
        console.warn('enumerateDevices check skipped:', enumErr);
      }

      try {
        // Try requested facingMode with ideal constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn('Auto-play blocked or interrupted:', e);
          }
        }
        setIsLoadingCamera(false);
      } catch (err: any) {
        console.warn('Could not start camera with ideal constraints, trying generic constraint:', err?.name);

        // Fallback: try generic video constraint
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });

          if (!isMounted) {
            fallbackStream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
          }
          setIsLoadingCamera(false);
        } catch (fallbackErr: any) {
          console.warn('Camera stream could not be started:', fallbackErr?.name || fallbackErr?.message);
          let message = 'Não foi possível acessar a câmera neste dispositivo.';
          const errName = fallbackErr?.name || '';
          const errMsg = String(fallbackErr?.message || '').toLowerCase();

          if (
            errName === 'NotAllowedError' ||
            errName === 'PermissionDeniedError' ||
            errMsg.includes('permission')
          ) {
            message =
              'Permissão de câmera não concedida. Permita o acesso à câmera nas configurações do navegador ou utilize os botões abaixo.';
          } else if (
            errName === 'NotFoundError' ||
            errName === 'DevicesNotFoundError' ||
            errMsg.includes('not found') ||
            errMsg.includes('requested device')
          ) {
            message = 'Nenhuma câmera conectada encontrada neste dispositivo.';
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            message = 'A câmera pode estar em uso por outro aplicativo no dispositivo.';
          }

          setCameraError(message);
          setIsLoadingCamera(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, facingMode, capturedPhoto]);

  // Capture current frame from live stream
  const handleTakePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Flash visual effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontal if front camera
    if (facingMode === 'user') {
      ctx.translate(videoWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    try {
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      // Compress and optimize for storage
      const optimized = await compressImage(rawDataUrl, 1200, 1200, 0.85);
      setCapturedPhoto(optimized);
    } catch (err) {
      console.warn('Error compressing photo:', err);
      const fallback = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(fallback);
    }
  };

  // Flip camera between environment and user
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Confirm and use current photo
  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      handleClose();
    }
  };

  // Retake photo
  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
  };

  // Native camera / file input fallback handler
  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.85);
        setCapturedPhoto(compressed);
      } catch (err) {
        console.warn('Error processing native file:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setCapturedPhoto(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    }
  };

  const handleClose = () => {
    stopStream();
    setCapturedPhoto(null);
    setCameraError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 flex flex-col max-h-[92vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">{title}</h3>
              <p className="text-[10px] text-slate-400">
                {capturedPhoto
                  ? 'Verifique o enquadramento do produto'
                  : cameraError
                  ? 'Escolha uma das opções abaixo'
                  : 'Aponte a câmera para a embalagem ou produto'}
              </p>
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

        {/* Viewfinder / Preview Area */}
        <div className="relative flex-1 min-h-[300px] max-h-[500px] bg-black flex items-center justify-center overflow-hidden">
          {/* Flash animation */}
          {flashActive && (
            <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200 pointer-events-none" />
          )}

          {capturedPhoto ? (
            /* Photo Review Mode */
            <div className="relative w-full h-full flex items-center justify-center bg-black p-2">
              <img
                src={capturedPhoto}
                alt="Foto capturada do produto"
                className="max-w-full max-h-[460px] object-contain rounded-xl"
              />
              <div className="absolute top-4 left-4 bg-emerald-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Foto Pronta
              </div>
            </div>
          ) : cameraError ? (
            /* Error / Permission Blocked / No Camera State */
            <div className="p-6 text-center max-w-sm flex flex-col items-center justify-center text-white">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm mb-1 text-slate-100">Câmera Direta Indisponível</h4>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed">{cameraError}</p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Tirar com Câmera do Celular / Aparelho</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer active:scale-95"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Escolher Foto da Galeria ou Arquivo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {isLoadingCamera && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white gap-2 z-20">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-300">Iniciando câmera...</span>
                </div>
              )}

              {/* Viewfinder Overlay Frame */}
              <div className="absolute inset-4 pointer-events-none border border-white/20 rounded-2xl flex flex-col justify-between p-3">
                {/* Top corners */}
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-tl-lg" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-blue-500 rounded-tr-lg" />
                </div>

                {/* Central guide watermark */}
                <div className="flex items-center justify-center">
                  <div className="bg-black/40 backdrop-blur-xs text-white/80 text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    Enquadre o produto ou embalagem
                  </div>
                </div>

                {/* Bottom corners */}
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-blue-500 rounded-bl-lg" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-blue-500 rounded-br-lg" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Native Camera Input (for system camera capture) */}
        <input
          type="file"
          ref={nativeCameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleNativeFileChange}
          className="hidden"
        />

        {/* Hidden Gallery Input (for files / photo gallery) */}
        <input
          type="file"
          ref={galleryInputRef}
          accept="image/*"
          onChange={handleNativeFileChange}
          className="hidden"
        />

        {/* Bottom Control Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-white shrink-0">
          {capturedPhoto ? (
            /* Review Controls */
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRetakePhoto}
                className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tirar Outra</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Usar Foto</span>
              </button>
            </div>
          ) : cameraError ? (
            /* Fallback Controls when Camera is not available directly */
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Selecione uma imagem ou foto acima</span>
              <button
                type="button"
                onClick={handleClose}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            /* Live Camera Controls */
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                {/* Toggle Camera (Front / Back) */}
                {hasMultipleCameras ? (
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    disabled={isLoadingCamera}
                    className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                    title="Alternar câmera frontal/traseira"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="w-11 h-11" />
                )}

                {/* Big Shutter Button */}
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  disabled={isLoadingCamera}
                  className="w-18 h-18 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center p-1 transition-transform active:scale-95 shadow-xl shadow-blue-500/20 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  title="Capturar Foto"
                >
                  <div className="w-full h-full rounded-full border-3 border-slate-900 bg-blue-600 flex items-center justify-center text-white">
                    <Camera className="w-6 h-6" />
                  </div>
                </button>

                {/* Open native camera app */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Abrir aplicativo de câmera nativo do celular"
                >
                  <Smartphone className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1 border-t border-slate-800/80">
                <span>Dica: Fotos nítidas ajudam na cotação</span>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Câmera nativa do celular
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

