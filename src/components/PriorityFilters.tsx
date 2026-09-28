import React, { useState, useRef, useEffect } from 'react';
import { Search, ScanBarcode, CheckSquare, Square, Check, ChevronDown, Users, X } from 'lucide-react';
import { Priority, UserProfile, PurchaseList } from '../types';
import { getUserColorHex } from '../utils';
import { ListSelector } from './ListSelector';

interface PriorityFiltersProps {
  lists?: PurchaseList[];
  activeListId?: string;
  principalListId?: string;
  onSelectList?: (id: string) => void;
  onSetPrincipalList?: (id: string) => void;
  onManageLists?: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedPriority: Priority | 'total';
  onSelectPriority: (p: Priority | 'total') => void;
  priorityCounts: {
    total: number;
    fixo: number;
    novo: number;
    cotacao: number;
    urgente: number;
  };
  users: UserProfile[];
  selectedUserId: string | 'todos';
  onSelectUser: (id: string | 'todos') => void;
  currentUserId: string;
  onScanBarcode?: () => void;
  selectAllActive: boolean;
  onToggleSelectAll: () => void;
  onConfirmAllPurchased?: () => void;
}

export const PriorityFilters: React.FC<PriorityFiltersProps> = ({
  lists,
  activeListId,
  principalListId,
  onSelectList,
  onSetPrincipalList,
  onManageLists,
  searchTerm,
  onSearchChange,
  selectedPriority,
  onSelectPriority,
  priorityCounts,
  users,
  selectedUserId,
  onSelectUser,
  currentUserId,
  onScanBarcode,
  selectAllActive,
  onToggleSelectAll,
  onConfirmAllPurchased,
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  const selectedUser = selectedUserId !== 'todos' ? users.find((u) => u.id === selectedUserId) : null;

  return (
    <div className="w-full px-3.5 sm:px-4 py-1.5 space-y-2">
      {/* Row with List Selector (left) and Search Bar (right) side by side */}
      <div className="flex items-center gap-2 w-full min-w-0">
        {lists && activeListId && onSelectList && onManageLists && (
          <ListSelector
            lists={lists}
            activeListId={activeListId}
            principalListId={principalListId}
            onSelectList={onSelectList}
            onSetPrincipalList={onSetPrincipalList}
            onManageLists={onManageLists}
          />
        )}

        <div className="relative flex-1 min-w-0 flex items-center">
          <div className="absolute left-2.5 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full pl-8 pr-7 py-2 bg-slate-100 hover:bg-slate-100/90 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden font-medium truncate"
          />
          {onScanBarcode && (
            <button
              type="button"
              onClick={onScanBarcode}
              className="absolute right-2 text-blue-600 hover:text-blue-800 p-1 rounded-md transition-colors cursor-pointer"
              title="Leitor de Código de Barras / QR"
            >
              <ScanBarcode className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Priority Badges Row: T(n), F(n), N(n), C(n), U(n) */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar w-full min-w-0">
        {/* Total (T) */}
        <button
          onClick={() => onSelectPriority('total')}
          className={`flex-1 min-w-[50px] sm:min-w-[56px] py-1.5 px-1 sm:px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
            selectedPriority === 'total'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400/40'
              : 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-900'
          }`}
        >
          T <span className="font-semibold text-[11px] opacity-90">({priorityCounts.total})</span>
        </button>

        {/* Fixo (F) */}
        <button
          onClick={() => onSelectPriority('fixo')}
          className={`flex-1 min-w-[58px] py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
            selectedPriority === 'fixo'
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300'
              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
          }`}
        >
          F <span className="font-semibold text-[11px] opacity-90">({priorityCounts.fixo})</span>
        </button>

        {/* Novo (N) */}
        <button
          onClick={() => onSelectPriority('novo')}
          className={`flex-1 min-w-[58px] py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
            selectedPriority === 'novo'
              ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          N <span className="font-semibold text-[11px] opacity-90">({priorityCounts.novo})</span>
        </button>

        {/* Cotacao (C) */}
        <button
          onClick={() => onSelectPriority('cotacao')}
          className={`flex-1 min-w-[58px] py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
            selectedPriority === 'cotacao'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
        >
          C <span className="font-semibold text-[11px] opacity-90">({priorityCounts.cotacao})</span>
        </button>

        {/* Urgente (U) */}
        <button
          onClick={() => onSelectPriority('urgente')}
          className={`flex-1 min-w-[58px] py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
            selectedPriority === 'urgente'
              ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 animate-pulse'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
          }`}
        >
          U <span className="font-semibold text-[11px] opacity-90">({priorityCounts.urgente})</span>
        </button>
      </div>

      {/* Row 2: Select all checkbox + Confirmation button in front of checkbox + User Dropdown */}
      <div className="flex items-center gap-2 w-full min-w-0 relative z-20">
        <button
          onClick={onToggleSelectAll}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs ${
            selectAllActive
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300'
          }`}
          title={selectAllActive ? 'Desmarcar todos' : 'Selecionar todos os itens para compra'}
        >
          {selectAllActive ? (
            <CheckSquare className="w-4 h-4 text-white" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Botão de confirmação na frente do checkbox de todos */}
        {selectAllActive && onConfirmAllPurchased && (
          <button
            type="button"
            onClick={onConfirmAllPurchased}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 animate-in fade-in slide-in-from-left-2 duration-150"
            title="Confirmar compra de todos os itens da lista"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Sim, já foi comprado</span>
          </button>
        )}

        {/* User Dropdown Selector */}
        <div className="relative min-w-0" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className={`h-8 px-2.5 sm:px-3 rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-2xs select-none ${
              selectedUserId !== 'todos'
                ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100/80'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Filtrar por Usuário (Dropdown)"
          >
            {selectedUser ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  style={{
                    backgroundColor: getUserColorHex(selectedUser.cor),
                    color: '#FFFFFF',
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 shadow-2xs"
                >
                  {selectedUser.avatar || selectedUser.nome.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[110px] sm:max-w-[180px]">
                  {selectedUser.nome}
                </span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUser('todos');
                  }}
                  className="p-0.5 hover:bg-blue-200/80 rounded-full text-blue-600 transition-colors ml-0.5"
                  title="Limpar filtro de usuário"
                >
                  <X className="w-3 h-3" />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700 truncate">
                  Usuários: Todos
                </span>
              </div>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                isUserDropdownOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {/* Floating Dropdown Menu */}
          {isUserDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Filtrar por Usuário
                </span>
                {selectedUserId !== 'todos' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectUser('todos');
                      setIsUserDropdownOpen(false);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Ver Todos
                  </button>
                )}
              </div>

              <div className="p-1 space-y-0.5 max-h-64 overflow-y-auto">
                {/* Opção Todos */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectUser('todos');
                    setIsUserDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    selectedUserId === 'todos'
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-tight">Todos os Usuários</div>
                    <div className="text-[10px] text-slate-400 leading-tight">Exibir produtos criados por todos</div>
                  </div>
                  {selectedUserId === 'todos' && (
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                </button>

                {/* Separador */}
                <div className="my-1 border-t border-slate-100" />

                {/* Lista de Usuários */}
                {users.map((user) => {
                  const isSelected = selectedUserId === user.id;
                  const isCurrent = user.id === currentUserId;
                  const userColor = getUserColorHex(user.cor);

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onSelectUser(isSelected ? 'todos' : user.id);
                        setIsUserDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        style={{
                          borderColor: userColor,
                          backgroundColor: `${userColor}15`,
                          color: userColor,
                        }}
                        className="relative w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-xs shrink-0"
                      >
                        {user.avatar || user.nome.charAt(0).toUpperCase()}
                        {isCurrent && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate text-slate-800">
                            {user.nome}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700">
                              Você
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {user.cargo || user.role}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
