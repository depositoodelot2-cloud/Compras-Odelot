import { Priority } from './types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatBRLInput(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRLInput(valStr: string): number {
  const digits = valStr.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export const PRIORITY_CONFIG: Record<
  Priority,
  {
    key: Priority;
    letter: string;
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    badgeBg: string;
    pillBg: string;
  }
> = {
  fixo: {
    key: 'fixo',
    letter: 'F',
    label: 'Fixo',
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    badgeBg: 'bg-blue-600 text-white',
    pillBg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  novo: {
    key: 'novo',
    letter: 'N',
    label: 'Novo',
    bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    badgeBg: 'bg-emerald-600 text-white',
    pillBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  },
  cotacao: {
    key: 'cotacao',
    letter: 'C',
    label: 'Cotação',
    bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-600 text-white',
    pillBg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  },
  urgente: {
    key: 'urgente',
    letter: 'U',
    label: 'Urgente',
    bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-300',
    badgeBg: 'bg-rose-600 text-white',
    pillBg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  },
};

export interface PortalPayloadData {
  s: {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
    contatoNome?: string;
    senha?: string;
  };
  l: {
    id: string;
    nome: string;
    fabrica: string;
    descricao?: string;
  };
  p: Array<{
    id: string;
    nome: string;
    marca: string;
    unidade: string;
    quantidade: number;
    prioridade?: string;
    observacao?: string;
    fotoUrl?: string;
  }>;
}

export function encodePortalPayload(data: PortalPayloadData): string {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    // URL-safe base64: replace + with -, / with _, remove padding =
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('Error encoding portal payload:', e);
    return '';
  }
}

export function decodePortalPayload(encoded: string): PortalPayloadData | null {
  try {
    if (!encoded) return null;
    let clean = decodeURIComponent(encoded).trim();
    // Convert URL-safe base64 back to standard base64 and restore padding
    clean = clean.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
    while (clean.length % 4 !== 0) {
      clean += '=';
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Error decoding portal payload:', e);
    return null;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (e) {
    console.error('Fallback clipboard copy failed:', e);
    return false;
  }
}

/**
 * Normaliza número de telefone para formato aceito pelo WhatsApp no Brasil (55 + DDD + Número)
 * Evita duplicação (ex: se já tiver 55, não adiciona outro 55)
 */
export function normalizeWhatsAppNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // Se já começar com 55 e tiver 12 ou 13 dígitos: ex: 5511999998888 ou 553133334444
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Telefone padrão brasileiro com DDD: 10 dígitos (fixo) ou 11 dígitos (celular)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se já tiver código de país internacional ou tamanho >= 11
  if (digits.length >= 11) {
    return digits;
  }

  // Número incompleto (ex: apenas 8 ou 9 dígitos sem DDD)
  return '';
}

/**
 * Sincroniza dados da cotação com o backend server para que links diretos funcionem em qualquer navegador/dispositivo
 */
export async function syncPortalDataToServer(payload: {
  supplier: any;
  list: any;
  products: any[];
  quote?: any;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/sync-portal-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn('Erro ao sincronizar portal com servidor backend:', err);
    return false;
  }
}

export function generateSupplierQuoteLink(
  supplierId: string,
  listId: string,
  token: string,
  context?: {
    supplier?: {
      id: string;
      nome: string;
      email: string;
      telefone?: string;
      contatoNome?: string;
      senha?: string;
    };
    list?: {
      id: string;
      nome: string;
      fabrica: string;
      descricao?: string;
    };
    products?: Array<{
      id: string;
      nome: string;
      marca: string;
      unidade: string;
      quantidade: number;
      prioridade?: string;
      observacao?: string;
      fotoUrl?: string;
    }>;
  }
): string {
  let origin = window.location.origin;
  if (!origin || origin === 'null' || origin.startsWith('about:')) {
    origin = window.location.href.split('?')[0].split('#')[0];
  }

  const url = new URL(origin);
  url.pathname = '/';
  url.search = '';
  url.hash = '';

  url.searchParams.set('portal', 'fornecedor');
  url.searchParams.set('supplierId', supplierId);
  url.searchParams.set('listId', listId);
  if (token) url.searchParams.set('token', token);

  // Inclui payload leve nos parâmetros caso caiba dentro do limite seguro de URL (< 1200 chars)
  if (context?.supplier && context?.list) {
    const payload: PortalPayloadData = {
      s: {
        id: context.supplier.id,
        nome: context.supplier.nome,
        email: context.supplier.email,
        telefone: context.supplier.telefone || '',
        contatoNome: context.supplier.contatoNome || '',
        senha: context.supplier.senha || 'forn#2026',
      },
      l: {
        id: context.list.id,
        nome: context.list.nome,
        fabrica: context.list.fabrica,
        descricao: context.list.descricao || '',
      },
      p: (context.products || []).slice(0, 20).map((p) => ({
        id: p.id,
        nome: p.nome,
        marca: p.marca || '',
        unidade: p.unidade || 'un',
        quantidade: p.quantidade || 1,
        prioridade: p.prioridade || 'cotacao',
        observacao: (p.observacao || '').slice(0, 60),
        fotoUrl: '',
      })),
    };

    try {
      const encoded = encodePortalPayload(payload);
      if (encoded && encoded.length < 1200) {
        url.searchParams.set('data', encoded);
      }
    } catch (e) {
      console.warn('Error encoding lightweight payload:', e);
    }
  }

  return url.toString();
}

export function buildWhatsAppQuoteMessage(
  supplierName: string,
  factoryName: string,
  itemCount: number,
  link: string,
  email?: string,
  senha?: string
): string {
  let credentialsText = '';
  if (email) {
    credentialsText =
      `\n🔑 *Seus dados de acesso exclusivo:*\n` +
      `• *E-mail:* ${email}\n` +
      `• *Senha:* ${senha || 'forn#2026'}\n`;
  }

  return (
    `Olá ${supplierName}, tudo bem?\n\n` +
    `Aqui é do setor de compras. Estamos cotando uma lista de materiais da fábrica *${factoryName}* contendo *${itemCount} itens*.\n\n` +
    `Para agilizar e garantir o melhor preço com total sigilo, preparamos seu portal exclusivo para preencher seus preços, quantidades e marcas disponíveis:\n` +
    `👉 Acesse sua cotação aqui: ${link}\n` +
    credentialsText +
    `\nBasta acessar o link acima, entrar com seu e-mail e senha, preencher os valores e marcas e clicar em *Terminei a Cotação* no final da lista.\n\n` +
    `Aguardamos seu retorno! Obrigado.`
  );
}

export function buildWhatsAppQuoteUrl(
  phone: string | undefined,
  message: string
): string {
  const cleanPhone = normalizeWhatsAppNumber(phone);
  const encodedMsg = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedMsg}`;
}

export const USER_AVATAR_COLORS = [
  '#F59E0B', // Amarelo/Dourado
  '#EC4899', // Rosa
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#8B5CF6', // Roxo
  '#EF4444', // Vermelho
  '#06B6D4', // Ciano
  '#F97316', // Laranja
];

export function getUserColorHex(cor?: string): string {
  if (!cor) return '#3B82F6';
  if (cor.startsWith('#')) return cor;
  if (cor.includes('amber') || cor.includes('yellow')) return '#F59E0B';
  if (cor.includes('pink')) return '#EC4899';
  if (cor.includes('blue') && !cor.includes('cyan')) return '#3B82F6';
  if (cor.includes('green') || cor.includes('emerald') || cor.includes('teal')) return '#10B981';
  if (cor.includes('purple') || cor.includes('violet') || cor.includes('indigo')) return '#8B5CF6';
  if (cor.includes('red') || cor.includes('rose')) return '#EF4444';
  if (cor.includes('cyan')) return '#06B6D4';
  if (cor.includes('orange')) return '#F97316';
  return '#3B82F6';
}

/**
 * Converte todas as palavras de uma string para iniciarem com letra maiúscula (Title Case).
 * Ex: "tubo soldável 25mm 3m" -> "Tubo Soldável 25mm 3m"
 * Ex: "caixa d'água 500l" -> "Caixa D'Água 500l"
 */
export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str.replace(/(?:^|[\s/(\-–—.'"])([a-zà-öø-ÿ])/g, (match) => match.toUpperCase());
}
