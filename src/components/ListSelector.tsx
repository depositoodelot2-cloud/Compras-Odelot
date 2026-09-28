import React from 'react';
import { ChevronDown, Edit3, Star } from 'lucide-react';
import { PurchaseList } from '../types';

interface ListSelectorProps {
  lists: PurchaseList[];
  activeListId: string;
  principalListId?: string;
  onSelectList: (id: string) => void;
  onManageLists: () => void;
  onSetPrincipalList?: (id: string) => void;
}

export const ListSelector: React.FC<ListSelectorProps> = ({
  lists,
  activeListId,
  principalListId,
  onSelectList,
  onManageLists,
  onSetPrincipalList,
}) => {
  const currentList = lists.find((l) => l.id === activeListId);
  const isCurrentPrincipal = currentList?.isPrincipal || activeListId === principalListId;

  return (
    <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-100/90 rounded-2xl border border-slate-200/80 px-2 py-1.5 shrink-0 max-w-[50%] min-w-0 transition-colors">
      <div className="relative min-w-0 flex-1 flex items-center">
        <select
          value={activeListId}
          onChange={(e) => onSelectList(e.target.value)}
          className="w-full bg-transparent font-bold text-slate-800 text-xs sm:text-sm appearance-none pr-4 cursor-pointer focus:outline-hidden truncate"
          title="Selecionar Lista de Compras"
        >
          {lists.length === 0 ? (
            <option value="">Nenhuma lista</option>
          ) : (
            lists.map((l) => {
              const isPrincipal = l.isPrincipal || l.id === principalListId;
              return (
                <option key={l.id} value={l.id}>
                  {l.fabrica}{isPrincipal ? ' ★' : ''}
                </option>
              );
            })
          )}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Botão de Estrela Rápida: Definir ou Indicar que é a Principal */}
      {onSetPrincipalList && activeListId && (
        <button
          type="button"
          onClick={() => onSetPrincipalList(activeListId)}
          className={`p-1 rounded-lg transition-all shrink-0 cursor-pointer ${
            isCurrentPrincipal
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50/50'
          }`}
          title={
            isCurrentPrincipal
              ? 'Esta é a lista principal! O aplicativo sempre abre nela.'
              : 'Clique para definir esta lista como Principal (o app sempre abrirá nela)'
          }
        >
          <Star className={`w-3.5 h-3.5 ${isCurrentPrincipal ? 'fill-amber-400 text-amber-500' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={onManageLists}
        className="p-1 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
        title="Gerenciar / Editar Listas"
      >
        <Edit3 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
