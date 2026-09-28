import React from 'react';
import { ShoppingBag, CircleDollarSign } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'lista' | 'cotacoes';
  onSelectTab: (tab: 'lista' | 'cotacoes') => void;
  quotesBadgeCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg">
      <div className="w-full max-w-xl mx-auto flex items-center justify-around h-16 px-4 sm:px-6">
        {/* Tab 1: LISTA matching Screenshot 1 */}
        <button
          onClick={() => onSelectTab('lista')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'lista'
              ? 'text-blue-600 font-extrabold'
              : 'text-slate-400 hover:text-slate-600 font-bold'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[11px] tracking-wider uppercase">Lista</span>
          {currentTab === 'lista' && (
            <span className="w-8 h-1 rounded-full bg-blue-600 mt-0.5"></span>
          )}
        </button>

        {/* Tab 2: COTAÇÕES matching Screenshot 1 & 3 */}
        <button
          onClick={() => onSelectTab('cotacoes')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            currentTab === 'cotacoes'
              ? 'text-blue-600 font-extrabold'
              : 'text-slate-400 hover:text-slate-600 font-bold'
          }`}
        >
          <div className="relative">
            <CircleDollarSign className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[11px] tracking-wider uppercase">Cotações</span>
          {currentTab === 'cotacoes' && (
            <span className="w-12 h-1 rounded-full bg-blue-600 mt-0.5"></span>
          )}
        </button>
      </div>
    </nav>
  );
};
