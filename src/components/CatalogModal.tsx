import React, { useState } from 'react';
import {
  X,
  Search,
  Plus,
  PackageCheck,
  Check,
  Camera,
  MoreVertical,
  Tag,
  Sparkles,
  ZoomIn,
  ScanBarcode,
} from 'lucide-react';
import { CatalogProduct, Priority, PurchaseList, UserProfile } from '../types';
import { getUserColorHex } from '../utils';
import { ImageZoomModal } from './ImageZoomModal';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogProduct[];
  activeList: PurchaseList;
  currentUser: UserProfile;
  onAddFromCatalog: (
    item: CatalogProduct,
    quantidade: number,
    prioridade: Priority
  ) => void;
  onSaveToCatalog: (item: Omit<CatalogProduct, 'id'>) => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  catalog,
  activeList,
  currentUser,
  onAddFromCatalog,
  onSaveToCatalog,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaMarca, setNovaMarca] = useState(activeList.fabrica || '');
  const [novaUnidade, setNovaUnidade] = useState('UN');
  const [novaPrioridade, setNovaPrioridade] = useState<Priority>('cotacao');
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});
  const [zoomedCatalogProduct, setZoomedCatalogProduct] = useState<CatalogProduct | null>(null);

  if (!isOpen) return null;

  const filtered = catalog.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.marcaPadrao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fabricaSugerida.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQuickAdd = (item: CatalogProduct) => {
    onAddFromCatalog(item, 1, item.prioridadePadrao || 'cotacao');
    setAddedItemIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [item.id]: false }));
    }, 1500);
  };

  const handleCreateCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    onSaveToCatalog({
      nome: novoNome.trim(),
      marcaPadrao: novaMarca.trim() || activeList.fabrica || 'Geral',
      unidadePadrao: novaUnidade,
      fabricaSugerida: novaMarca.trim() || activeList.fabrica || 'Geral',
      prioridadePadrao: novaPrioridade,
    });

    setNovoNome('');
    setShowAddForm(false);
  };

  // Badge styling matching image.png
  const getPriorityStyle = (prioridade: Priority = 'cotacao') => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-600" />
              <span>Base de Produtos / Catálogo</span>
            </h2>
            <p className="text-xs text-slate-500">
              Adicione itens frequentes à lista <strong>{activeList.nome}</strong> com 1 clique
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar no catálogo..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100 focus:bg-white rounded-2xl text-xs font-semibold border border-transparent focus:border-blue-400 outline-hidden transition-all"
              />
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Fechar' : 'Novo Item Base'}</span>
            </button>
          </div>

          {/* New Catalog Form */}
          {showAddForm && (
            <form onSubmit={handleCreateCatalogItem} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <p className="text-xs font-extrabold uppercase text-slate-600">
                Cadastrar Item na Base Permanente
              </p>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Nome do produto padrão..."
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Marca padrão (ex: Tigre)"
                  value={novaMarca}
                  onChange={(e) => setNovaMarca(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                />
                <select
                  value={novaPrioridade}
                  onChange={(e) => setNovaPrioridade(e.target.value as Priority)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                >
                  <option value="cotacao">Prioridade: Cotação</option>
                  <option value="fixo">Prioridade: Fixo</option>
                  <option value="novo">Prioridade: Novo</option>
                  <option value="urgente">Prioridade: Urgente</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Salvar na Base
              </button>
            </form>
          )}

          {/* List of Catalog Products matching image.png */}
          <div className="space-y-1.5">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Nenhum produto correspondente na base de dados.
              </div>
            ) : (
              filtered.map((item) => {
                const isAdded = !!addedItemIds[item.id];
                const pStyle = getPriorityStyle(item.prioridadePadrao || 'cotacao');

                return (
                  <div
                    key={item.id}
                    className={`relative bg-white rounded-xl border transition-all py-2.5 px-3 sm:px-3.5 flex items-center gap-3 shadow-2xs hover:shadow-xs ${
                      isAdded
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    {/* 1. Photo thumbnail */}
                    <div
                      onClick={() => {
                        if (item.fotoUrl) {
                          setZoomedCatalogProduct(item);
                        } else {
                          handleQuickAdd(item);
                        }
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center shrink-0 overflow-hidden relative group transition-colors ${
                        item.fotoUrl
                          ? 'cursor-zoom-in hover:border-blue-400 bg-slate-50'
                          : 'cursor-pointer hover:border-blue-400 bg-slate-50/50'
                      }`}
                      title={
                        item.fotoUrl
                          ? 'Clique na foto para visualizar (1x)'
                          : 'Adicionar item à lista'
                      }
                    >
                      {item.fotoUrl ? (
                        <>
                          <img
                            src={item.fotoUrl}
                            alt={item.nome}
                            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                            <ZoomIn className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                          </div>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-slate-400 stroke-[1.8]" />
                          <span className="text-[9px] font-semibold text-slate-400 leading-none mt-0.5">Foto</span>
                        </>
                      )}
                    </div>

                    {/* 2. Center Content - exact match to user image */}
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleQuickAdd(item)}>
                      <h4
                        className="font-bold text-xs sm:text-sm leading-tight tracking-tight truncate hover:text-blue-700 transition-colors text-slate-900"
                        title={item.nome}
                      >
                        {item.nome}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* Priority Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide leading-none ${pStyle.className}`}
                        >
                          {pStyle.label}
                        </span>

                        {/* User Initial Circle */}
                        <span
                          style={{
                            borderColor: getUserColorHex(currentUser?.cor),
                            color: getUserColorHex(currentUser?.cor),
                            backgroundColor: `${getUserColorHex(currentUser?.cor)}15`,
                          }}
                          className="w-4.5 h-4.5 rounded-full border-[1.5px] font-black text-[9.5px] flex items-center justify-center shrink-0 leading-none shadow-2xs select-none"
                          title={`Perfil: ${currentUser?.nome || 'Admin'}`}
                        >
                          {(currentUser?.avatar || currentUser?.nome?.charAt(0) || 'A').toUpperCase()}
                        </span>

                        {/* Quantity Number in bold blue */}
                        <span className="text-blue-600 font-extrabold text-xs sm:text-sm leading-none">
                          {(() => {
                            const parsedQty = parseFloat(item.unidadePadrao);
                            return !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
                          })()}
                        </span>

                        {/* Código de barras após a quantidade quando presente */}
                        {item.codigoBarras && item.codigoBarras.trim() && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded-md border border-slate-200/80 leading-none transition-colors"
                            title={`Código de Barras: ${item.codigoBarras}`}
                          >
                            <ScanBarcode className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.codigoBarras}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. Action Button: Single (+) button without the word Adicionar */}
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(item)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 ${
                          isAdded
                            ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600'
                        }`}
                        title={isAdded ? 'Adicionado à lista!' : `Adicionar "${item.nome}" à lista`}
                      >
                        {isAdded ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.8]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAdd(item)}
                        className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        title="Mais opções"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>

      {/* 3x Zoom Image Modal */}
      {zoomedCatalogProduct && zoomedCatalogProduct.fotoUrl && (
        <ImageZoomModal
          isOpen={!!zoomedCatalogProduct}
          onClose={() => setZoomedCatalogProduct(null)}
          imageUrl={zoomedCatalogProduct.fotoUrl}
          title={zoomedCatalogProduct.nome}
          subtitle={`Unidade: ${zoomedCatalogProduct.unidadePadrao || 'UN'}${
            zoomedCatalogProduct.marcaPadrao ? ` • Marca: ${zoomedCatalogProduct.marcaPadrao}` : ''
          }`}
          badge={zoomedCatalogProduct.prioridadePadrao?.toUpperCase()}
        />
      )}
    </div>
  );
};
