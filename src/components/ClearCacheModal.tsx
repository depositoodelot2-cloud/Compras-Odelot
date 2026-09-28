import React, { useState } from 'react';
import { Trash2, AlertTriangle, RefreshCw, CheckCircle, X, Sparkles } from 'lucide-react';

interface ClearCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearProducts: () => Promise<void>;
  onClearAll: () => Promise<void>;
  totalProductsCount: number;
}

export const ClearCacheModal: React.FC<ClearCacheModalProps> = ({
  isOpen,
  onClose,
  onClearProducts,
  onClearAll,
  totalProductsCount,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (action: 'products' | 'all') => {
    setIsProcessing(true);
    try {
      if (action === 'products') {
        await onClearProducts();
        setSuccessMessage('Todos os produtos foram removidos e o cache foi limpo com sucesso! A tela está pronta para os novos produtos.');
      } else {
        await onClearAll();
        setSuccessMessage('Todo o cache do sistema foi limpo com sucesso! Reiniciando...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Limpar Cache & Produtos</h2>
              <p className="text-xs text-slate-500">Iniciar com lista e produtos limpos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {successMessage ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-medium">
                {successMessage}
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Escolha o que deseja limpar:</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Atualmente há <strong className="text-slate-900">{totalProductsCount} produto(s)</strong> no sistema. Você pode esvaziar os produtos para cadastrar a nova lista limpa, mantendo suas listas e fornecedores salvos.
                </p>
              </div>

              {/* Option 1: Clean Products (Recommended) */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/30 hover:border-emerald-500 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-emerald-600" />
                    Limpar Todos os Produtos (Recomendado)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                    Mais Seguro
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Remove todos os produtos e cotações antigas. Mantém intactos seus fornecedores, usuários e listas cadastradas.
                </p>
                <button
                  disabled={isProcessing}
                  onClick={() => handleAction('products')}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Zerar Produtos e Iniciar Nova Lista</span>
                </button>
              </div>

              {/* Option 2: Full System Cache Reset */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:border-slate-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    Reset Total do Sistema
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                    Geral
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Limpa todo o localStorage do navegador e redefine todo o banco do servidor para o estado inicial limpo.
                </p>
                <button
                  disabled={isProcessing}
                  onClick={() => handleAction('all')}
                  className="w-full mt-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-slate-600" />
                  )}
                  <span>Limpar Todo o Cache do Navegador</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {successMessage ? 'Concluir' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
};
