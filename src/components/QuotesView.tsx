import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Building2,
  Lock,
  Mail,
  Copy,
  MessageSquare,
  Eye,
  Plus,
  ChevronDown,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  Send,
  Save,
  Clock,
  Printer,
  Edit3,
  Package,
  X
} from 'lucide-react';
import {
  PurchaseList,
  ProductItem,
  Supplier,
  SupplierQuote,
  QuoteItemResponse,
  UserProfile,
} from '../types';
import {
  formatCurrency,
  formatBRLInput,
  parseBRLInput,
  PRIORITY_CONFIG,
  generateSupplierQuoteLink,
  buildWhatsAppQuoteMessage,
} from '../utils';

interface QuotesViewProps {
  lists: PurchaseList[];
  activeListId: string;
  onSelectList: (id: string) => void;
  onManageLists: () => void;
  products: ProductItem[];
  suppliers: Supplier[];
  quotes: SupplierQuote[];
  currentUser: UserProfile;
  onSaveQuote: (quote: SupplierQuote) => void;
  onBackToList: () => void;
  onOpenPortalModal: (supplier: Supplier, list: PurchaseList) => void;
  onOpenPrintModal: (quote: SupplierQuote, supplier: Supplier, list: PurchaseList) => void;
  onOpenNewSupplier: () => void;
  onEditSupplier?: (supplier: Supplier) => void;
  onSelectWinner?: (productId: string, supplierId: string) => void;
}

type SubTab = 'cotar' | 'disputa' | 'listas';

const DEFAULT_EMPTY_LIST: PurchaseList = {
  id: '',
  nome: 'Minha Lista',
  fabrica: 'Principal',
  descricao: '',
  fornecedoresIds: [],
  criadoPor: '',
  criadoEm: '',
  ativa: true,
};

export const QuotesView: React.FC<QuotesViewProps> = ({
  lists,
  activeListId,
  onSelectList,
  onManageLists,
  products,
  suppliers,
  quotes,
  currentUser,
  onSaveQuote,
  onBackToList,
  onOpenPortalModal,
  onOpenPrintModal,
  onOpenNewSupplier,
  onEditSupplier,
  onSelectWinner,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('cotar');
  const [copiedLink, setCopiedLink] = useState(false);

  const activeList = lists.find((l) => l.id === activeListId) || lists[0] || DEFAULT_EMPTY_LIST;
  const listProducts = useMemo(
    () =>
      activeList?.id
        ? products.filter((p) => p.listaId === activeList.id && p.status !== 'comprado')
        : [],
    [products, activeList?.id]
  );

  // Suppliers enabled for this factory/list (configured when creating/editing the list)
  const enabledSuppliers = useMemo(() => {
    if (!activeList || !activeList.id) return [];
    const enabledIds = activeList.fornecedoresIds || [];
    return suppliers.filter(
      (s) =>
        enabledIds.includes(s.id) ||
        (s.listasIds && s.listasIds.includes(activeList.id))
    );
  }, [suppliers, activeList]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Keep selectedSupplierId synchronized with enabledSuppliers
  useEffect(() => {
    if (enabledSuppliers.length > 0) {
      if (!selectedSupplierId || !enabledSuppliers.some((s) => s.id === selectedSupplierId)) {
        setSelectedSupplierId(enabledSuppliers[0].id);
      }
    } else {
      setSelectedSupplierId('');
    }
  }, [enabledSuppliers, activeList?.id]);

  const activeSupplier = useMemo(() => {
    if (enabledSuppliers.length === 0) return null;
    return (
      enabledSuppliers.find((s) => s.id === selectedSupplierId) ||
      enabledSuppliers[0]
    );
  }, [enabledSuppliers, selectedSupplierId]);

  // Active quote for current list & supplier
  const existingQuote = useMemo(() => {
    if (!activeSupplier || !activeList?.id) return null;
    return (
      quotes.find(
        (q) =>
          q.listaId === activeList.id && q.fornecedorId === activeSupplier.id
      ) || null
    );
  }, [quotes, activeList?.id, activeSupplier?.id]);

  // Form states for items
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItemResponse>>(
    existingQuote?.itens || {}
  );
  const [prazoEntrega, setPrazoEntrega] = useState(
    existingQuote?.prazoEntrega || '24 a 48 horas'
  );
  const [condicoesPagamento, setCondicoesPagamento] = useState(
    existingQuote?.condicoesPagamento || '28 DDL'
  );
  const [frete, setFrete] = useState(existingQuote?.frete || 'CIF (Incluso)');
  const [observacoesGerais, setObservacoesGerais] = useState(
    existingQuote?.observacoesGerais || ''
  );
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Subtab 'listas' (Pedidos por Fornecedor) state
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [selectedOrderSupplierId, setSelectedOrderSupplierId] = useState<string>('');
  const [copiedOrderText, setCopiedOrderText] = useState(false);

  // Sync state when supplier or quote changes
  React.useEffect(() => {
    if (existingQuote) {
      if (existingQuote.itens) {
        const sanitized: Record<string, QuoteItemResponse> = {};
        Object.entries(existingQuote.itens).forEach(([k, val]) => {
          const b = val.ma?.trim();
          sanitized[k] = {
            ...val,
            ma:
              b &&
              b.toLowerCase() !== 'principal' &&
              b.toLowerCase() !== (activeList.fabrica || '').toLowerCase()
                ? b
                : '',
          };
        });
        setQuoteItems(sanitized);
      } else {
        setQuoteItems({});
      }
      setPrazoEntrega(existingQuote.prazoEntrega || '24 a 48 horas');
      setCondicoesPagamento(existingQuote.condicoesPagamento || '28 DDL');
      setFrete(existingQuote.frete || 'CIF (Incluso)');
      setObservacoesGerais(existingQuote.observacoesGerais || '');
    } else {
      // Pre-initialize empty items with requested quantities (starting with 1) and empty brand
      const initial: Record<string, QuoteItemResponse> = {};
      listProducts.forEach((p) => {
        initial[p.id] = {
          precoUnitario: 0,
          quantidade: 1,
          ma: '',
          observacao: '',
        };
      });
      setQuoteItems(initial);
      setPrazoEntrega('24 a 48 horas');
      setCondicoesPagamento('28 DDL');
      setFrete('CIF (Incluso)');
      setObservacoesGerais('');
    }
  }, [existingQuote, activeSupplier?.id, activeList.id]);

  // Handle item change with real-time auto-save
  const handleItemFieldChange = (
    productId: string,
    field: keyof QuoteItemResponse,
    value: any
  ) => {
    setQuoteItems((prev) => {
      const current = prev[productId] || {
        precoUnitario: 0,
        quantidade: 1,
        ma: '',
      };
      const updated = {
        ...prev,
        [productId]: {
          ...current,
          [field]: value,
        },
      };

      if (activeSupplier) {
        const hasPrices = Object.values(updated).some((i) => Number(i.precoUnitario) > 0);
        const newQuote: SupplierQuote = {
          id: existingQuote ? existingQuote.id : `quote-${Date.now()}`,
          listaId: activeList.id,
          fornecedorId: activeSupplier.id,
          itens: updated,
          status: hasPrices ? 'respondido' : 'pendente',
          preenchidoPor: 'empresa',
          prazoEntrega: prazoEntrega || '24 a 48 horas',
          condicoesPagamento: condicoesPagamento || '28 DDL',
          frete: frete || 'CIF (Incluso)',
          observacoesGerais: observacoesGerais || '',
          atualizadoEm: new Date().toISOString(),
        };
        onSaveQuote(newQuote);
      }

      return updated;
    });
  };

  // Quoted count
  const quotedCount = useMemo(() => {
    return Object.values(quoteItems).filter((i) => i.precoUnitario > 0).length;
  }, [quoteItems]);

  const totalQuoteValue = useMemo(() => {
    return Object.entries(quoteItems).reduce((sum, [pId, resp]) => {
      const price = Number(resp.precoUnitario) || 0;
      const qty = Number(resp.quantidade) || 0;
      return sum + price * qty;
    }, 0);
  }, [quoteItems]);

  // Quotes for this list (for Disputa tab)
  const quotesForList = useMemo(() => {
    if (!activeList?.id) return [];
    return quotes.filter((q) => q.listaId === activeList.id);
  }, [quotes, activeList?.id]);

  // Group winning products by supplier for the current active list (for Listas de Pedidos tab)
  const { wonProductsBySupplier, unquotedProducts } = useMemo(() => {
    const wonMap: Record<
      string,
      Array<{
        product: ProductItem;
        price: number;
        ma?: string;
        supplierQty: number;
        isManualChoice: boolean;
        isLowestPrice: boolean;
        quote: SupplierQuote;
      }>
    > = {};

    const unquoted: ProductItem[] = [];

    listProducts.forEach((p) => {
      // Find all quotes for this product with precoUnitario > 0
      const validQuotes: Array<{
        quote: SupplierQuote;
        supplierId: string;
        price: number;
        ma?: string;
        supplierQty: number;
      }> = [];

      quotesForList.forEach((q) => {
        const resp = q.itens[p.id];
        const price = Number(resp?.precoUnitario) || 0;
        if (price > 0) {
          validQuotes.push({
            quote: q,
            supplierId: q.fornecedorId,
            price,
            ma: resp?.ma,
            supplierQty: Number(resp?.quantidade) || 1,
          });
        }
      });

      if (validQuotes.length === 0) {
        unquoted.push(p);
        return;
      }

      const minPrice = Math.min(...validQuotes.map((v) => v.price));
      const lowestQuote = validQuotes.find((v) => v.price === minPrice);

      // Check if user manually selected a winner for this product
      const manualWinnerId = p.fornecedorEscolhidoId;
      const manualQuote = manualWinnerId
        ? validQuotes.find((v) => v.supplierId === manualWinnerId)
        : null;

      const winningItem = manualQuote || lowestQuote;

      if (winningItem) {
        const sId = winningItem.supplierId;
        if (!wonMap[sId]) {
          wonMap[sId] = [];
        }
        wonMap[sId].push({
          product: p,
          price: winningItem.price,
          ma: winningItem.ma,
          supplierQty: winningItem.supplierQty,
          isManualChoice: !!manualQuote && manualWinnerId !== lowestQuote?.supplierId,
          isLowestPrice: winningItem.price === minPrice,
          quote: winningItem.quote,
        });
      }
    });

    return { wonProductsBySupplier: wonMap, unquotedProducts: unquoted };
  }, [listProducts, quotesForList]);

  // Suppliers who won at least one product
  const suppliersWithWonItems = useMemo(() => {
    return suppliers.filter((s) => wonProductsBySupplier[s.id]?.length > 0);
  }, [suppliers, wonProductsBySupplier]);

  // Active selected supplier in the Listas subtab
  const activeOrderSupplier = useMemo(() => {
    if (selectedOrderSupplierId && suppliers.some((s) => s.id === selectedOrderSupplierId)) {
      return suppliers.find((s) => s.id === selectedOrderSupplierId)!;
    }
    if (suppliersWithWonItems.length > 0) {
      return suppliersWithWonItems[0];
    }
    return suppliers[0] || null;
  }, [selectedOrderSupplierId, suppliers, suppliersWithWonItems]);

  const wonItemsForActiveSupplier = useMemo(() => {
    if (!activeOrderSupplier) return [];
    return wonProductsBySupplier[activeOrderSupplier.id] || [];
  }, [activeOrderSupplier, wonProductsBySupplier]);

  // Compute total order value for active supplier based on orderQuantities
  const totalOrderValue = useMemo(() => {
    return wonItemsForActiveSupplier.reduce((sum, item) => {
      const qty =
        orderQuantities[item.product.id] !== undefined
          ? orderQuantities[item.product.id]
          : item.product.quantidade;
      return sum + item.price * Math.max(0, qty);
    }, 0);
  }, [wonItemsForActiveSupplier, orderQuantities]);

  const handleUpdateOrderQty = (productId: string, delta: number) => {
    setOrderQuantities((prev) => {
      const prod = listProducts.find((p) => p.id === productId);
      const current = prev[productId] !== undefined ? prev[productId] : (prod?.quantidade || 1);
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleSetOrderQty = (productId: string, val: number) => {
    setOrderQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }));
  };

  const handleSendOrderWhatsApp = () => {
    if (!activeOrderSupplier) return;
    const phone = activeOrderSupplier.telefone.replace(/\D/g, '');
    let msg = `*PEDIDO DE COMPRA - ${activeList.fabrica.toUpperCase()}*\n`;
    msg += `Fornecedor: ${activeOrderSupplier.nome}\n`;
    msg += `Contato: ${activeOrderSupplier.contatoNome || 'Vendas'}\n\n`;
    msg += `Olá! Segue a relação de itens aprovados para faturamento:\n\n`;

    wonItemsForActiveSupplier.forEach((item, idx) => {
      const qty =
        orderQuantities[item.product.id] !== undefined
          ? orderQuantities[item.product.id]
          : item.product.quantidade;
      if (qty > 0) {
        const sub = item.price * qty;
        msg += `${idx + 1}. *${item.product.nome}*\n`;
        msg += `   • Qtd a comprar: ${qty} ${item.product.unidade}\n`;
        msg += `   • Preço cotado: ${formatCurrency(item.price)}/${item.product.unidade}\n`;
        if (item.ma) msg += `   • Marca: ${item.ma}\n`;
        msg += `   • Subtotal: ${formatCurrency(sub)}\n\n`;
      }
    });

    msg += `*VALOR TOTAL DO PEDIDO: ${formatCurrency(totalOrderValue)}*\n\n`;
    msg += `Favor confirmar o recebimento e o prazo de entrega deste pedido. Obrigado!`;

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleCopyOrderSummary = () => {
    if (!activeOrderSupplier) return;
    let msg = `*PEDIDO DE COMPRA - ${activeList.fabrica.toUpperCase()}*\n`;
    msg += `Fornecedor: ${activeOrderSupplier.nome}\n`;
    msg += `Contato: ${activeOrderSupplier.contatoNome || 'Vendas'} (${activeOrderSupplier.telefone})\n\n`;
    msg += `ITENS DO PEDIDO:\n`;

    wonItemsForActiveSupplier.forEach((item, idx) => {
      const qty =
        orderQuantities[item.product.id] !== undefined
          ? orderQuantities[item.product.id]
          : item.product.quantidade;
      if (qty > 0) {
        const sub = item.price * qty;
        msg += `${idx + 1}. ${item.product.nome}\n`;
        msg += `   Qtd: ${qty} ${item.product.unidade} | Unit: ${formatCurrency(item.price)} | Subtotal: ${formatCurrency(sub)}\n`;
        if (item.ma) msg += `   Marca: ${item.ma}\n`;
      }
    });

    msg += `\n*VALOR TOTAL:* ${formatCurrency(totalOrderValue)}\n`;
    navigator.clipboard.writeText(msg);
    setCopiedOrderText(true);
    setTimeout(() => setCopiedOrderText(false), 2000);
  };

  const handleOpenOrderPrintModal = () => {
    if (!activeOrderSupplier) return;
    const baseQuote = wonItemsForActiveSupplier[0]?.quote || existingQuote || {
      id: `order-${Date.now()}`,
      listaId: activeList.id,
      fornecedorId: activeOrderSupplier.id,
      itens: {},
      status: 'respondido' as const,
      atualizadoEm: new Date().toISOString(),
    };

    const quoteWithCustomQuantities: SupplierQuote = {
      ...baseQuote,
      fornecedorId: activeOrderSupplier.id,
      itens: Object.fromEntries(
        wonItemsForActiveSupplier.map((item) => {
          const qty =
            orderQuantities[item.product.id] !== undefined
              ? orderQuantities[item.product.id]
              : item.product.quantidade;
          return [
            item.product.id,
            {
              precoUnitario: item.price,
              quantidade: qty,
              ma: item.ma || item.product.marca || '',
            },
          ];
        })
      ),
    };

    onOpenPrintModal(quoteWithCustomQuantities, activeOrderSupplier, activeList);
  };

  // Save current quote
  const handleSaveCurrentQuote = () => {
    if (!activeSupplier) return;

    const newQuote: SupplierQuote = {
      id: existingQuote ? existingQuote.id : `quote-${Date.now()}`,
      listaId: activeList.id,
      fornecedorId: activeSupplier.id,
      itens: quoteItems,
      status: quotedCount > 0 ? 'respondido' : 'pendente',
      preenchidoPor: 'empresa',
      prazoEntrega,
      condicoesPagamento,
      frete,
      observacoesGerais,
      atualizadoEm: new Date().toISOString(),
    };

    onSaveQuote(newQuote);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const supplierQuoteLink = activeSupplier
    ? generateSupplierQuoteLink(
        activeSupplier.id,
        activeList.id,
        activeSupplier.tokenAcesso || 'tok-default',
        {
          supplier: activeSupplier,
          list: activeList,
          products: listProducts,
        }
      )
    : '';

  const handleCopyLink = () => {
    if (!supplierQuoteLink) return;
    navigator.clipboard.writeText(supplierQuoteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!activeSupplier) return;
    const msg = buildWhatsAppQuoteMessage(
      activeSupplier.nome,
      activeList.fabrica,
      listProducts.length,
      supplierQuoteLink,
      activeSupplier.email,
      activeSupplier.senha || 'forn#2026'
    );
    const phone = activeSupplier.telefone.replace(/\D/g, '');
    const url = `https://wa.me/55${phone}?text=${msg}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 w-full min-w-0 overflow-x-hidden">
      {/* Top Header matching Screenshot 3 */}
      <div className="bg-[#0f172a] text-white px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToList}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
              title="Voltar para a Lista"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Área de Cotações</span>
              </h1>
              <p className="text-[10px] text-slate-400">Lançamento e envio para fornecedores</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PDF Button matching Screenshot 3 */}
            <button
              onClick={() => {
                if (existingQuote && activeSupplier) {
                  onOpenPrintModal(existingQuote, activeSupplier, activeList);
                } else {
                  handleSaveCurrentQuote();
                  if (activeSupplier) {
                    onOpenPrintModal(
                      {
                        id: 'temp',
                        listaId: activeList.id,
                        fornecedorId: activeSupplier.id,
                        itens: quoteItems,
                        status: 'respondido',
                        prazoEntrega,
                        condicoesPagamento,
                        frete,
                      },
                      activeSupplier,
                      activeList
                    );
                  }
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            {/* Fornecedores button matching Screenshot 3 */}
            <button
              onClick={onOpenNewSupplier}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Fornecedores</span>
            </button>
          </div>
        </div>

        {/* Sub Tabs matching Screenshot 3: $ Cotar, 🏆 Disputa (3), 📑 Listas (2) */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
          <button
            onClick={() => setSubTab('cotar')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'cotar'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Cotar</span>
          </button>

          <button
            onClick={() => setSubTab('disputa')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'disputa'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Disputa</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-white">
              {quotesForList.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('listas')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'listas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-300" />
            <span>Listas...</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-500 text-white">
              {listProducts.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* SUBTAB 1: COTAR */}
        {subTab === 'cotar' && (
          <>
            {/* Card 1: LISTA DE COMPRAS ATIVA matching Screenshot 3 */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Lista de Compras Ativa:
                </span>
                <button
                  onClick={onManageLists}
                  className="px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Gerenciar Listas
                </button>
              </div>

              <div className="relative">
                <select
                  value={activeListId}
                  onChange={(e) => onSelectList(e.target.value)}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 appearance-none pr-8 cursor-pointer focus:outline-hidden"
                >
                  {lists.length === 0 ? (
                    <option value="">Nenhuma lista cadastrada</option>
                  ) : (
                    lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.fabrica} ({l.nome}){l.isPrincipal ? ' ★' : ''}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Card 2: VOCÊ ESTÁ COTANDO COMO: matching Screenshot 3 */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
                    Você está cotando como:
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  {quotedCount} de {listProducts.length} cotados
                </span>
              </div>

              {enabledSuppliers.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={activeSupplier?.id || ''}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 appearance-none pr-8 cursor-pointer focus:outline-hidden"
                      >
                        {enabledSuppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeSupplier && onEditSupplier && (
                        <button
                          onClick={() => onEditSupplier(activeSupplier)}
                          className="px-3 h-11 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition-all border border-indigo-200 cursor-pointer shadow-2xs"
                          title="Editar Fornecedor Selecionado"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Editar</span>
                        </button>
                      )}
                      <button
                        onClick={onOpenNewSupplier}
                        className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Cadastrar Novo Fornecedor"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {activeSupplier && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
                      <span className="text-emerald-600">📞 {activeSupplier.telefone}</span>
                      <span>•</span>
                      <span>{activeSupplier.contatoNome}</span>
                      <span className="ml-auto text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        Habilitado para {activeList.fabrica}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Nenhum fornecedor habilitado para a fábrica {activeList.fabrica}
                  </div>
                  <p className="text-[11px] text-amber-700 mb-2 leading-relaxed">
                    Esta lista ainda não possui fornecedores habilitados. Você pode editar a lista agora e selecionar os fornecedores que vendem produtos desta fábrica.
                  </p>
                  <button
                    onClick={onManageLists}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    Gerenciar / Habilitar Fornecedores da Lista
                  </button>
                </div>
              )}
            </div>

            {/* Card 3: Link Exclusivo e Sigiloso do Fornecedor matching Screenshot 3 */}
            {activeSupplier && (
              <div className="p-4 bg-gradient-to-br from-blue-50/80 to-slate-50 rounded-3xl border border-blue-200/80 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 leading-snug">
                        Quer que {activeSupplier.nome} preencha seus próprios preços?
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Ele terá acesso <strong>exclusivo e sigiloso</strong>: não verá outros concorrentes nem poderá trocar para outra empresa.
                      </p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-blue-100 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-slate-700">
                      <strong className="text-slate-900">E-MAIL DE ACESSO:</strong> {activeSupplier.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeSupplier.email);
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold ml-2 underline cursor-pointer shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <span className="truncate text-slate-700">
                      <strong className="text-slate-900">SENHA DE ACESSO:</strong> {activeSupplier.senha || 'forn#2026'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeSupplier.senha || 'forn#2026');
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold ml-2 underline cursor-pointer shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* 3 Action Buttons matching Screenshot 3: Copiar Link, WhatsApp, Ver Portal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Copiar Link */}
                  <button
                    onClick={handleCopyLink}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-4 h-4 text-blue-600" />
                    <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={handleOpenWhatsApp}
                    className="py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Ver Portal do Fornecedor */}
                  <button
                    onClick={() => onOpenPortalModal(activeSupplier, activeList)}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Ver Portal</span>
                  </button>
                </div>
              </div>
            )}

            {/* Table / Cards of Products to Price */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Produtos da Lista ({listProducts.length} itens)
                </span>
                {totalQuoteValue > 0 && (
                  <span className="text-xs font-bold text-slate-600">
                    Total: <strong className="text-emerald-700 text-sm font-black">{formatCurrency(totalQuoteValue)}</strong>
                  </span>
                )}
              </div>

              {listProducts.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
                  Nenhum produto cadastrado na lista {activeList.nome}. Volte para a aba LISTA para cadastrar produtos.
                </div>
              ) : (
                listProducts.map((p, idx) => {
                  const pConfig = PRIORITY_CONFIG[p.prioridade];
                  const itemResp = quoteItems[p.id] || {
                    precoUnitario: 0,
                    quantidade: 1,
                    ma: '',
                  };
                  const currentQty =
                    itemResp.quantidade !== undefined &&
                    itemResp.quantidade !== null &&
                    Number(itemResp.quantidade) > 0
                      ? itemResp.quantidade
                      : 1;
                  const subtotal = (Number(itemResp.precoUnitario) || 0) * (Number(currentQty) || 0);

                  return (
                    <div
                      key={p.id}
                      className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all space-y-2.5"
                    >
                      {/* Top: Product Image + Info + Subtotal */}
                      <div className="flex items-start gap-3">
                        {/* Lugar para Imagem do Produto */}
                        <div
                          onClick={() => {
                            if (p.fotoUrl) {
                              setPreviewImage({ url: p.fotoUrl, title: p.nome });
                            }
                          }}
                          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative group select-none ${
                            p.fotoUrl
                              ? 'border-slate-300 bg-white cursor-pointer hover:ring-2 hover:ring-blue-400'
                              : 'border-dashed border-slate-200 bg-slate-50/80'
                          }`}
                          title={p.fotoUrl ? 'Clique para ampliar a foto do produto' : 'Produto sem foto anexada'}
                        >
                          {p.fotoUrl ? (
                            <>
                              <img
                                src={p.fotoUrl}
                                alt={p.nome}
                                className="w-full h-full object-cover rounded-xl"
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <Eye className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 p-1 text-center">
                              <Package className="w-5 h-5 text-slate-300 stroke-[1.6]" />
                              <span className="text-[9px] font-semibold text-slate-400 leading-none mt-1">
                                Foto
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${pConfig.bgColor}`}
                            >
                              {pConfig.label} ({pConfig.letter})
                            </span>
                            {p.marca && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {p.marca}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              #{idx + 1}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {p.nome}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Solicitado: <strong className="text-blue-700">{p.quantidade} {p.unidade}</strong>
                          </p>
                        </div>

                        {/* Subtotal */}
                        {subtotal > 0 && (
                          <div className="text-right shrink-0">
                            <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                              Total
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-700">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Inputs Row: Preço (com máscara à direita), Qtd (inicia com 1), Marca em uma linha única */}
                      <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-100 items-end">
                        {/* Preço com máscara e alinhamento à direita */}
                        <div className="col-span-5 sm:col-span-5">
                          <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                            Preço
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              value={formatBRLInput(itemResp.precoUnitario)}
                              onChange={(e) => {
                                const val = parseBRLInput(e.target.value);
                                handleItemFieldChange(p.id, 'precoUnitario', val);
                              }}
                              className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-black text-slate-900 text-right outline-hidden bg-slate-50/50"
                            />
                          </div>
                        </div>

                        {/* Qtd (sempre inicia com 1) */}
                        <div className="col-span-3 sm:col-span-3">
                          <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                            Qtd
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            placeholder="1"
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              handleItemFieldChange(p.id, 'quantidade', isNaN(val) ? 1 : val);
                            }}
                            className="w-full px-2 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-bold text-slate-900 text-center outline-hidden bg-slate-50/50"
                          />
                        </div>

                        {/* Marca */}
                        <div className="col-span-4 sm:col-span-4">
                          <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                            Marca
                          </label>
                          <input
                            type="text"
                            value={itemResp.ma || ''}
                            onChange={(e) =>
                              handleItemFieldChange(p.id, 'ma', e.target.value)
                            }
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
                            placeholder=""
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-semibold text-slate-800 outline-hidden bg-slate-50/50"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* SUBTAB 2: DISPUTA DE PREÇOS */}
        {subTab === 'disputa' && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-amber-900 uppercase">
                  Disputa de Menor Preço - Fábrica {activeList.fabrica}
                </h3>
              </div>
              <p className="text-xs text-amber-800">
                O fornecedor vencedor (menor preço ou escolhido) aparece sempre em <strong>1º lugar</strong> na lista. Você pode clicar em <strong>"Escolher"</strong> em qualquer outro fornecedor cotado para selecioná-lo para este produto.
              </p>
            </div>

            {/* Price Battle Matrix */}
            <div className="space-y-3">
              {listProducts.map((p) => {
                // Collect only suppliers that actually quoted this product (precoUnitario > 0)
                // Deduplicate by supplierId to avoid multiple rows for same supplier
                const supplierQuotesMap = new Map<
                  string,
                  {
                    supplierId: string;
                    supplierName: string;
                    price: number;
                    ma?: string;
                    quoteId: string;
                  }
                >();

                quotesForList.forEach((q) => {
                  const resp = q.itens[p.id];
                  const price = Number(resp?.precoUnitario) || 0;
                  if (price > 0) {
                    const sup = suppliers.find((s) => s.id === q.fornecedorId);
                    supplierQuotesMap.set(q.fornecedorId, {
                      supplierId: q.fornecedorId,
                      supplierName: sup?.nome || 'Fornecedor',
                      price,
                      ma: resp?.ma,
                      quoteId: q.id,
                    });
                  }
                });

                const quotedRows = Array.from(supplierQuotesMap.values());

                // Calculate automatic lowest price
                const lowestPrice =
                  quotedRows.length > 0
                    ? Math.min(...quotedRows.map((r) => r.price))
                    : Infinity;
                const lowestPriceRow = quotedRows.find((r) => r.price === lowestPrice);

                // Determine winner: user manual choice if set and valid, else lowest price
                const manualChosenId = p.fornecedorEscolhidoId;
                const hasManualChosen =
                  manualChosenId &&
                  quotedRows.some((r) => r.supplierId === manualChosenId);
                const winnerSupplierId = hasManualChosen
                  ? manualChosenId
                  : lowestPriceRow?.supplierId;
                const isCustomChoice =
                  hasManualChosen && manualChosenId !== lowestPriceRow?.supplierId;

                // Sort: winner in 1st place, followed by remaining ordered by price ascending
                const sortedQuotedRows = [...quotedRows].sort((a, b) => {
                  const aIsWinner = a.supplierId === winnerSupplierId;
                  const bIsWinner = b.supplierId === winnerSupplierId;
                  if (aIsWinner) return -1;
                  if (bIsWinner) return 1;
                  return a.price - b.price;
                });

                const winnerRow = sortedQuotedRows.find(
                  (r) => r.supplierId === winnerSupplierId
                );

                return (
                  <div
                    key={p.id}
                    className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                  >
                    {/* Header do Produto */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Imagem do Produto com clique para ampliar */}
                        <div
                          onClick={() => {
                            if (p.fotoUrl) {
                              setPreviewImage({ url: p.fotoUrl, title: p.nome });
                            }
                          }}
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative group select-none ${
                            p.fotoUrl
                              ? 'border-slate-300 bg-white cursor-pointer hover:ring-2 hover:ring-blue-400'
                              : 'border-dashed border-slate-200 bg-slate-50/80'
                          }`}
                          title={p.fotoUrl ? 'Clique para ampliar foto' : 'Sem foto'}
                        >
                          {p.fotoUrl ? (
                            <>
                              <img
                                src={p.fotoUrl}
                                alt={p.nome}
                                className="w-full h-full object-cover rounded-xl"
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <Eye className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            </>
                          ) : (
                            <Package className="w-5 h-5 text-slate-300 stroke-[1.6]" />
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {p.nome}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Qtd: <strong className="text-slate-700">{p.quantidade} {p.unidade}</strong>
                            {p.marca && ` • Marca solicitada: ${p.marca}`}
                          </span>
                        </div>
                      </div>

                      {winnerRow && (
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                            {isCustomChoice ? 'Vencedor Escolhido' : 'Melhor Preço'}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-emerald-700 flex items-center justify-end gap-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {winnerRow.supplierName}: {formatCurrency(winnerRow.price)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Compare only suppliers who quoted, winner 1st, allow selecting any */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {sortedQuotedRows.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                          Nenhum fornecedor cotou este item ainda.
                        </div>
                      ) : (
                        sortedQuotedRows.map((r, idx) => {
                          const isWinner = r.supplierId === winnerSupplierId;

                          return (
                            <div
                              key={r.supplierId}
                              onClick={() => onSelectWinner?.(p.id, r.supplierId)}
                              className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                                isWinner
                                  ? 'bg-emerald-50/95 border-emerald-400 ring-2 ring-emerald-500/25 shadow-xs'
                                  : 'bg-slate-50/80 hover:bg-blue-50/70 border-slate-200 hover:border-blue-300 text-slate-700'
                              }`}
                              title={
                                isWinner
                                  ? 'Fornecedor vencedor atual para este produto'
                                  : 'Clique para escolher este fornecedor para o produto'
                              }
                            >
                              {/* Left: Rank badge, Name, Tag */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black ${
                                    isWinner
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-200/90 text-slate-600'
                                  }`}
                                >
                                  {idx + 1}º
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-xs truncate ${
                                        isWinner
                                          ? 'font-black text-slate-900'
                                          : 'font-semibold text-slate-800'
                                      }`}
                                    >
                                      {r.supplierName}:
                                    </span>
                                    {isWinner && (
                                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-200/80 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                        <Trophy className="w-2.5 h-2.5 text-amber-600" />
                                        {isCustomChoice
                                          ? 'Ganhador Escolhido'
                                          : '1º Lugar (Menor Preço)'}
                                      </span>
                                    )}
                                  </div>
                                  {r.ma && (
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      Marca: {r.ma}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Price & Selection action */}
                              <div className="text-right shrink-0 flex items-center gap-2.5">
                                <div>
                                  <span
                                    className={`text-xs sm:text-sm font-black block ${
                                      isWinner
                                        ? 'text-emerald-700'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {formatCurrency(r.price)}
                                  </span>
                                </div>

                                {isWinner ? (
                                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black shadow-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Vencedor</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectWinner?.(p.id, r.supplierId);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-slate-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                  >
                                    Escolher
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBTAB 3: LISTAS DE PEDIDOS POR FORNECEDOR (CONFORME IMAGEM) */}
        {subTab === 'listas' && (
          <div className="space-y-4">
            {/* Header Card: Listas de Pedidos por Fornecedor com botão PDF e Seletor */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-snug">
                      Listas de Pedidos por Fornecedor
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Produtos onde cada fornecedor teve o melhor preço ou foi escolhido. Edite a quantidade antes de gerar o PDF.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenOrderPrintModal}
                  disabled={!activeOrderSupplier || wonItemsForActiveSupplier.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                  SELECIONE O FORNECEDOR:
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={activeOrderSupplier?.id || ''}
                    onChange={(e) => setSelectedOrderSupplierId(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-slate-300 bg-white font-bold text-xs text-slate-800 focus:border-blue-600 outline-hidden shadow-2xs appearance-none cursor-pointer"
                  >
                    {(enabledSuppliers.length > 0 ? enabledSuppliers : suppliers).map((s) => {
                      const wonCount = wonProductsBySupplier[s.id]?.length || 0;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.nome} ({wonCount} {wonCount === 1 ? 'item' : 'itens'})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Card de Resumo do Pedido do Fornecedor */}
            {activeOrderSupplier && (
              <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
                {/* Banner Verde: Valor Total do Pedido */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                      VALOR TOTAL DO PEDIDO
                    </span>
                    <span className="text-[11px] text-emerald-800 font-medium block mt-0.5">
                      Soma de todos os subtotais dos produtos ganhos
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">
                      {formatCurrency(totalOrderValue)}
                    </span>
                  </div>
                </div>

                {/* Fornecedor, Badge e Contato */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-black text-slate-900">
                      {activeOrderSupplier.nome}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-600" />
                      {wonItemsForActiveSupplier.length} {wonItemsForActiveSupplier.length === 1 ? 'produto ganho' : 'produtos ganhos'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {activeOrderSupplier.telefone || 'Sem telefone'} • {activeOrderSupplier.email || 'Sem e-mail'}
                  </p>
                </div>

                {/* Botões de Ação: WhatsApp, PDF, Copiar */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendOrderWhatsApp}
                    disabled={wonItemsForActiveSupplier.length === 0}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenOrderPrintModal}
                    disabled={wonItemsForActiveSupplier.length === 0}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyOrderSummary}
                    disabled={wonItemsForActiveSupplier.length === 0}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition-all cursor-pointer shadow-2xs"
                    title="Copiar dados do pedido"
                  >
                    {copiedOrderText ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Banner de Aviso Amarelo */}
                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-amber-900 leading-relaxed">
                    <strong>Ajuste as quantidades desejadas abaixo:</strong> você pode aumentar, diminuir ou zerar qualquer produto antes de gerar o PDF ou enviar por WhatsApp.
                  </p>
                </div>
              </div>
            )}

            {/* Lista dos Produtos Ganhos com Stepper de Quantidade */}
            <div className="space-y-3">
              {wonItemsForActiveSupplier.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs space-y-2">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">
                    Nenhum produto ganho por {activeOrderSupplier?.nome || 'este fornecedor'} nesta lista.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Insira cotações na aba "Cotar" ou escolha fornecedores na aba "Disputa" para montar os pedidos automaticamente.
                  </p>
                </div>
              ) : (
                wonItemsForActiveSupplier.map((item, idx) => {
                  const qtyToBuy =
                    orderQuantities[item.product.id] !== undefined
                      ? orderQuantities[item.product.id]
                      : item.product.quantidade;
                  const subtotal = item.price * qtyToBuy;

                  return (
                    <div
                      key={item.product.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                    >
                      {/* Top: Número, Nome do Produto e Stepper de Quantidade */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {item.product.nome}
                            </h4>
                          </div>
                        </div>

                        {/* Stepper QTD A COMPRAR */}
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            QTD A COMPRAR:
                          </span>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderQty(item.product.id, -1)}
                              className="w-7 h-7 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-sm"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qtyToBuy}
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
                              onChange={(e) =>
                                handleSetOrderQty(
                                  item.product.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-12 h-7 rounded-lg border border-slate-300 bg-white text-center font-bold text-xs text-slate-900 focus:border-blue-600 outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderQty(item.product.id, 1)}
                              className="w-7 h-7 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-sm"
                            >
                              +
                            </button>
                            <span className="text-xs font-semibold text-slate-600 min-w-[20px] text-left">
                              {item.product.unidade}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Badge Cotado e Subtotal */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          Cotado: {formatCurrency(item.price)}/{item.product.unidade}
                        </span>
                        <span className="text-xs font-black text-slate-900">
                          Subtotal: {formatCurrency(subtotal)}
                        </span>
                      </div>

                      {/* Bottom: Marca, Badge Menor Preço/Escolhido e Quantidades */}
                      <div className="text-[11px] text-slate-500 space-y-1 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            Marca: <strong className="text-slate-700">{item.ma || item.product.marca || 'Conforme cotação'}</strong>
                          </span>
                          {item.isLowestPrice ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              🏅 Menor Preço
                            </span>
                          ) : item.isManualChoice ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              🏆 Escolhido
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10.5px] text-slate-500">
                          Qtd informada pelo fornecedor: <strong className="text-slate-700">{item.supplierQty} {item.product.unidade}</strong>
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          Necessidade inicial da loja: {item.product.quantidade} {item.product.unidade}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Aviso de itens não cotados (conforme imagem) */}
            {unquotedProducts.length > 0 && (
              <div className="p-4 bg-slate-100/90 rounded-2xl border border-slate-200/90 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">
                  !
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900 leading-snug">
                    {unquotedProducts.length} {unquotedProducts.length === 1 ? 'item ainda não possui' : 'itens ainda não possuem'} nenhuma cotação cadastrada
                  </h5>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Para que apareçam na lista de um fornecedor, insira a cotação na aba "Cotar" ou envie o link do portal para o distribuidor.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Lightbox de Imagem do Produto */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Package className="w-4 h-4 text-blue-400 shrink-0" />
                <h4 className="text-xs font-bold truncate">
                  {previewImage.title}
                </h4>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 flex items-center justify-center min-h-[250px] max-h-[70vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-xs"
              />
            </div>
            <div className="p-3 bg-white flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                Foto de identificação do item
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
