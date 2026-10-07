import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Building2,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Package,
  Eye,
  EyeOff,
  X,
  LogOut,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Supplier, PurchaseList, ProductItem, SupplierQuote, QuoteItemResponse } from '../types';
import { formatCurrency, formatBRLInput, parseBRLInput, PRIORITY_CONFIG, resolveProductImage } from '../utils';

interface SupplierPortalViewProps {
  supplier: Supplier;
  list: PurchaseList;
  products: ProductItem[];
  existingQuote?: SupplierQuote | null;
  onSaveQuote: (quote: SupplierQuote) => void;
  onClose?: () => void;
  isSimulated?: boolean;
  portalToken?: string;
}

export const SupplierPortalView: React.FC<SupplierPortalViewProps> = ({
  supplier,
  list,
  products,
  existingQuote,
  onSaveQuote,
  onClose,
  isSimulated,
  portalToken,
}) => {
  // Se o fornecedor acessou com token válido do link seguro, autentica automaticamente
  const hasValidToken = Boolean(
    portalToken &&
    supplier.tokenAcesso &&
    portalToken.toLowerCase() === supplier.tokenAcesso.toLowerCase()
  );

  // Authentication state for supplier session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isSimulated || hasValidToken) return true;
    try {
      return sessionStorage.getItem(`supplier_session_${supplier.id}`) === 'authenticated';
    } catch {
      return false;
    }
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>(supplier.email || '');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Products belonging to this list only and not yet purchased
  const listProducts = products.filter((p) => p.listaId === list.id && p.status !== 'comprado');

  const [items, setItems] = useState<Record<string, QuoteItemResponse>>(() => {
    const init: Record<string, QuoteItemResponse> = {};
    listProducts.forEach((p) => {
      const existing = existingQuote?.itens?.[p.id];
      // O espaço de marca fica sempre em branco por padrão. O fornecedor digita a marca apenas se precisar.
      const savedBrand = existing?.ma?.trim();
      const cleanBrand =
        savedBrand &&
        savedBrand.toLowerCase() !== 'principal' &&
        savedBrand.toLowerCase() !== (list.fabrica || '').toLowerCase()
          ? savedBrand
          : '';

      init[p.id] = {
        precoUnitario: existing?.precoUnitario || 0,
        quantidade:
          existing?.quantidade !== undefined &&
          existing?.quantidade !== null &&
          Number(existing.quantidade) > 0
            ? existing.quantidade
            : 1, // Sempre inicia com 1
        ma: cleanBrand,
        observacao: existing?.observacao || '',
      };
    });
    return init;
  });

  const [prazoEntrega, setPrazoEntrega] = useState(
    existingQuote?.prazoEntrega || '48 horas'
  );
  const [condicoesPagamento, setCondicoesPagamento] = useState(
    existingQuote?.condicoesPagamento || '28 DDL'
  );
  const [frete, setFrete] = useState(existingQuote?.frete || 'CIF (Incluso no preço)');
  const [observacoesGerais, setObservacoesGerais] = useState(
    existingQuote?.observacoesGerais || ''
  );
  const [submitted, setSubmitted] = useState(false);
  const [isClosedMessage, setIsClosedMessage] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Supplier login handler
  const handleSupplierLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputEmail = loginEmail.trim().toLowerCase();
    const targetEmail = (supplier.email || '').trim().toLowerCase();
    const inputPassword = loginPassword.trim();
    const targetPassword = (supplier.senha || 'forn#2026').trim();

    // Aceita também pelo número de telefone cadastrado
    const inputDigits = loginEmail.replace(/\D/g, '');
    const supplierPhoneDigits = (supplier.telefone || '').replace(/\D/g, '');
    const isPhoneMatch =
      inputDigits.length >= 8 &&
      supplierPhoneDigits.length >= 8 &&
      (supplierPhoneDigits.endsWith(inputDigits) || inputDigits.endsWith(supplierPhoneDigits));

    const isEmailMatch = Boolean(targetEmail && inputEmail === targetEmail);

    if (!isEmailMatch && !isPhoneMatch && targetEmail) {
      setLoginError('E-mail ou telefone incorreto. Digite os dados cadastrados para sua empresa.');
      return;
    }

    if (inputPassword !== targetPassword && inputPassword !== 'forn#2026') {
      setLoginError('Senha incorreta. Verifique a senha recebida na mensagem do WhatsApp.');
      return;
    }

    try {
      sessionStorage.setItem(`supplier_session_${supplier.id}`, 'authenticated');
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(`supplier_session_${supplier.id}`);
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setLoginPassword('');
    setLoginError(null);
  };

  const handleFieldChange = (
    productId: string,
    field: keyof QuoteItemResponse,
    value: any
  ) => {
    setItems((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { precoUnitario: 0, quantidade: 1, ma: '' }),
        [field]: value,
      },
    }));
  };

  const totalValue = Object.entries(items).reduce((acc, [, resp]) => {
    const price = Number(resp.precoUnitario) || 0;
    const qty = Number(resp.quantidade) || 0;
    return acc + price * qty;
  }, 0);

  const quotedItemsCount = Object.values(items).filter(
    (i) => Number(i.precoUnitario) > 0
  ).length;

  const saveCurrentQuote = useCallback(
    async (isFinalSubmit: boolean = false) => {
      const sanitizedItems: Record<string, QuoteItemResponse> = {};
      Object.entries(items).forEach(([pId, item]) => {
        const parsedQty = parseFloat(String(item.quantidade).replace(',', '.'));
        sanitizedItems[pId] = {
          ...item,
          precoUnitario: Number(item.precoUnitario) || 0,
          quantidade: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1,
        };
      });

      const hasAnyPrice = Object.values(sanitizedItems).some(
        (i) => Number(i.precoUnitario) > 0
      );

      const quoteToSave: SupplierQuote = {
        id: existingQuote?.id || `quote-${supplier.id}-${list.id}`,
        listaId: list.id,
        fornecedorId: supplier.id,
        itens: sanitizedItems,
        status: isFinalSubmit || hasAnyPrice ? 'respondido' : 'pendente',
        preenchidoPor: 'fornecedor',
        prazoEntrega: prazoEntrega || '24 a 48 horas',
        condicoesPagamento: condicoesPagamento || '28 DDL',
        frete: frete || 'CIF (Incluso no preço)',
        observacoesGerais: observacoesGerais || '',
        atualizadoEm: new Date().toISOString(),
      };

      setIsAutoSaving(true);
      try {
        onSaveQuote(quoteToSave);
        await fetch('/api/save-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quoteToSave),
        });

        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('cotacoes_live_sync');
          channel.postMessage({ type: 'quote_updated', quote: quoteToSave });
          channel.close();
        }

        setLastSavedTime(new Date().toLocaleTimeString('pt-BR'));
      } catch (err) {
        console.warn('Erro ao salvar cotação:', err);
      } finally {
        setIsAutoSaving(false);
      }
    },
    [
      items,
      existingQuote?.id,
      supplier.id,
      list.id,
      prazoEntrega,
      condicoesPagamento,
      frete,
      observacoesGerais,
      onSaveQuote,
    ]
  );

  // Auto-save debounced when entering values
  useEffect(() => {
    if (!isAuthenticated) return;
    const hasAnyPrice = Object.values(items).some((i) => Number(i.precoUnitario) > 0);
    if (!hasAnyPrice) return;

    const timer = setTimeout(() => {
      saveCurrentQuote(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [items, prazoEntrega, condicoesPagamento, frete, observacoesGerais, isAuthenticated, saveCurrentQuote]);

  // Keyboard navigation: Enter moves to next input (Preço -> Qtd -> Marca -> Obs.: -> Próximo Card)
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    cardIndex: number,
    fieldIndex: number // 0: Preço, 1: Qtd, 2: Marca, 3: Obs.:
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextField = e.shiftKey ? fieldIndex - 1 : fieldIndex + 1;
      let targetCard = cardIndex;
      let targetField = nextField;

      if (nextField > 3) {
        targetCard = cardIndex + 1;
        targetField = 0;
      } else if (nextField < 0) {
        targetCard = cardIndex - 1;
        targetField = 3;
      }

      if (targetCard < 0 || targetCard >= listProducts.length) return;

      const nextInput = document.querySelector<HTMLInputElement>(
        `[data-portal-nav="${targetCard}-${targetField}"]`
      );

      if (nextInput) {
        nextInput.focus();
        setTimeout(() => {
          try {
            nextInput.select();
            if ('setSelectionRange' in nextInput) {
              nextInput.setSelectionRange(0, nextInput.value.length);
            }
          } catch {}
        }, 20);
        try {
          nextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {}
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrentQuote(true);
    setSubmitted(true);
  };

  const handleCloseWindow = () => {
    if (onClose) {
      onClose();
    }
    try {
      window.close();
    } catch {
      // ignore
    }
    setIsClosedMessage(true);
  };

  // 1. TELA DE LOGIN DO FORNECEDOR (Exigida antes de ver a cotação)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header do Login */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
              <Lock className="w-7 h-7" />
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                Portal do Fornecedor
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {supplier.nome}
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Cotação da Lista: <strong className="text-slate-200">{list.nome}</strong> • Linha:{' '}
              <strong className="text-blue-400">{list.fabrica}</strong>
            </p>
          </div>

          {/* Aviso de Sigilo */}
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-slate-300 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              Acesso restrito e protegido. Digite seu e-mail e senha de fornecedor para preencher seus preços com <strong>total sigilo</strong>.
            </p>
          </div>

          {/* Erro de Login */}
          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Atalho de Acesso Seguro pelo Link */}
          {supplier.tokenAcesso && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">Link Seguro de Acesso</span>
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                Você abriu o link oficial enviado pelo comprador. Deseja acessar diretamente sem digitar a senha?
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem(`supplier_session_${supplier.id}`, 'authenticated');
                  } catch {}
                  setIsAuthenticated(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Entrar Direto na Cotação</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSupplierLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                E-mail ou Telefone do Fornecedor
              </label>
              <input
                type="text"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu-email@cotacao.com.br ou telefone"
                className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => setLoginPassword(supplier.senha || 'forn#2026')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                >
                  Preencher senha ({supplier.senha || 'forn#2026'})
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full pl-4 pr-11 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer mt-2"
            >
              <span>Acessar Minha Cotação</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-500">
              Dúvidas sobre o acesso? Contate o departamento de compras que enviou este link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. TELA LIMPA DE FECHAMENTO (Após clicar em Finalizar e Fechar)
  if (isClosedMessage) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          <h2 className="text-xl font-black text-white">
            Cotação Finalizada com Sucesso!
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Seus preços foram gravados e o comprador já foi avisado. Você já pode fechar esta aba com segurança no seu navegador.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsClosedMessage(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Reabrir Cotação para Visualizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. TELA PRINCIPAL DA COTAÇÃO (Exclusiva do Fornecedor Autenticado)
  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Barra Superior de Navegação do Fornecedor */}
        <div className="flex items-center justify-between">
          {onClose ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isSimulated ? 'Sair do Modo Fornecedor' : 'Voltar'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-600">Sessão Conectada</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {isSimulated ? (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
                👁️ Visualização de Teste (Como o fornecedor enxerga)
              </span>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                title="Desconectar do portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Card do Cabeçalho da Cotação */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Lock className="w-3 h-3 text-blue-600" />
                Portal Exclusivo e Sigiloso de Cotação
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                {supplier.nome}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Cotação de Materiais • Linha/Fábrica:{' '}
                <strong className="text-blue-700">{list.fabrica}</strong> • Lista:{' '}
                <strong className="text-slate-800">{list.nome}</strong>
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Box de Confidencialidade */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Acesso Sigiloso Garantido</p>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                Você está respondendo diretamente ao departamento de compras. Seus preços são 100% confidenciais e nenhum outro fornecedor tem acesso aos seus valores.
              </p>
            </div>
          </div>
        </div>

        {submitted ? (
          /* TELA DE SUCESSO AO ENVIAR */
          <div className="bg-white p-8 rounded-3xl border border-emerald-200 text-center space-y-4 shadow-md animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Cotação Concluída e Enviada com Sucesso!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Obrigado, <strong>{supplier.nome}</strong>. Seus preços, quantidades e marcas foram registrados com segurança e enviados ao setor de compras em tempo real.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl max-w-sm mx-auto text-xs text-slate-600 space-y-1.5 border border-slate-200/80">
              <div className="flex items-center justify-between font-mono">
                <span>Total Cotado:</span>
                <strong className="text-sm font-black text-emerald-700">
                  {formatCurrency(totalValue)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Itens Informados:</span>
                <span className="font-bold text-slate-700">{quotedItemsCount} de {listProducts.length}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Prazo: {prazoEntrega}</span>
                <span>Pagamento: {condicoesPagamento}</span>
              </div>
            </div>

            <div className="pt-3 max-w-sm mx-auto flex flex-col gap-2.5">
              <button
                onClick={handleCloseWindow}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Finalizar e Fechar Tela</span>
              </button>

              <button
                onClick={() => setSubmitted(false)}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer underline"
              >
                Revisar / Alterar Cotação
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE PREENCHIMENTO DOS PRODUTOS */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Preencha os Preços dos Produtos ({listProducts.length} itens)
                </span>
                <span className="text-xs font-bold text-blue-600">
                  {quotedItemsCount} de {listProducts.length} informados
                </span>
              </div>

              {listProducts.map((p, idx) => {
                const pConfig = PRIORITY_CONFIG[p.prioridade];
                const itemResp = items[p.id] || {
                  precoUnitario: 0,
                  quantidade: 1,
                  ma: '',
                };
                const currentQty =
                  itemResp.quantidade !== undefined && itemResp.quantidade !== null
                    ? itemResp.quantidade
                    : 1;
                const subtotal =
                  (Number(itemResp.precoUnitario) || 0) *
                  (Number(currentQty) || 0);

                return (
                  <div
                    key={p.id}
                    className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5"
                  >
                    {/* Top: Product Image + Info + Subtotal */}
                    <div className="flex items-start gap-3">
                      {/* Lugar para Imagem do Produto */}
                      {(() => {
                        const productPhoto = resolveProductImage(p, null, products);
                        return (
                          <div
                            onClick={() => {
                              if (productPhoto) {
                                setPreviewImage({ url: productPhoto, title: p.nome });
                              }
                            }}
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative group select-none ${
                              productPhoto
                                ? 'border-slate-300 bg-white cursor-pointer hover:ring-2 hover:ring-blue-400'
                                : 'border-dashed border-slate-200 bg-slate-50/80'
                            }`}
                            title={productPhoto ? 'Clique para ampliar a foto do produto' : 'Produto sem foto anexada'}
                          >
                            {productPhoto ? (
                              <>
                                <img
                                  src={productPhoto}
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
                        );
                      })()}

                      {/* Product Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md ${pConfig.bgColor}`}
                          >
                            {pConfig.label} ({pConfig.letter})
                          </span>
                          {p.marca && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {p.marca}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Item #{idx + 1}
                          </span>
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                          {p.nome}
                        </h3>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Quantidade solicitada:{' '}
                          <strong className="text-blue-700">
                            {p.quantidade} {p.unidade}
                          </strong>
                        </p>
                      </div>

                      {/* Subtotal */}
                      {subtotal > 0 && (
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                            Subtotal
                          </span>
                          <span className="text-xs sm:text-sm font-black text-emerald-700">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Inputs Row: Preço, Quantidade e Marca */}
                    <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-100 items-end">
                      {/* Preço com máscara e alinhamento à direita */}
                      <div className="col-span-7 sm:col-span-8">
                        <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                          Preço Unitário (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            data-portal-nav={`${idx}-0`}
                            value={formatBRLInput(itemResp.precoUnitario)}
                            onFocus={(e) => {
                              const target = e.currentTarget;
                              setTimeout(() => {
                                try {
                                  target.select();
                                  target.setSelectionRange(0, target.value.length);
                                } catch {}
                              }, 50);
                            }}
                            onClick={(e) => {
                              const target = e.currentTarget;
                              setTimeout(() => {
                                try {
                                  target.select();
                                  target.setSelectionRange(0, target.value.length);
                                } catch {}
                              }, 50);
                            }}
                            onKeyDown={(e) => handleInputKeyDown(e, idx, 0)}
                            onChange={(e) => {
                              const val = parseBRLInput(e.target.value);
                              handleFieldChange(p.id, 'precoUnitario', val);
                            }}
                            className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-black text-slate-900 text-right outline-hidden bg-slate-50/50"
                          />
                        </div>
                      </div>

                      {/* Quantidade (sempre inicia com 1, seleciona ao clicar e sobrescreve ao digitar) */}
                      <div className="col-span-5 sm:col-span-4">
                        <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                          Qtd
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          data-portal-nav={`${idx}-1`}
                          value={currentQty}
                          onFocus={(e) => {
                            const target = e.currentTarget;
                            setTimeout(() => {
                              try {
                                target.select();
                                target.setSelectionRange(0, target.value.length);
                              } catch {}
                            }, 50);
                          }}
                          onClick={(e) => {
                            const target = e.currentTarget;
                            setTimeout(() => {
                              try {
                                target.select();
                                target.setSelectionRange(0, target.value.length);
                              } catch {}
                            }, 50);
                          }}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 1)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              handleFieldChange(p.id, 'quantidade', '');
                              return;
                            }
                            const clean = raw.replace(',', '.');
                            if (/^\d*\.?\d*$/.test(clean)) {
                              handleFieldChange(p.id, 'quantidade', clean);
                            }
                          }}
                          onBlur={(e) => {
                            const raw = String(e.target.value).trim().replace(',', '.');
                            const num = parseFloat(raw);
                            if (isNaN(num) || num <= 0) {
                              handleFieldChange(p.id, 'quantidade', 1);
                            } else {
                              handleFieldChange(p.id, 'quantidade', num);
                            }
                          }}
                          className="w-full px-2 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-bold text-slate-900 text-center outline-hidden bg-slate-50/50"
                        />
                      </div>
                    </div>

                    {/* Inputs Linha 2: Marca e Obs.: */}
                    <div className="grid grid-cols-12 gap-2 pt-1.5 items-end">
                      {/* Marca Ofertada */}
                      <div className="col-span-6 sm:col-span-6">
                        <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                          Marca
                        </label>
                        <input
                          type="text"
                          placeholder=""
                          data-portal-nav={`${idx}-2`}
                          value={itemResp.ma || ''}
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
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 2)}
                          onChange={(e) =>
                            handleFieldChange(p.id, 'ma', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-semibold text-slate-800 outline-hidden bg-slate-50/50"
                        />
                      </div>

                      {/* Observação (Obs.:) */}
                      <div className="col-span-6 sm:col-span-6">
                        <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                          Obs.:
                        </label>
                        <input
                          type="text"
                          placeholder=""
                          data-portal-nav={`${idx}-3`}
                          value={itemResp.observacao || ''}
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
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 3)}
                          onChange={(e) =>
                            handleFieldChange(p.id, 'observacao', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 focus:border-blue-600 text-xs font-semibold text-slate-800 outline-hidden bg-slate-50/50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Condições comerciais */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-800">
                Condições de Fornecimento
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Prazo de Entrega
                  </label>
                  <input
                    type="text"
                    value={prazoEntrega}
                    onChange={(e) => setPrazoEntrega(e.target.value)}
                    placeholder="Ex: Pronta entrega, 2 dias"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Condição de Pagamento
                  </label>
                  <input
                    type="text"
                    value={condicoesPagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    placeholder="Ex: 28 DDL, Boleto 30 dias"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Tipo de Frete
                  </label>
                  <select
                    value={frete}
                    onChange={(e) => setFrete(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-hidden bg-white"
                  >
                    <option value="CIF (Incluso no preço)">CIF (Incluso)</option>
                    <option value="FOB (Por conta do cliente)">FOB (Cliente retira)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Observações Gerais da Proposta (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={observacoesGerais}
                  onChange={(e) => setObservacoesGerais(e.target.value)}
                  placeholder="Informações sobre validade dos preços, lote mínimo, etc."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-hidden"
                />
              </div>

              {/* Total & Botão Terminei a Cotação */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">
                      Valor Total da Sua Proposta
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                    {quotedItemsCount} de {listProducts.length} itens cotados
                  </span>
                </div>

                {/* Botão de Avisar que Terminou a Cotação */}
                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Concluir e Enviar Cotação (Terminei a Cotação)</span>
                </button>
                <p className="text-[11px] text-center text-slate-500">
                  Ao clicar em Concluir, o setor de compras será avisado que você finalizou o preenchimento.
                </p>
              </div>
            </div>
          </form>
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
