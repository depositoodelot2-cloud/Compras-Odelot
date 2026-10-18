import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  enableIndexedDbPersistence,
  getDocFromServer,
  query,
  where
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

export { doc, getDoc, collection, setDoc, deleteDoc, onSnapshot, getDocs, query, where };
import firebaseConfig from '../firebase-applet-config.json';
import { PurchaseList, ProductItem, Supplier, SupplierQuote, UserProfile, CatalogProduct } from './types';

// Inicialização segura do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  nome: string,
  cargo: string = 'Colaborador',
  role: 'admin' | 'comprador' | 'estoquista' = 'comprador'
): Promise<{ user: FirebaseUser; profile: UserProfile }> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = cred.user;

  try {
    await updateProfile(user, { displayName: nome.trim() });
  } catch {}

  const profile: UserProfile = {
    id: user.uid,
    nome: nome.trim(),
    email: user.email || email.trim(),
    cargo: cargo || 'Colaborador',
    role: role || 'comprador',
    avatar: (nome.trim().charAt(0) || 'U').toUpperCase(),
    cor: '#2563eb',
    ativo: true,
  };

  // Salva no Firestore se a cota permitir
  if (!isFirestoreQuotaExhausted) {
    try {
      await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || (e?.message && e.message.toLowerCase().includes('quota'))) {
        markFirestoreQuotaExhausted();
      } else {
        console.warn('Erro ao gravar perfil no Firestore:', e);
      }
    }
  }

  // Salva no servidor backend local
  try {
    await fetch('/api/auth/register-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  } catch {}

  return { user, profile };
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { FirebaseUser };

// Firestore Database Instance - Conecta ao banco provisionado no projeto com long-polling estável
const rawDatabaseId = (firebaseConfig as any).firestoreDatabaseId;
export const firestoreDbId =
  rawDatabaseId && rawDatabaseId !== '(default)'
    ? rawDatabaseId
    : undefined;

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firestoreDbId
);

// Estado de controle de cota do Firestore para proteção temporária em tempo de execução
let isFirestoreQuotaExhausted = false;

export function markFirestoreQuotaExhausted() {
  if (isFirestoreQuotaExhausted) return;
  isFirestoreQuotaExhausted = true;
  console.info('[Firestore] Cota gratuita temporariamente excedida no banco nomeado. O aplicativo mantém sincronização com o servidor local backend.');
}

export function resetFirestoreQuotaExhausted() {
  isFirestoreQuotaExhausted = false;
  try {
    sessionStorage.removeItem('firestore_quota_exhausted_until');
  } catch {}
}

export function isQuotaExhausted(): boolean {
  return isFirestoreQuotaExhausted;
}

// Test connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    resetFirestoreQuotaExhausted();
    console.info(`Conexão com Firebase Firestore [${firestoreDbId || 'default'}] estabelecida com sucesso!`);
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || (error?.message && error.message.toLowerCase().includes('quota'))) {
      markFirestoreQuotaExhausted();
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase operando em modo offline.");
    }
  }
}
testConnection();

// Initial data arrays - empty for production launch
export const INITIAL_USERS: UserProfile[] = [];
export const INITIAL_LISTS: PurchaseList[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_PRODUCTS: ProductItem[] = [];
export const INITIAL_QUOTES: SupplierQuote[] = [];
export const INITIAL_CATALOG: CatalogProduct[] = [];

// Local storage keys
const STORAGE_KEYS = {
  LISTS: 'app_compras_lists',
  PRODUCTS: 'app_compras_products',
  SUPPLIERS: 'app_compras_suppliers',
  QUOTES: 'app_compras_quotes',
  USERS: 'app_compras_users',
  ACTIVE_USER: 'app_compras_active_user',
  CATALOG: 'app_compras_catalog',
  PRINCIPAL_LIST: 'app_compras_principal_list_id',
  ACTIVE_LIST: 'app_compras_active_list_id',
  CURRENT_TAB: 'app_compras_current_tab',
  QUOTES_SUBTAB: 'app_compras_quotes_subtab',
  ORDER_QUANTITIES: 'app_compras_order_quantities',
  MANUAL_WINNERS: 'app_compras_manual_winners',
  DISPUTE_SELECTIONS: 'app_compras_dispute_selections',
};

// Helper to strip heavy base64 images from items when saving to limited localStorage (Firestore retains the full image)
function sanitizeItemForLocalStorage(item: any): any {
  if (!item || typeof item !== 'object') return item;
  // If item has a massive base64 fotoUrl (> 50KB), strip or trim it for localStorage cache
  if (typeof item.fotoUrl === 'string' && item.fotoUrl.length > 50000) {
    return { ...item, fotoUrl: '' };
  }
  return item;
}

// Local storage helper with robust QuotaExceededError prevention and graceful recovery
export function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

export function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e: any) {
    // Check if error is QuotaExceededError
    const isQuotaError =
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (e?.message && e.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[LocalStorage] Cota excedida ao gravar '${key}'. Aplicando higienização de cache local...`);
      try {
        // Strategy 1: If array of items (like products or catalog), strip heavy base64 photo strings for local cache
        if (Array.isArray(val)) {
          const lightweightVal = val.map(sanitizeItemForLocalStorage);
          localStorage.setItem(key, JSON.stringify(lightweightVal));
          return;
        }

        // Strategy 2: Remove old non-critical keys to free space
        const nonCriticalKeys = [
          'app_compras_quotes',
          'app_compras_clean_version',
          'loglevel',
          'firebase:previous_websocket_failure',
        ];
        nonCriticalKeys.forEach((k) => {
          if (k !== key) {
            try {
              localStorage.removeItem(k);
            } catch {}
          }
        });

        // Try writing again
        localStorage.setItem(key, JSON.stringify(val));
      } catch (recoveryErr) {
        // Safe failover: in-memory state and Firestore handle all persistence without crashing
        console.warn(`[LocalStorage] Não foi possível gravar em cache local '${key}'. O Firestore continuará persistindo os dados.`);
      }
    } else {
      console.warn('Local storage write warning:', e?.message || e);
    }
  }
}

const DATA_VERSION_KEY = 'app_compras_clean_version';
const CURRENT_DATA_VERSION = '2026_10_15_v1';

// Inicializar armazenamento local com dados iniciais se vazio sem apagar a sessão do usuário
export function initializeStorage() {
  if (typeof window !== 'undefined') {
    // Clean oversized base64 cached items if present to prevent quota overflow
    try {
      const productCache = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (productCache && productCache.length > 500000) {
        const parsed = JSON.parse(productCache);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(sanitizeItemForLocalStorage);
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sanitized));
        }
      }
    } catch {}

    try {
      const catalogCache = localStorage.getItem(STORAGE_KEYS.CATALOG);
      if (catalogCache && catalogCache.length > 500000) {
        const parsed = JSON.parse(catalogCache);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(sanitizeItemForLocalStorage);
          localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(sanitized));
        }
      }
    } catch {}
  }

  if (!localStorage.getItem(STORAGE_KEYS.LISTS)) {
    setLocal(STORAGE_KEYS.LISTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    setLocal(STORAGE_KEYS.PRODUCTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLIERS)) {
    setLocal(STORAGE_KEYS.SUPPLIERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUOTES)) {
    setLocal(STORAGE_KEYS.QUOTES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setLocal(STORAGE_KEYS.USERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CATALOG)) {
    setLocal(STORAGE_KEYS.CATALOG, []);
  }
}

export interface ProductStats {
  total: number;
  pendentes: number;
  comprados: number;
  porLista: Record<string, { total: number; pendentes: number; comprados: number }>;
}

export function calculateProductStats(products: ProductItem[]): ProductStats {
  const stats: ProductStats = {
    total: products.length,
    pendentes: 0,
    comprados: 0,
    porLista: {},
  };

  products.forEach((p) => {
    const isComprado = p.status === 'comprado';
    if (isComprado) {
      stats.comprados++;
    } else {
      stats.pendentes++;
    }

    const listaId = p.listaId || 'sem_lista';
    if (!stats.porLista[listaId]) {
      stats.porLista[listaId] = { total: 0, pendentes: 0, comprados: 0 };
    }
    stats.porLista[listaId].total++;
    if (isComprado) {
      stats.porLista[listaId].comprados++;
    } else {
      stats.porLista[listaId].pendentes++;
    }
  });

  return stats;
}

/**
 * Ouvinte em Tempo Real (onSnapshot) do Firestore para Produtos e Cálculo de Totais.
 * Sincroniza ativamente qualquer alteração (adição, edição, compra, exclusão) instantaneamente
 * em todas as telas e celulares sem precisar reiniciar o aplicativo.
 */
export function subscribeToProducts(
  onUpdate: (products: ProductItem[], stats: ProductStats) => void
): () => void {
  // 1. Notifica inicialmente com o cache local para carregamento instantâneo
  const cachedProducts = getLocal<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
  if (cachedProducts && cachedProducts.length > 0) {
    onUpdate(cachedProducts, calculateProductStats(cachedProducts));
  }

  let unsubscribeFirestore = () => {};

  // 2. Conecta o ouvinte onSnapshot diretamente à coleção 'products' do Firestore
  try {
    const colRef = collection(db, 'products');
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        // Mapeia os documentos reais do snapshot do Firestore preservando escolhas manuais ativas
        const manualWinnersMap = getLocal<
          Record<
            string,
            {
              supplierId: string;
              supplierName?: string;
              price?: number;
              isManualSelection: boolean;
              timestamp?: string;
              user?: { id: string; nome: string };
            }
          >
        >(STORAGE_KEYS.MANUAL_WINNERS, {});

        const liveProducts = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as ProductItem;
          const manual = manualWinnersMap[docSnap.id];
          if (manual && manual.isManualSelection) {
            return {
              ...data,
              id: docSnap.id,
              fornecedorEscolhidoId: manual.supplierId,
              fornecedorEscolhidoNome: manual.supplierName || data.fornecedorEscolhidoNome || '',
              isManualSelection: true,
              manualSelectionPrice: manual.price ?? data.manualSelectionPrice,
              manualSelectionTimestamp: manual.timestamp || data.manualSelectionTimestamp,
              manualSelectionUser: manual.user || data.manualSelectionUser,
            };
          }
          return {
            ...data,
            id: docSnap.id,
          };
        }) as ProductItem[];

        // Atualiza o cache local fielmente sem misturar dados fantasmas ou deletados
        setLocal(STORAGE_KEYS.PRODUCTS, liveProducts);

        // Calcula os totais em tempo real diretamente dos dados do Firestore
        const stats = calculateProductStats(liveProducts);

        // Notifica a aplicação e recalcula todas as contagens instantaneamente
        onUpdate(liveProducts, stats);
      },
      (error: any) => {
        console.warn('[Firestore] Ouvinte onSnapshot de produtos:', error?.message || error);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Erro ao iniciar listener onSnapshot de produtos:', err);
  }

  // Ouvinte entre abas do mesmo navegador para sincronização imediata
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.PRODUCTS && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          onUpdate(parsed, calculateProductStats(parsed));
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageChange);

  // Também escuta eventos customizados disparados na mesma janela
  const handleCustomSync = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      onUpdate(e.detail, calculateProductStats(e.detail));
    }
  };
  window.addEventListener(`sync_${STORAGE_KEYS.PRODUCTS}`, handleCustomSync);

  return () => {
    try {
      unsubscribeFirestore();
    } catch {}
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(`sync_${STORAGE_KEYS.PRODUCTS}`, handleCustomSync);
  };
}

// Sincronização em tempo real com Firestore para qualquer coleção
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  storageKey: string,
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  // Inicialmente notifica com os dados locais para carregamento instantâneo
  const localData = getLocal<T[]>(storageKey, initialData);
  onUpdate(localData);

  let unsubscribeFirestore = () => {};

  try {
    const colRef = collection(db, collectionName);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const remoteData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as T[];

        let mergedData = remoteData;
        if (collectionName === 'users') {
          const currentLocal = getLocal<T[]>(storageKey, initialData);
          const map = new Map<string, T>(remoteData.map((item) => [item.id, item]));
          currentLocal.forEach((item) => {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          mergedData = Array.from(map.values());
        }

        // Atualiza o cache local como espelho fiel
        setLocal(storageKey, mergedData);
        // Notifica a UI em tempo real
        onUpdate(mergedData);
      },
      (error: any) => {
        console.warn(`Firestore sync [${collectionName}]:`, error?.message || error);
      }
    );
  } catch (err) {
    console.warn(`Erro ao iniciar listener do Firestore [${collectionName}]:`, err);
  }

  // Ouvinte de eventos no storage local para sincronizar abas do navegador
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === storageKey && e.newValue) {
      try {
        onUpdate(JSON.parse(e.newValue));
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageChange);

  // Também escuta eventos customizados disparados na mesma janela
  const handleCustomSync = (e: any) => {
    if (e.detail) {
      onUpdate(e.detail);
    }
  };
  window.addEventListener(`sync_${storageKey}`, handleCustomSync);

  return () => {
    try {
      unsubscribeFirestore();
    } catch {}
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(`sync_${storageKey}`, handleCustomSync);
  };
}

// Higieniza dados para o Firestore eliminando valores undefined que causam erro no SDK
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeForFirestore) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      clean[key] = null;
    } else if (value !== null && typeof value === 'object') {
      clean[key] = sanitizeForFirestore(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

// Operações de escrita que gravam no Firestore, no LocalStorage e no backend
export async function saveDocument<T extends { id: string }>(
  collectionName: string,
  storageKey: string,
  item: T
) {
  // 1. Atualiza localmente imediatamente para interface instantânea
  const currentList = getLocal<T[]>(storageKey, []);
  const index = currentList.findIndex((i) => i.id === item.id);
  let updatedList: T[];
  if (index >= 0) {
    updatedList = [...currentList];
    updatedList[index] = item;
  } else {
    updatedList = [item, ...currentList];
  }
  setLocal(storageKey, updatedList);

  // Dispara evento para reatividade na mesma janela fora do ciclo síncrono de render
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(`sync_${storageKey}`, { detail: updatedList }));
  }, 0);

  // 2. Persiste no Firestore em tempo real se a cota não estiver esgotada
  if (!isFirestoreQuotaExhausted) {
    try {
      const docRef = doc(db, collectionName, item.id);
      const cleanItem = sanitizeForFirestore(item);
      await setDoc(docRef, cleanItem, { merge: true });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || (err?.message && err.message.toLowerCase().includes('quota'))) {
        markFirestoreQuotaExhausted();
      } else if (err?.code === 'permission-denied' || (err?.message && err.message.toLowerCase().includes('permissions'))) {
        console.warn(`Firestore [${collectionName}]: Permissão pendente nas Regras de Segurança do Firebase.`);
      } else {
        console.warn(`Erro ao gravar no Firestore (${collectionName}/${item.id}):`, err?.message || err);
      }
    }
  }

  // 3. Persiste no servidor backend se disponível
  try {
    const cleanItem = sanitizeForFirestore(item);
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionName, item: cleanItem }),
    }).catch(() => {});
  } catch {}
}

export async function removeDocument<T extends { id: string }>(
  collectionName: string,
  storageKey: string,
  id: string
) {
  // 1. Atualiza localmente imediatamente
  const currentList = getLocal<T[]>(storageKey, []);
  const updatedList = currentList.filter((i) => i.id !== id);
  setLocal(storageKey, updatedList);

  // Dispara evento para reatividade na mesma janela fora do ciclo síncrono de render
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(`sync_${storageKey}`, { detail: updatedList }));
  }, 0);

  // 2. Remove no Firestore se a cota não estiver esgotada
  if (!isFirestoreQuotaExhausted) {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || (err?.message && err.message.toLowerCase().includes('quota'))) {
        markFirestoreQuotaExhausted();
      } else if (err?.code === 'permission-denied' || (err?.message && err.message.toLowerCase().includes('permissions'))) {
        console.warn(`Firestore [${collectionName}]: Permissão pendente nas Regras de Segurança do Firebase.`);
      } else {
        console.warn(`Falha na remoção do Firestore (${collectionName}/${id}):`, err?.message || err);
      }
    }
  }

  // 3. Remove no servidor backend se disponível
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionName, id, action: 'delete' }),
    }).catch(() => {});
  } catch {}
}

// Sincroniza todos os dados locais existentes diretamente para o Firestore
export async function syncAllLocalToFirestore(): Promise<{
  success: boolean;
  count: number;
  error?: string;
  isPermissionError?: boolean;
}> {
  if (isFirestoreQuotaExhausted) {
    return {
      success: false,
      count: 0,
      error: 'A cota diária gratuita do Firestore foi atingida. Seus dados continuam salvos e seguros no servidor local e navegador.',
    };
  }
  let count = 0;
  try {
    const collectionsToSync: Array<{ name: string; key: string }> = [
      { name: 'lists', key: STORAGE_KEYS.LISTS },
      { name: 'products', key: STORAGE_KEYS.PRODUCTS },
      { name: 'suppliers', key: STORAGE_KEYS.SUPPLIERS },
      { name: 'quotes', key: STORAGE_KEYS.QUOTES },
      { name: 'users', key: STORAGE_KEYS.USERS },
      { name: 'catalog', key: STORAGE_KEYS.CATALOG },
    ];

    for (const { name, key } of collectionsToSync) {
      const items = getLocal<any[]>(key, []);
      for (const item of items) {
        if (item && item.id) {
          await setDoc(doc(db, name, item.id), item, { merge: true });
          count++;
        }
      }
    }
    return { success: true, count };
  } catch (err: any) {
    const isPermissionError =
      err?.code === 'permission-denied' ||
      (typeof err?.message === 'string' &&
        err.message.toLowerCase().includes('permissions'));

    if (isPermissionError) {
      console.warn(
        'Firestore: Permissões insuficientes no Firebase. É necessário publicar as Regras de Segurança no console.'
      );
      return {
        success: false,
        count,
        error:
          'Permissões insuficientes no Firestore. As Regras de Segurança no Firebase Console precisam liberar leitura/escrita.',
        isPermissionError: true,
      };
    }

    console.warn('Erro ao sincronizar com Firestore:', err?.message || err);
    return { success: false, count, error: err?.message || String(err) };
  }
}

export async function fetchServerData() {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

export async function clearProductsAndQuotesCache() {
  setLocal(STORAGE_KEYS.PRODUCTS, []);
  setLocal(STORAGE_KEYS.QUOTES, []);
  window.dispatchEvent(new CustomEvent(`sync_${STORAGE_KEYS.PRODUCTS}`, { detail: [] }));
  window.dispatchEvent(new CustomEvent(`sync_${STORAGE_KEYS.QUOTES}`, { detail: [] }));
  try {
    await fetch('/api/clear-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'products' }),
    });
  } catch {}
}

export async function clearFullCache() {
  localStorage.clear();
  initializeStorage();
  try {
    await fetch('/api/clear-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'all' }),
    });
  } catch {}
}

export { STORAGE_KEYS };
