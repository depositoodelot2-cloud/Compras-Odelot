import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  currentUser: UserProfile;
  onOpenAdmin: () => void;
  onSwitchUser: () => void;
  onOpenClearCache?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAdmin,
  onSwitchUser,
  onLogout,
}) => {
  return (
    <header className="w-full px-3.5 sm:px-4 pt-4 sm:pt-5 pb-2 sm:pb-3">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
            Lista de Compras
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-500 truncate">
              {currentUser.nome} ({currentUser.cargo})
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          <button
            onClick={onOpenAdmin}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Configurações e Parâmetros"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onSwitchUser}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
            title="Trocar Usuário ou Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
