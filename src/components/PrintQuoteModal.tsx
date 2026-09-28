import React from 'react';
import { X, Printer, Download, Copy, Check } from 'lucide-react';
import { SupplierQuote, Supplier, PurchaseList, ProductItem } from '../types';
import { formatCurrency, formatDateTime, PRIORITY_CONFIG } from '../utils';

interface PrintQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: SupplierQuote;
  supplier: Supplier;
  list: PurchaseList;
  products: ProductItem[];
}

export const PrintQuoteModal: React.FC<PrintQuoteModalProps> = ({
  isOpen,
  onClose,
  quote,
  supplier,
  list,
  products,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const listProducts = products.filter((p) => p.listaId === list.id && p.status !== 'comprado');

  const total = Object.entries(quote.itens || {}).reduce((acc, [pId, resp]) => {
    return acc + (Number(resp.precoUnitario) || 0) * (Number(resp.quantidade) || 0);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `*MAPA DE COTAÇÃO - ${list.fabrica.toUpperCase()}*\n`;
    text += `Fornecedor: ${supplier.nome}\n`;
    text += `Contato: ${supplier.contatoNome} (${supplier.telefone})\n`;
    text += `Data: ${formatDateTime(quote.atualizadoEm || new Date().toISOString())}\n\n`;
    text += `ITENS COTADOS:\n`;

    listProducts.forEach((p, idx) => {
      const resp = quote.itens?.[p.id];
      const price = resp?.precoUnitario || 0;
      const qty = resp?.quantidade || p.quantidade;
      const sub = price * qty;
      text += `${idx + 1}. ${p.nome} (${p.prioridade.toUpperCase()})\n`;
      text += `   Qtd: ${qty} ${p.unidade} | Unit: ${formatCurrency(price)} | Subtotal: ${formatCurrency(sub)}\n`;
      if (resp?.ma) text += `   Marca/MA: ${resp.ma}\n`;
    });

    text += `\n*VALOR TOTAL:* ${formatCurrency(total)}\n`;
    text += `Prazo: ${quote.prazoEntrega || 'A combinar'} | Pagamento: ${quote.condicoesPagamento || 'A combinar'} | Frete: ${quote.frete || 'A combinar'}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Action Bar */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-800">
              Visualização de Impressão / PDF
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-8 overflow-y-auto space-y-5 flex-1 bg-white text-slate-900 font-sans print:p-0">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  RELATÓRIO DE COTAÇÃO DE COMPRAS
                </h1>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Fábrica / Indústria: <strong className="text-slate-900">{list.fabrica}</strong> • Lista: {list.nome}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500">Data de Emissão:</span>
                <p className="text-xs font-black text-slate-900">
                  {formatDateTime(quote.atualizadoEm || new Date().toISOString())}
                </p>
              </div>
            </div>

            {/* Supplier Meta */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Fornecedor</span>
                <span className="font-bold text-slate-900">{supplier.nome}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Contato</span>
                <span className="font-semibold text-slate-800">{supplier.contatoNome}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Telefone</span>
                <span className="font-semibold text-slate-800">{supplier.telefone}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">E-mail</span>
                <span className="font-semibold text-slate-800 truncate block">{supplier.email}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-black uppercase text-slate-600 bg-slate-50">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Produto</th>
                  <th className="py-2 px-2 text-center">Prioridade</th>
                  <th className="py-2 px-2 text-right">Qtd</th>
                  <th className="py-2 px-2 text-right">Unitário (R$)</th>
                  <th className="py-2 px-2">MA / Marca</th>
                  <th className="py-2 px-2 text-right">Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {listProducts.map((p, idx) => {
                  const resp = quote.itens?.[p.id];
                  const price = resp?.precoUnitario || 0;
                  const qty = resp?.quantidade || p.quantidade;
                  const sub = price * qty;
                  const pConfig = PRIORITY_CONFIG[p.prioridade];

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2 font-bold text-slate-900">{p.nome}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${pConfig.bgColor}`}>
                          {pConfig.letter}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {qty} {p.unidade}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">
                        {formatCurrency(price)}
                      </td>
                      <td className="py-2 px-2 text-slate-600">{resp?.ma || p.marca}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(sub)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Commercial Conditions & Summary */}
          <div className="pt-3 border-t-2 border-slate-900 flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="text-xs space-y-1 text-slate-600">
              <p>
                <strong>Prazo de Entrega:</strong> {quote.prazoEntrega || 'A combinar'}
              </p>
              <p>
                <strong>Condição de Pagamento:</strong> {quote.condicoesPagamento || 'A combinar'}
              </p>
              <p>
                <strong>Frete:</strong> {quote.frete || 'A combinar'}
              </p>
              {quote.observacoesGerais && (
                <p>
                  <strong>Observações:</strong> {quote.observacoesGerais}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 text-right min-w-[200px] shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Valor Total da Cotação
              </span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
