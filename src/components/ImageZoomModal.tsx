import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  badge,
}) => {
  // Default to 3x magnification as requested ("ampliada em 3 vezes")
  const [scale, setScale] = useState<number>(3);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync ref with position
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Reset zoom and pan when modal opens with a new image
  useEffect(() => {
    if (isOpen) {
      setScale(3); // 3x zoom default
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(prev + 0.5, 6));
      } else if (e.key === '-' || e.key === '_') {
        setScale((prev) => Math.max(prev - 0.5, 1));
      } else if (e.key === '0') {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = {
        x: touch.clientX - positionRef.current.x,
        y: touch.clientY - positionRef.current.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Toggle between 1x and 3x zoom on double-click
  const handleDoubleClick = () => {
    if (scale > 1.5) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(3);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    setScale((prev) => Math.min(Math.max(prev + delta, 1), 6));
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 bg-slate-900/80 border-b border-slate-800 text-white shrink-0">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base truncate text-slate-100 max-w-[200px] sm:max-w-md">
              {title}
            </h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/40">
                {badge}
              </span>
            )}
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Ampliada 3x
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setScale((prev) => Math.max(prev - 0.5, 1))}
              disabled={scale <= 1}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Diminuir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Quick 1x / 3x toggle buttons */}
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                scale === 1
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Tamanho normal (1x)"
            >
              1x
            </button>

            <button
              type="button"
              onClick={() => {
                setScale(3);
                setPosition({ x: 0, y: 0 });
              }}
              className={`px-2 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1 ${
                scale === 3
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Ampliar em 3 vezes (3x)"
            >
              3x
            </button>

            <button
              type="button"
              onClick={() => setScale((prev) => Math.min(prev + 0.5, 6))}
              disabled={scale >= 6}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Aumentar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {(position.x !== 0 || position.y !== 0) && (
              <button
                type="button"
                onClick={() => setPosition({ x: 0, y: 0 })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 cursor-pointer transition-colors"
                title="Centralizar imagem"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 hover:border-rose-500 transition-colors cursor-pointer ml-1"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Main Interactive Zoom Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`relative flex-1 w-full h-full overflow-hidden flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
        }`}
      >
        <div
          className="relative transition-transform duration-100 ease-out will-change-transform max-w-full max-h-full flex items-center justify-center p-4"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            className="max-w-[75vw] sm:max-w-[65vw] max-h-[70vh] object-contain rounded-lg shadow-2xl pointer-events-none ring-1 ring-white/10"
          />
        </div>
      </div>

      {/* Bottom Footer Guidance */}
      <div className="relative z-10 px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-slate-400 text-[11px] sm:text-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">
            Zoom atual: {Math.round(scale * 100)}% ({scale}x)
          </span>
          <span className="text-slate-600">•</span>
          <span className="hidden sm:inline">
            Clique duas vezes para alternar 1x / 3x
          </span>
          <span className="sm:hidden">
            Arraste para mover o visor
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
