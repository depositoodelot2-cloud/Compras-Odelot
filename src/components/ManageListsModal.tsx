import React, { useState } from 'react';
import { X, Plus, Factory, Check, Trash2, Edit3, Users, Building2, Save, Star } from 'lucide-react';
import { PurchaseList, Supplier } from '../types';

interface ManageListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: PurchaseList[];
  suppliers: Supplier[];
  activeListId: string;
  principalListId?: string;
  onSelectList: (id: string) => void;
  onSetPrincipalList: (id: string) => void;
  onCreateList: (list: Omit<PurchaseList, 'id' | 'criadoEm'>) => void;
  onUpdateList: (list: PurchaseList) => void;
  onDeleteList: (id: string) => void;
  currentUserName: string;
}

export const ManageListsModal: React.FC<ManageListsModalProps> = ({
  isOpen,
  onClose,
  lists,
  suppliers,
  activeListId,
  principalListId,
  onSelectList,
  onSetPrincipalList,
  onCreateList,
  onUpdateList,
  onDeleteList,
  currentUserName,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingList, setEditingList] = useState<PurchaseList | null>(null);

  const [nome, setNome] = useState('');
  const [fabrica, setFabrica] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [listIdToDelete, setListIdToDelete] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenNew = () => {
    setEditingList(null);
    setNome('');
    setFabrica('');
    setDescricao('');
    setSelectedSuppliers([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (list: PurchaseList) => {
    setEditingList(list);
    setNome(list.nome);
    setFabrica(list.fabrica);
    setDescricao(list.descricao || '');
    setSelectedSuppliers(list.fornecedoresIds || []);
    setIsFormOpen(true);
  };

  const handleToggleSupplier = (supplierId: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId)
        ? prev.filter((id) => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !fabrica.trim()) return;

    if (editingList) {
      // Update existing list
      onUpdateList({
        ...editingList,
        nome: nome.trim(),
        fabrica: fabrica.trim(),
        descricao: descricao.trim() || undefined,
        fornecedoresIds: selectedSuppliers,
      });
    } else {
      // Create new list
      onCreateList({
        nome: nome.trim(),
        fabrica: fabrica.trim(),
        descricao: descricao.trim() || undefined,
        fornecedoresIds: selectedSuppliers,
        criadoPor: currentUserName,
        ativa: true,
      });
    }

    setIsFormOpen(false);
    setEditingList(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Factory className="w-5 h-5 text-blue-600" />
              <span>Gerenciar Listas de Compras por Fábrica</span>
            </h2>
            <p className="text-xs text-slate-500">
              Crie e edite listas separadas para cada indústria/fabricante e vincule fornecedores
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
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!isFormOpen ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Listas Cadastradas ({lists.length})
                </span>
                <button
                  onClick={handleOpenNew}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Lista / Fábrica</span>
                </button>
              </div>

              <div className="space-y-3">
                {lists.map((list) => {
                  const isActive = list.id === activeListId;
                  const listSuppliers = suppliers.filter((s) =>
                    list.fornecedoresIds.includes(s.id)
                  );

                  const isListPrincipal = list.isPrincipal || list.id === principalListId;

                  return (
                    <div
                      key={list.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isListPrincipal
                          ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20 shadow-xs'
                          : isActive
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                              Fábrica: {list.fabrica}
                            </span>
                            {isListPrincipal && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-white" />
                                Lista Principal (Abre ao Iniciar)
                              </span>
                            )}
                            {isActive && !isListPrincipal && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                                Aberta Agora
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {list.nome}
                          </h4>
                          {list.descricao && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {list.descricao}
                            </p>
                          )}

                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {listSuppliers.length > 0
                                ? `${listSuppliers.length} fornecedor(es): ${listSuppliers
                                    .map((s) => s.nome)
                                    .join(', ')}`
                                : 'Nenhum fornecedor vinculado'}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons: Definir Principal, Editar, Ativar, Excluir */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {/* Botão DEFINIR COMO PRINCIPAL */}
                          <button
                            type="button"
                            onClick={() => onSetPrincipalList(list.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                              isListPrincipal
                                ? 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-400/50'
                                : 'bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-200 text-slate-600 hover:text-amber-700'
                            }`}
                            title={isListPrincipal ? 'Esta já é a lista principal que abre ao iniciar o app' : 'Definir como lista principal (abrir sempre nesta lista)'}
                          >
                            <Star className={`w-3.5 h-3.5 ${isListPrincipal ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                            <span className="hidden sm:inline">{isListPrincipal ? 'Principal' : 'Tornar Principal'}</span>
                          </button>

                          {/* Botão EDITAR LISTA */}
                          <button
                            onClick={() => handleOpenEdit(list)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-blue-200 shadow-2xs"
                            title="Editar nome, fábrica ou fornecedores desta lista"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          {!isActive && (
                            <button
                              onClick={() => {
                                onSelectList(list.id);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer"
                            >
                              Abrir
                            </button>
                          )}

                          {listIdToDelete === list.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                              <span className="text-[11px] font-bold text-rose-700">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteList(list.id);
                                  setListIdToDelete(null);
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setListIdToDelete(null)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setListIdToDelete(list.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Formulário de Criação ou Edição da Lista */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <span>{editingList ? 'Editar Lista de Compras' : 'Cadastrar Nova Lista'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>

              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 text-xs text-blue-800">
                💡 Cada lista representa uma fábrica/indústria (ex: Tigre, Amanco, Suvinil, Deca). Você pode enviar a cotação separadamente para os fornecedores autorizados selecionados abaixo.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fábrica / Indústria <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tigre, Amanco, Suvinil, Tramontina, Deca..."
                  value={fabrica}
                  onChange={(e) => setFabrica(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-bold text-slate-900 outline-hidden bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome da Lista <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cotação Tubos e Conexões - Tigre"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-bold text-slate-900 outline-hidden bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrição ou Regras (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Faturamento direto de fábrica, entrega em 48h, lote mínimo de R$ 3.000..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs text-slate-800 outline-hidden bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Fornecedores Habilitados para esta Fábrica
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {suppliers.map((supplier) => {
                    const isChecked = selectedSuppliers.includes(supplier.id);

                    return (
                      <div
                        key={supplier.id}
                        onClick={() => handleToggleSupplier(supplier.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {supplier.nome}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Contato: {supplier.contatoNome} ({supplier.telefone})
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingList(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingList ? 'Salvar Alterações' : 'Criar Lista'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
