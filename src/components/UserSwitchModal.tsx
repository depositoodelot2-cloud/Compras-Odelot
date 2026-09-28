import React from 'react';
import { X, Check, UserPlus, Edit3 } from 'lucide-react';
import { UserProfile } from '../types';
import { getUserColorHex } from '../utils';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  onOpenAdmin: () => void;
  onEditUser?: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  onOpenAdmin,
  onEditUser,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Usuários e Solicitantes
            </h3>
            <p className="text-xs text-slate-500">
              Selecione o usuário ativo ou clique em editar para alterar dados
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-80 overflow-y-auto">
          {users.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhum outro usuário cadastrado no momento.
            </div>
          ) : (
            users.map((u) => {
              const isSelected = u.id === currentUser.id;

            return (
              <div
                key={u.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {/* Click to select user */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div
                    style={{ backgroundColor: getUserColorHex(u.cor) }}
                    className="w-10 h-10 rounded-full text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs"
                  >
                    {u.avatar || u.nome.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {u.nome}
                      </p>
                      {u.role === 'admin' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                          Admin
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {u.cargo} • {u.email}
                    </p>
                  </div>
                </button>

                {/* Edit Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {onEditUser && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditUser(u);
                      }}
                      className="w-7 h-7 rounded-xl bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 flex items-center justify-center border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer shadow-2xs"
                      title="Editar este usuário"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          }))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          {onLogout ? (
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              Sair da Conta (Logout)
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Gerenciar / Novo Usuário</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Admin
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
