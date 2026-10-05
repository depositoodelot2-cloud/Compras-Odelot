import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Camera,
  Image as ImageIcon,
  Check,
  Database,
  ListPlus,
  Trash2,
  Barcode as BarcodeIcon,
  ChevronDown
} from 'lucide-react';
import { ProductItem, Priority, UserProfile, PurchaseList, CatalogProduct } from '../types';
import { getUserColorHex, capitalizeWords } from '../utils';
import { CameraModal } from './CameraModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { compressImage } from '../utils/imageUtils';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    productData: Omit<ProductItem, 'id' | 'criadoEm'> & { id?: string },
    saveToCatalog?: boolean
  ) => void;
  productToEdit?: ProductItem | null;
  activeList: PurchaseList;
  users: UserProfile[];
  currentUser: UserProfile;
  catalog?: CatalogProduct[];
  onOpenNewUser?: () => void;
}

const COMMON_UNITS = [
  'unidade(s)',
  'barra(s)',
  'caixa(s)',
  'metro(s)',
  'quilo(s)',
  'pacote(s)',
  'rolo(s)',
  'par(es)',
  'litro(s)',
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  activeList,
  users,
  currentUser,
  catalog = [],
  onOpenNewUser,
}) => {
  const [prioridade, setPrioridade] = useState<Priority>('cotacao');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState(activeList?.fabrica || '');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unidade, setUnidade] = useState('unidade(s)');
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [showCatalogSuggestions, setShowCatalogSuggestions] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productToEdit) {
      setPrioridade(productToEdit.prioridade || 'cotacao');
      setSelectedUserId(productToEdit.criadoPor?.id || currentUser?.id || '');
      setCodigoBarras(productToEdit.codigoBarras || '');
      setNome(capitalizeWords(productToEdit.nome || ''));
      setMarca(productToEdit.marca || activeList?.fabrica || '');
      setQuantidade(productToEdit.quantidade !== undefined && productToEdit.quantidade !== null ? productToEdit.quantidade : 1);
      setUnidade(productToEdit.unidade || 'unidade(s)');
      setFotoUrl(productToEdit.fotoUrl || '');
    } else {
      setPrioridade('cotacao'); // Default selected in Screenshot
      setSelectedUserId(currentUser?.id || '');
      setCodigoBarras('');
      setNome('');
      setMarca(activeList?.fabrica || '');
      setQuantidade(1);
      setUnidade('unidade(s)');
      setFotoUrl('');
    }
  }, [productToEdit, activeList, currentUser, isOpen]);

  if (!isOpen) return null;

  // Filter catalog suggestions when typing in Nome
  const suggestions = catalog.filter((c) =>
    nome.trim() && c.nome.toLowerCase().includes(nome.toLowerCase())
  );

  const handleSelectSuggestion = (catItem: CatalogProduct) => {
    setNome(capitalizeWords(catItem.nome));
    setMarca(catItem.marcaPadrao || activeList.fabrica);
    if (catItem.unidadePadrao) {
      const matchUnit = COMMON_UNITS.find((u) =>
        u.toLowerCase().startsWith(catItem.unidadePadrao.toLowerCase())
      );
      setUnidade(matchUnit || catItem.unidadePadrao);
    }
    if (catItem.codigoBarras) setCodigoBarras(catItem.codigoBarras);
    if (catItem.fotoUrl) setFotoUrl(catItem.fotoUrl);
    setShowCatalogSuggestions(false);
  };

  const handleScanBarcode = () => {
    setIsBarcodeScannerOpen(true);
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    const cleanCode = scannedCode.trim();
    setCodigoBarras(cleanCode);
    setIsBarcodeScannerOpen(false);

    // If catalog has an item with this barcode, auto-populate details
    const matched = catalog.find(
      (c) => c.codigoBarras && c.codigoBarras.trim() === cleanCode
    );
    if (matched) {
      if (!nome.trim()) setNome(capitalizeWords(matched.nome));
      if (matched.marcaPadrao && !marca.trim()) setMarca(matched.marcaPadrao);
      if (matched.unidadePadrao) {
        const matchUnit = COMMON_UNITS.find((u) =>
          u.toLowerCase().startsWith(matched.unidadePadrao.toLowerCase())
        );
        setUnidade(matchUnit || matched.unidadePadrao);
      }
      if (matched.fotoUrl && !fotoUrl) setFotoUrl(matched.fotoUrl);
      if (matched.prioridadePadrao) setPrioridade(matched.prioridadePadrao);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 640, 640, 0.70);
        setFotoUrl(compressed);
      } catch (err) {
        console.warn('Erro ao processar imagem:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
      // Reset input value so selecting the same file again triggers onChange
      e.target.value = '';
    }
  };

  const handleQuantityIncrement = () => {
    setQuantidade((prev) => prev + 1);
  };

  const handleQuantityDecrement = () => {
    setQuantidade((prev) => (prev > 0 ? (prev > 1 ? prev - 1 : 0) : 0));
  };

  const handleSaveAction = (saveToCatalog: boolean, onlyCatalog = false) => {
    if (!nome.trim()) {
      return;
    }

    const user = users.find((u) => u.id === selectedUserId) || currentUser;

    if (!onlyCatalog) {
      const parsedQtd = typeof quantidade === 'number' ? quantidade : parseFloat(String(quantidade));
      const finalQtd = isNaN(parsedQtd) || parsedQtd < 0 ? 0 : parsedQtd;

      onSave(
        {
          id: productToEdit ? productToEdit.id : undefined,
          listaId: activeList?.id || '',
          nome: capitalizeWords(nome.trim()),
          marca: marca.trim() || activeList?.fabrica || 'Geral',
          unidade,
          quantidade: finalQtd,
          prioridade,
          criadoPor: {
            id: user?.id || currentUser?.id || 'admin',
            nome: user?.nome || currentUser?.nome || 'Usuário',
            cargo: user?.cargo || currentUser?.cargo || 'Colaborador',
            avatar: user?.avatar || currentUser?.avatar || 'U',
            cor: user?.cor || currentUser?.cor || '#2563eb',
          },
          status: productToEdit ? productToEdit.status : 'pendente',
          codigoBarras: codigoBarras.trim() || undefined,
          fotoUrl: fotoUrl || undefined,
          fornecedorEscolhidoId: productToEdit?.fornecedorEscolhidoId,
        },
        saveToCatalog
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-6 duration-200">
        {/* Top Header matching Screenshot */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {productToEdit ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <div className="px-6 py-3 overflow-y-auto space-y-4.5 flex-1">
          {/* 1. PRIORIDADE matching Screenshot */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              Prioridade
            </label>

            <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1">
              {/* FIXO */}
              <button
                type="button"
                onClick={() => setPrioridade('fixo')}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  prioridade === 'fixo'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                FIXO
              </button>

              {/* NOVO */}
              <button
                type="button"
                onClick={() => setPrioridade('novo')}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  prioridade === 'novo'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                NOVO
              </button>

              {/* COTAÇÃO (Highlighted like in the screenshot with rounded golden-yellow pill) */}
              <button
                type="button"
                onClick={() => setPrioridade('cotacao')}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center truncate ${
                  prioridade === 'cotacao'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                COTAÇ...
              </button>

              {/* URGENTE */}
              <button
                type="button"
                onClick={() => setPrioridade('urgente')}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  prioridade === 'urgente'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                URGENTE
              </button>
            </div>
          </div>

          {/* QUEM ESTÁ ADICIONANDO matching Screenshot */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              Quem está adicionando
            </label>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {users.map((user) => {
                const isSelected = selectedUserId === user.id;
                const userColor = getUserColorHex(user.cor);

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    style={{
                      borderColor: userColor,
                      backgroundColor: isSelected ? userColor : `${userColor}15`,
                      color: isSelected ? '#FFFFFF' : userColor,
                      boxShadow: isSelected ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${userColor}` : undefined,
                    }}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm shrink-0 transition-all active:scale-95 cursor-pointer shadow-2xs ${
                      isSelected ? 'scale-105' : 'hover:scale-105'
                    }`}
                    title={`${user.nome} (${user.cargo})`}
                  >
                    {user.avatar || user.nome.charAt(0)}
                  </button>
                );
              })}

              {/* Plus (+) circle button matching Screenshot */}
              <button
                type="button"
                onClick={onOpenNewUser}
                className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 hover:border-blue-500 text-slate-400 hover:text-blue-600 flex items-center justify-center font-bold transition-all cursor-pointer shrink-0"
                title="Novo Colaborador"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. CÓDIGO DE BARRAS matching Screenshot */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              2. Código de Barras
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Ex: 7891000100103"
                className="w-full px-4 py-3 bg-slate-50/90 focus:bg-white rounded-2xl border border-slate-200 focus:border-blue-500 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-hidden pr-11 transition-all"
              />
              <button
                type="button"
                onClick={handleScanBarcode}
                className="absolute right-3.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                title="Escanear Código de Barras"
              >
                <ScanBarcode className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3. NOME DO PRODUTO matching Screenshot with blue border & icons */}
          <div className="relative">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              3. Nome do Produto <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => {
                  setNome(capitalizeWords(e.target.value));
                  setShowCatalogSuggestions(true);
                }}
                onFocus={() => setShowCatalogSuggestions(true)}
                placeholder="Nome do produto ou código..."
                className="w-full pl-4 pr-16 py-3.5 bg-white rounded-2xl border-2 border-blue-500 focus:ring-4 focus:ring-blue-100 text-sm font-bold text-slate-900 placeholder-slate-400 outline-hidden transition-all shadow-xs"
                autoFocus
              />

              {/* Barcode & Search Icons inside right side of input matching Screenshot */}
              <div className="absolute right-3.5 flex items-center gap-1.5 text-slate-400">
                <button
                  type="button"
                  onClick={handleScanBarcode}
                  className="hover:text-blue-600 transition-colors cursor-pointer p-0.5"
                  title="Escanear Código de Barras com a Câmera"
                >
                  <BarcodeIcon className="w-4 h-4" />
                </button>
                <Search className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Autocomplete suggestions dropdown matching card aesthetic */}
            {showCatalogSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-blue-200 shadow-xl z-20 max-h-48 overflow-y-auto p-1.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400 px-2 py-0.5">
                  Sugestões da Base de Produtos:
                </p>
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left p-2 hover:bg-blue-50/80 rounded-2xl border border-slate-100 hover:border-blue-200 text-xs flex items-center gap-2.5 transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-xl border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 shrink-0 text-slate-400">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block truncate">{sug.nome}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                          {sug.marcaPadrao}
                        </span>
                        {sug.unidadePadrao && (
                          <span>({sug.unidadePadrao})</span>
                        )}
                      </div>
                    </div>
                    <span className="w-5 h-5 rounded-full border border-emerald-500 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                      O
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. QUANTIDADE matching Screenshot with unit selector and minus/plus */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                4. Quantidade
              </label>

              {/* Unit Dropdown matching "unidade(s) ⌄" */}
              <div className="relative inline-flex items-center">
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="appearance-none bg-transparent pr-5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer focus:outline-hidden"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none" />
              </div>
            </div>

            {/* Stepper row: [ — ] [ 1 unidade ] [ + ] */}
            <div className="bg-slate-50/90 rounded-2xl p-2 border border-slate-200 flex items-center justify-between">
              {/* Minus Button */}
              <button
                type="button"
                onClick={handleQuantityDecrement}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 flex items-center justify-center font-black text-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Central Value */}
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantidade === 0 ? '0' : (quantidade || '')}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    setTimeout(() => {
                      try {
                        target.select();
                      } catch {}
                    }, 50);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    setTimeout(() => {
                      try {
                        target.select();
                      } catch {}
                    }, 50);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setQuantidade(0);
                    } else {
                      const num = parseFloat(val);
                      setQuantidade(isNaN(num) ? 0 : Math.max(0, num));
                    }
                  }}
                  className="w-16 text-center text-2xl font-black text-blue-600 bg-transparent outline-hidden font-mono"
                />
                <span className="text-xs font-bold text-slate-500">
                  {unidade.replace(/\(.*?\)/g, '').trim()}
                </span>
              </div>

              {/* Plus Button matching Screenshot: solid blue circle with white plus */}
              <button
                type="button"
                onClick={handleQuantityIncrement}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 6. FOTO DO PRODUTO (Opcional) matching Screenshot */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              6. Foto do Produto <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>

            <div className="flex items-center justify-between p-2.5 bg-slate-50/90 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                {fotoUrl ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                    <img
                      src={fotoUrl}
                      alt="Foto do produto"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="absolute top-0 right-0 p-0.5 bg-rose-600 text-white rounded-bl"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 pl-2">
                    Nenhuma foto
                  </span>
                )}
              </div>

              {/* Camera & Gallery buttons matching Screenshot */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Hidden gallery file input */}
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Hidden native device camera input fallback */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Blue Camera Button - opens live camera viewfinder */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs active:scale-95"
                  title="Tirar foto com a câmera"
                >
                  <Camera className="w-4 h-4" />
                </button>

                {/* Gallery Button */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-2xs active:scale-95"
                  title="Selecionar foto da galeria"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Row: [ ≡+ Lista e Base ] [ 🗄️ Salvar na Base ] matching Screenshot */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleSaveAction(true)}
              className="py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <ListPlus className="w-4 h-4" />
              <span>Lista e Base</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAction(true, true)}
              className="py-3 px-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Database className="w-4 h-4 text-slate-600" />
              <span>Salvar na Base</span>
            </button>
          </div>

          {/* Bottom Primary Button matching Screenshot: [ ✔ Salvar na Lista e na Base de Dados ] */}
          <div className="pt-1 pb-2">
            <button
              type="button"
              onClick={() => handleSaveAction(true)}
              className="w-full py-4 px-4 rounded-2xl bg-[#5984e8] hover:bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 active:scale-98 cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Salvar na Lista e na Base de Dados</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Camera Viewfinder Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(photo) => setFotoUrl(photo)}
        title={nome.trim() ? `Foto de: ${nome}` : 'Tirar Foto do Produto'}
      />

      {/* Real Barcode Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Ler Código de Barras"
        subtitle="Aponte a câmera para o código de barras ou QR Code"
      />
    </div>
  );
};
