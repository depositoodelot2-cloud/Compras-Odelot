import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
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

  // Salva no Firestore
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  } catch (e) {
    console.error('Erro ao gravar perfil no Firestore:', e);
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

// Firestore Database Instance - Conecta ao banco provisionado no projeto
const rawDatabaseId = (firebaseConfig as any).firestoreDatabaseId;
export const firestoreDbId =
  rawDatabaseId && rawDatabaseId !== '(default)'
    ? rawDatabaseId
    : undefined;

export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);

// Enable persistence if possible
try {
  enableIndexedDbPersistence(db).catch(() => {
    // Already active or unsupported tab, ignore
  });
} catch {
  // Ignore
}

// Test connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.info(`Conexão com Firebase Firestore [${firestoreDbId || 'default'}] estabelecida com sucesso!`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline, utilizing local reactive fallback.');
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
const CURRENT_DATA_VERSION = '2026_09_26_prod_clean';

// Inicializar armazenamento local com dados iniciais se vazio e limpar excessos de cota
export function initializeStorage() {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem(DATA_VERSION_KEY) !== CURRENT_DATA_VERSION) {
      localStorage.clear();
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    } else {
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

// Sincronização em tempo real com Firestore + Fallback reativo instantâneo
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
        if (!snapshot.empty) {
          const remoteData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as T[];

          // Verifica se existem itens locais ainda não propagados para o Firestore remoto
          const localItems = getLocal<T[]>(storageKey, []);
          const remoteIdSet = new Set(remoteData.map((d) => d.id));
          const unsyncedLocal = localItems.filter((i) => i && i.id && !remoteIdSet.has(i.id));

          if (unsyncedLocal.length > 0) {
            unsyncedLocal.forEach((item) => {
              setDoc(doc(db, collectionName, item.id), item, { merge: true }).catch(() => {});
            });
          }

          const combined = [...remoteData, ...unsyncedLocal];
          setLocal(storageKey, combined);
          onUpdate(combined);
        } else {
          // Se o firestore estiver vazio na primeira execução, sobe os dados locais existentes
          if (localData.length > 0) {
            localData.forEach((item) => {
              setDoc(doc(db, collectionName, item.id), item, { merge: true }).catch(() => {});
            });
          }
        }
      },
      (error) => {
        console.warn(`Firestore sync [${collectionName}] em modo local:`, error.message);
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
    unsubscribeFirestore();
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(`sync_${storageKey}`, handleCustomSync);
  };
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

  // Dispara evento para reatividade na mesma janela
  window.dispatchEvent(new CustomEvent(`sync_${storageKey}`, { detail: updatedList }));

  // 2. Persiste no Firestore em tempo real
  try {
    const docRef = doc(db, collectionName, item.id);
    await setDoc(docRef, item, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || (err?.message && err.message.toLowerCase().includes('permissions'))) {
      console.warn(`Firestore [${collectionName}]: Permissão pendente nas Regras de Segurança do Firebase.`);
    } else {
      console.warn(`Erro ao gravar no Firestore (${collectionName}/${item.id}):`, err?.message || err);
    }
  }

  // 3. Persiste no servidor backend se disponível
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionName, item }),
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

  // Dispara evento para reatividade na mesma janela
  window.dispatchEvent(new CustomEvent(`sync_${storageKey}`, { detail: updatedList }));

  // 2. Remove no Firestore
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err: any) {
    if (err?.code === 'permission-denied' || (err?.message && err.message.toLowerCase().includes('permissions'))) {
      console.warn(`Firestore [${collectionName}]: Permissão pendente nas Regras de Segurança do Firebase.`);
    } else {
      console.warn(`Falha na remoção do Firestore (${collectionName}/${id}):`, err?.message || err);
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
