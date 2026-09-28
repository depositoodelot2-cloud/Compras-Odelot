import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Camera,
  MoreVertical,
  Edit3,
  Trash2,
  User,
  Tag,
  MessageSquare,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { ProductItem, Priority, UserProfile } from '../types';
import { getUserColorHex } from '../utils';
import { ImageZoomModal } from './ImageZoomModal';

interface ProductCardProps {
  product: ProductItem;
  onToggleStatus: (id: string) => void;
  onConfirmPurchase?: (product: ProductItem) => void;
  onRequestConfirmPurchase?: (product: ProductItem) => void;
  onEdit: (product: ProductItem) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  users?: UserProfile[];
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onToggleStatus,
  onConfirmPurchase,
  onRequestConfirmPurchase,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelect,
  users,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
  const [showConfirmInline, setShowConfirmInline] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isPurchased = product.status === 'comprado';

  // Find user who added this product
  const matchedUser = users?.find(
    (u) =>
      (product.criadoPor?.id && u.id === product.criadoPor.id) ||
      (product.criadoPor?.nome &&
        u.nome.toLowerCase().trim() === product.criadoPor.nome.toLowerCase().trim())
  );

  const creatorName = matchedUser?.nome || product.criadoPor?.nome || 'Usuário';
  const rawInitial =
    matchedUser?.avatar ||
    product.criadoPor?.avatar ||
    (creatorName ? creatorName.charAt(0) : 'U');
  const creatorInitial = rawInitial.toUpperCase();
  const creatorColor = getUserColorHex(matchedUser?.cor || product.criadoPor?.cor);

  // Close menu and inline confirmation on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowConfirmInline(false);
      }
    };
    if (menuOpen || showConfirmInline) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen, showConfirmInline]);

  // Priority badge styling matching image.png
  const getPriorityStyle = (prioridade: Priority) => {
    switch (prioridade) {
      case 'cotacao':
        return {
          label: 'COTAÇÃO',
          className: 'border border-amber-300 bg-amber-50/90 text-amber-800',
        };
      case 'fixo':
        return {
          label: 'FIXO',
          className: 'border border-blue-300 bg-blue-50/90 text-blue-800',
        };
      case 'novo':
        return {
          label: 'NOVO',
          className: 'border border-emerald-300 bg-emerald-50/90 text-emerald-800',
        };
      case 'urgente':
        return {
          label: 'URGENTE',
          className: 'border border-rose-300 bg-rose-50/90 text-rose-800',
        };
      default:
        return {
          label: 'COTAÇÃO',
          className: 'border border-amber-300 bg-amber-50/90 text-amber-800',
        };
    }
  };

  const pStyle = getPriorityStyle(product.prioridade);

  return (
    <div
      ref={cardRef}
      className={`w-full relative bg-white rounded-xl border transition-all py-2 px-3 sm:py-2.5 sm:px-3.5 flex items-center gap-2.5 sm:gap-3 shadow-2xs hover:shadow-xs ${
        isPurchased
          ? 'bg-slate-50/75 border-slate-200 opacity-80'
          : 'border-slate-200/90 hover:border-blue-300'
      } ${isSelected || showConfirmInline ? 'ring-2 ring-emerald-500/70 border-emerald-500' : ''}`}
    >
      {/* 1. Left Checkbox + Botão de confirmação na frente */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isPurchased) {
              onToggleStatus(product.id);
            } else {
              setShowConfirmInline(!showConfirmInline);
            }
          }}
          className={`w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
            isPurchased || isSelected || showConfirmInline
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
              : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 bg-white text-transparent'
          }`}
          title={isPurchased ? 'Comprado' : 'Marcar como comprado'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>

        {/* Botão de confirmação na frente do checkbox */}
        {showConfirmInline && !isPurchased && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirmInline(false);
              if (onConfirmPurchase) {
                onConfirmPurchase(product);
              } else if (onRequestConfirmPurchase) {
                onRequestConfirmPurchase(product);
              } else {
                onToggleStatus(product.id);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 animate-in fade-in slide-in-from-left-2 duration-150"
            title="Confirmar compra deste produto"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Sim, já foi comprado</span>
          </button>
        )}
      </div>

      {/* 2. Photo square with 3x zoom on click */}
      <div
        onClick={() => {
          if (product.fotoUrl) {
            setIsPhotoZoomed(true);
          }
        }}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center shrink-0 overflow-hidden relative group transition-colors ${
          product.fotoUrl
            ? 'cursor-zoom-in hover:border-blue-400 bg-slate-50'
            : 'cursor-default bg-slate-50/50'
        }`}
        title={
          product.fotoUrl
            ? 'Clique na foto para ampliar em 3 vezes (3x)'
            : 'Sem foto cadastrada (para editar ou adicionar foto, use os 3 pontinhos)'
        }
      >
        {product.fotoUrl ? (
          <>
            <img
              src={product.fotoUrl}
              alt={product.nome}
              className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
              <ZoomIn className="w-3.5 h-3.5 text-white drop-shadow-sm" />
            </div>
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 text-slate-400 stroke-[1.8]" />
            <span className="text-[9px] font-semibold text-slate-400 leading-none mt-0.5">
              Foto
            </span>
          </>
        )}
      </div>

      {/* 3. Center Content */}
      <div className="min-w-0 flex-1">
        {/* Product Title */}
        <h3
          className={`font-bold text-xs sm:text-sm leading-tight tracking-tight truncate ${
            isPurchased ? 'line-through text-slate-400' : 'text-slate-900'
          }`}
          title={product.nome}
        >
          {product.nome}
        </h3>

        {/* Priority Badge + User Initial Circle + Blue Quantity + Unit */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {/* Priority Badge */}
          <span
            className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide leading-none ${pStyle.className}`}
          >
            {pStyle.label}
          </span>

          {/* User Initial Circle with User Color */}
          <span
            style={{
              borderColor: creatorColor,
              color: creatorColor,
              backgroundColor: `${creatorColor}15`,
            }}
            className="w-4.5 h-4.5 rounded-full border-[1.5px] font-black text-[9.5px] flex items-center justify-center shrink-0 leading-none shadow-2xs select-none transition-transform hover:scale-110"
            title={`Adicionado por: ${creatorName}`}
          >
            {creatorInitial}
          </span>

          {/* Quantity in Bold Blue */}
          <span className="text-blue-600 font-extrabold text-xs sm:text-sm leading-none">
            {product.quantidade}
          </span>
        </div>
      </div>

      {/* 4. 3-dots Menu Icon on the right */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          title="Opções do produto"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown Action Menu */}
        {menuOpen && (
          <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit(product);
              }}
              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Editar Produto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (!isPurchased) {
                  setShowConfirmInline(true);
                } else {
                  onToggleStatus(product.id);
                }
              }}
              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isPurchased ? 'Marcar como Pendente' : 'Marcar como Comprado'}</span>
            </button>

            {product.observacao && (
              <div className="px-3 py-1.5 border-t border-slate-100 text-[10px] text-slate-500 italic">
                "{product.observacao}"
              </div>
            )}

            {product.criadoPor?.nome && (
              <div className="px-3 py-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>Por: {product.criadoPor.nome}</span>
              </div>
            )}

            <div className="border-t border-slate-100 my-1"></div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete(product.id);
              }}
              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Excluir Produto</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. 3x Zoom Image Modal Lightbox */}
      {product.fotoUrl && (
        <ImageZoomModal
          isOpen={isPhotoZoomed}
          onClose={() => setIsPhotoZoomed(false)}
          imageUrl={product.fotoUrl}
          title={product.nome}
          subtitle={`Prioridade: ${pStyle.label} • Quantidade: ${product.quantidade}`}
          badge={pStyle.label}
        />
      )}
    </div>
  );
};

interface EmptyStateProps {
  onOpenCatalog: () => void;
  onOpenNewProduct: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenCatalog,
  onOpenNewProduct,
}) => {
  return (
    <div className="px-4 py-12 text-center flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
        <Camera className="w-8 h-8 text-blue-500" />
      </div>
      <h3 className="text-base font-black text-slate-800">
        Nenhum produto nesta lista
      </h3>
      <p className="text-xs text-slate-500 max-w-xs mt-1">
        Adicione produtos com fotos, prioridade (Fixo, Novo, Cotação, Urgente) ou importe da base.
      </p>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onOpenCatalog}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          Base de Produtos
        </button>
        <button
          onClick={onOpenNewProduct}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
        >
          + Adicionar Produto
        </button>
      </div>
    </div>
  );
};
