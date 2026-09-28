export type Priority = 'fixo' | 'novo' | 'cotacao' | 'urgente';

export interface UserProfile {
  id: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'comprador' | 'estoquista';
  avatar: string;
  cor: string;
  email: string;
  ativo: boolean;
  username?: string;
  senha?: string;
}

export interface PurchaseList {
  id: string;
  nome: string;
  fabrica: string;
  descricao?: string;
  fornecedoresIds: string[];
  criadoPor: string;
  criadoEm: string;
  ativa: boolean;
  isPrincipal?: boolean;
}

export interface ProductItem {
  id: string;
  listaId: string;
  nome: string;
  marca: string;
  unidade: string;
  quantidade: number;
  prioridade: Priority;
  criadoPor: {
    id: string;
    nome: string;
    cargo: string;
    avatar: string;
    cor: string;
  };
  criadoEm: string;
  status: 'pendente' | 'comprado';
  observacao?: string;
  codigoBarras?: string;
  fotoUrl?: string;
  fornecedorEscolhidoId?: string;
}

export interface Supplier {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  contatoNome: string;
  listasIds: string[];
  tokenAcesso: string;
  ativo: boolean;
  senha?: string;
}

export interface QuoteItemResponse {
  precoUnitario: number;
  quantidade: number;
  ma: string; // Margem ou Marca/Modelo oferecido
  observacao?: string;
}

export interface SupplierQuote {
  id: string;
  listaId: string;
  fornecedorId: string;
  itens: Record<string, QuoteItemResponse>;
  status: 'pendente' | 'respondido';
  preenchidoPor?: 'fornecedor' | 'empresa';
  prazoEntrega?: string;
  condicoesPagamento?: string;
  frete?: string;
  observacoesGerais?: string;
  atualizadoEm?: string;
}

export interface CatalogProduct {
  id: string;
  nome: string;
  marcaPadrao: string;
  unidadePadrao: string;
  fabricaSugerida: string;
  prioridadePadrao: Priority;
  codigoBarras?: string;
  fotoUrl?: string;
}
