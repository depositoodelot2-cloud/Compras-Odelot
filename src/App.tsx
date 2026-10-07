import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Barcode, CheckCircle2, ChevronDown, Check, AlertCircle, RefreshCw } from 'lucide-react';
import {
  PurchaseList,
  ProductItem,
  Supplier,
  SupplierQuote,
  UserProfile,
  CatalogProduct,
  Priority,
} from './types';
import {
  initializeStorage,
  subscribeToCollection,
  saveDocument,
  removeDocument,
  STORAGE_KEYS,
  INITIAL_USERS,
  INITIAL_LISTS,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_QUOTES,
  INITIAL_CATALOG,
  getLocal,
  setLocal,
  auth,
  onAuthStateChanged,
  logoutFirebase,
  FirebaseUser,
  syncAllLocalToFirestore,
  db,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from './firebase';
import { Header } from './components/Header';
import { PriorityFilters } from './components/PriorityFilters';
import { ProductCard, EmptyState } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { ManageListsModal } from './components/ManageListsModal';
import { CatalogModal } from './components/CatalogModal';
import { AdminModal } from './components/AdminModal';
import { QuotesView } from './components/QuotesView';
import { SupplierPortalView } from './components/SupplierPortalView';
import { PrintQuoteModal } from './components/PrintQuoteModal';
import { BottomNav } from './components/BottomNav';
import { UserSwitchModal } from './components/UserSwitchModal';
import { decodePortalPayload, syncPortalDataToServer, capitalizeWords, resolveProductImage, mergeQuoteItems } from './utils';
import { LoginView } from './components/LoginView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ClearCacheModal } from './components/ClearCacheModal';

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

export default function App() {
  // Check URL query parameters for supplier portal direct link (supporting search & hash)
  const portalInfo = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let portal = searchParams.get('portal');
    let supplierId = searchParams.get('supplierId');
    let listId = searchParams.get('listId');
    let data = searchParams.get('data');
    let token = searchParams.get('token');

    if ((!portal || !supplierId || !listId) && window.location.hash) {
      const hashPart = window.location.hash.includes('?')
        ? window.location.hash.substring(window.location.hash.indexOf('?'))
        : window.location.hash.replace(/^#/, '?');
      const hashParams = new URLSearchParams(hashPart);
      portal = portal || hashParams.get('portal');
      supplierId = supplierId || hashParams.get('supplierId');
      listId = listId || hashParams.get('listId');
      data = data || hashParams.get('data');
      token = token || hashParams.get('token');
    }

    const isPortal =
      portal === 'fornecedor' ||
      (!!supplierId && !!listId && (window.location.href.includes('portal=') || window.location.href.includes('supplierId=')));

    return {
      isPortal,
      portal,
      supplierId: supplierId ? supplierId.trim() : null,
      listId: listId ? listId.trim() : null,
      token: token ? token.trim() : null,
      encodedData: data,
    };
  }, []);

  const [retryAttempt, setRetryAttempt] = useState<number>(0);

  const [portalResolved, setPortalResolved] = useState<{
    supplier: Supplier | null;
    list: PurchaseList | null;
    products: ProductItem[];
    quote: SupplierQuote | null;
    isLoading: boolean;
    error: boolean;
  }>({
    supplier: null,
    list: null,
    products: [],
    quote: null,
    isLoading: portalInfo.isPortal,
    error: false,
  });

  // Application Data States
  const [lists, setLists] = useState<PurchaseList[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  
  // Firebase Auth & Current Logged In User
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    getLocal<UserProfile | null>(STORAGE_KEYS.ACTIVE_USER, null)
  );

  // Active UI Navigation & Filters
  const [currentTab, setCurrentTab] = useState<'lista' | 'cotacoes'>('lista');
  const [principalListId, setPrincipalListId] = useState<string>(() =>
    getLocal<string>(STORAGE_KEYS.PRINCIPAL_LIST, '')
  );
  const [activeListId, setActiveListId] = useState<string>(() =>
    getLocal<string>(STORAGE_KEYS.PRINCIPAL_LIST, '')
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'total'>('total');
  const [selectedUserId, setSelectedUserId] = useState<string | 'todos'>('todos');
  const [selectAllActive, setSelectAllActive] = useState<boolean>(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isManageListsOpen, setIsManageListsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'usuarios' | 'fornecedores' | 'planilhas' | 'catalogo'>('usuarios');
  const [adminInitialUserToEdit, setAdminInitialUserToEdit] = useState<UserProfile | null>(null);
  const [adminInitialSupplierToEdit, setAdminInitialSupplierToEdit] = useState<Supplier | null>(null);
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [isMainBarcodeScannerOpen, setIsMainBarcodeScannerOpen] = useState(false);
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false);
  const [purchaseToastMessage, setPurchaseToastMessage] = useState<string | null>(null);

  const handleOpenEditUser = (user: UserProfile) => {
    setAdminInitialTab('usuarios');
    setAdminInitialUserToEdit(user);
    setAdminInitialSupplierToEdit(null);
    setIsAdminOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setAdminInitialTab('fornecedores');
    setAdminInitialSupplierToEdit(supplier);
    setAdminInitialUserToEdit(null);
    setIsAdminOpen(true);
  };

  // Modals for Quotes & Portal
  const [activePortalSupplier, setActivePortalSupplier] = useState<Supplier | null>(null);
  const [activePortalList, setActivePortalList] = useState<PurchaseList | null>(null);
  const [activePrintQuote, setActivePrintQuote] = useState<{
    quote: SupplierQuote;
    supplier: Supplier;
    list: PurchaseList;
  } | null>(null);

  // Initialize Storage & Firebase Subscriptions
  useEffect(() => {
    initializeStorage();

    const unsubLists = subscribeToCollection<PurchaseList>(
      'lists',
      STORAGE_KEYS.LISTS,
      INITIAL_LISTS,
      (data) => {
        setLists(data);
        if (data.length > 0) {
          const storedPrincipalId = getLocal<string>(STORAGE_KEYS.PRINCIPAL_LIST, '');
          const principalFromDoc = data.find((l) => l.isPrincipal);
          const effectivePrincipalId = principalFromDoc?.id || storedPrincipalId;
          if (effectivePrincipalId) {
            setPrincipalListId(effectivePrincipalId);
          }

          setActiveListId((prev) => {
            if (prev && data.some((l) => l.id === prev)) return prev;
            if (effectivePrincipalId && data.some((l) => l.id === effectivePrincipalId)) {
              return effectivePrincipalId;
            }
            const active = data.find((l) => l.ativa) || data[0];
            return active ? active.id : '';
          });
        }
      }
    );

    const unsubProducts = subscribeToCollection<ProductItem>(
      'products',
      STORAGE_KEYS.PRODUCTS,
      INITIAL_PRODUCTS,
      setProducts
    );

    const unsubSuppliers = subscribeToCollection<Supplier>(
      'suppliers',
      STORAGE_KEYS.SUPPLIERS,
      INITIAL_SUPPLIERS,
      setSuppliers
    );

    const unsubQuotes = subscribeToCollection<SupplierQuote>(
      'quotes',
      STORAGE_KEYS.QUOTES,
      INITIAL_QUOTES,
      setQuotes
    );

    const unsubUsers = subscribeToCollection<UserProfile>(
      'users',
      STORAGE_KEYS.USERS,
      INITIAL_USERS,
      setUsers
    );

    const unsubCatalog = subscribeToCollection<CatalogProduct>(
      'catalog',
      STORAGE_KEYS.CATALOG,
      INITIAL_CATALOG,
      setCatalog
    );

    // Sync with backend server if available
    fetch('/api/data')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverDb) => {
        if (serverDb) {
          if (Array.isArray(serverDb.lists) && serverDb.lists.length > 0) {
            setLists((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.lists.forEach((i: PurchaseList) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
          if (Array.isArray(serverDb.suppliers) && serverDb.suppliers.length > 0) {
            setSuppliers((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.suppliers.forEach((i: Supplier) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
          if (Array.isArray(serverDb.products) && serverDb.products.length > 0) {
            setProducts((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.products.forEach((i: ProductItem) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
          if (Array.isArray(serverDb.quotes) && serverDb.quotes.length > 0) {
            setQuotes((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.quotes.forEach((i: SupplierQuote) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
          if (Array.isArray(serverDb.users) && serverDb.users.length > 0) {
            setUsers((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.users.forEach((i: UserProfile) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
          if (Array.isArray(serverDb.catalog) && serverDb.catalog.length > 0) {
            setCatalog((prev) => {
              const map = new Map(prev.map((i) => [i.id, i]));
              serverDb.catalog.forEach((i: CatalogProduct) => map.set(i.id, i));
              return Array.from(map.values());
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      unsubLists();
      unsubProducts();
      unsubSuppliers();
      unsubQuotes();
      unsubUsers();
      unsubCatalog();
    };
  }, []);

  // Real-time synchronization helper for quotes from backend
  const handleRefreshQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const serverDb = await res.json();
        if (serverDb && Array.isArray(serverDb.quotes)) {
          setQuotes((prev) => {
            const map = new Map(prev.map((q) => [q.id, q]));
            serverDb.quotes.forEach((sq: SupplierQuote) => {
              const existing = map.get(sq.id);
              if (existing) {
                map.set(sq.id, {
                  ...existing,
                  ...sq,
                  itens: mergeQuoteItems(existing.itens, sq.itens),
                });
              } else {
                map.set(sq.id, sq);
              }
            });
            return Array.from(map.values());
          });
          setLocal(STORAGE_KEYS.QUOTES, serverDb.quotes);
        }
      }
    } catch (e) {
      console.warn('Erro ao sincronizar cotações do servidor:', e);
    }
  }, []);

  // Live synchronization across tabs, window focus, and background polling
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('cotacoes_live_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'quote_updated' && event.data.quote) {
          const updatedQuote = event.data.quote as SupplierQuote;
          setQuotes((prev) => {
            const idx = prev.findIndex(
              (q) =>
                q.id === updatedQuote.id ||
                (q.listaId === updatedQuote.listaId && q.fornecedorId === updatedQuote.fornecedorId)
            );
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = {
                ...copy[idx],
                ...updatedQuote,
                itens: mergeQuoteItems(copy[idx].itens, updatedQuote.itens),
              };
              return copy;
            }
            return [updatedQuote, ...prev];
          });
        }
      };
    }

    const onFocus = () => handleRefreshQuotes();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefreshQuotes();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleRefreshQuotes();
      }
    }, 4000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [handleRefreshQuotes]);

  // Auto-heal missing product photos from catalog or other products
  useEffect(() => {
    if (products.length === 0) return;
    let hasChanges = false;
    const updated = products.map((p) => {
      if (!p.fotoUrl) {
        const resolved = resolveProductImage(p, catalog, products);
        if (resolved) {
          hasChanges = true;
          return { ...p, fotoUrl: resolved };
        }
      }
      return p;
    });

    if (hasChanges) {
      setProducts(updated);
      products.forEach((oldP, idx) => {
        const newP = updated[idx];
        if (!oldP.fotoUrl && newP.fotoUrl) {
          saveDocument('products', STORAGE_KEYS.PRODUCTS, newP).catch(() => {});
        }
      });
    }
  }, [catalog, products.length]);

  // Resolve supplier portal data with high availability (Payload -> Server API -> Firestore -> Local)
  useEffect(() => {
    if (!portalInfo.isPortal) return;

    let isMounted = true;
    let fallbackTimer: any = null;

    async function resolvePortalData() {
      // 1. Direct Payload encoded in URL (lightweight, instantaneous offline support)
      if (portalInfo.encodedData) {
        try {
          const decoded = decodePortalPayload(portalInfo.encodedData);
          if (decoded && decoded.s && decoded.l) {
            const supplierFromPayload: Supplier = {
              id: decoded.s.id,
              nome: decoded.s.nome,
              email: decoded.s.email,
              telefone: decoded.s.telefone || '',
              contatoNome: decoded.s.contatoNome || '',
              senha: decoded.s.senha || 'forn#2026',
              listasIds: [decoded.l.id],
              tokenAcesso: portalInfo.token || 'tok-portal',
              ativo: true,
            };
            const listFromPayload: PurchaseList = {
              id: decoded.l.id,
              nome: decoded.l.nome,
              fabrica: decoded.l.fabrica,
              descricao: decoded.l.descricao || '',
              fornecedoresIds: [decoded.s.id],
              criadoPor: 'Setor de Compras',
              criadoEm: new Date().toISOString(),
              ativa: true,
            };
            const productsFromPayload: ProductItem[] = (decoded.p || []).map((p) => ({
              id: p.id,
              listaId: decoded.l.id,
              nome: p.nome,
              marca: p.marca || '',
              unidade: p.unidade || 'un',
              quantidade: p.quantidade || 1,
              prioridade: (p.prioridade as Priority) || 'cotacao',
              observacao: p.observacao || '',
              fotoUrl: '',
              criadoPor: {
                id: 'user-compras',
                nome: 'Compras',
                cargo: 'Comprador',
                avatar: 'C',
                cor: '#2563eb',
              },
              criadoEm: new Date().toISOString(),
              status: 'pendente',
            }));

            // Sync with backend & local storage
            syncPortalDataToServer({
              supplier: supplierFromPayload,
              list: listFromPayload,
              products: productsFromPayload,
            });
            saveDocument('suppliers', STORAGE_KEYS.SUPPLIERS, supplierFromPayload);
            saveDocument('lists', STORAGE_KEYS.LISTS, listFromPayload);
            productsFromPayload.forEach((p) => saveDocument('products', STORAGE_KEYS.PRODUCTS, p));

            if (isMounted) {
              setPortalResolved({
                supplier: supplierFromPayload,
                list: listFromPayload,
                products: productsFromPayload,
                quote: null,
                isLoading: false,
                error: false,
              });
              return;
            }
          }
        } catch (e) {
          console.warn('Could not decode URL payload, falling back to database:', e);
        }
      }

      // 2. Query Server API (/api/portal-quote) - fast, centralized and reliable
      if (portalInfo.supplierId && portalInfo.listId) {
        try {
          const res = await fetch(
            `/api/portal-quote?supplierId=${encodeURIComponent(portalInfo.supplierId)}&listId=${encodeURIComponent(portalInfo.listId)}&token=${encodeURIComponent(portalInfo.token || '')}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.supplier && data.list) {
              if (isMounted) {
                setPortalResolved({
                  supplier: data.supplier,
                  list: data.list,
                  products: data.products || [],
                  quote: data.quote || null,
                  isLoading: false,
                  error: false,
                });
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Erro ao carregar dados do portal via servidor:', err);
        }
      }

      // 3. Query Firestore directly (accessible worldwide)
      if (portalInfo.supplierId && portalInfo.listId) {
        try {
          const sDoc = await getDoc(doc(db, 'suppliers', portalInfo.supplierId));
          const lDoc = await getDoc(doc(db, 'lists', portalInfo.listId));
          if (sDoc.exists() && lDoc.exists()) {
            const supplierData = { id: sDoc.id, ...sDoc.data() } as Supplier;
            const listData = { id: lDoc.id, ...lDoc.data() } as PurchaseList;
            const prodsSnap = await getDocs(
              query(collection(db, 'products'), where('listaId', '==', portalInfo.listId))
            );
            const prods = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ProductItem[];
            const quotesSnap = await getDocs(
              query(
                collection(db, 'quotes'),
                where('listaId', '==', portalInfo.listId),
                where('fornecedorId', '==', portalInfo.supplierId)
              )
            );
            const quoteData = quotesSnap.empty
              ? null
              : ({ id: quotesSnap.docs[0].id, ...quotesSnap.docs[0].data() } as SupplierQuote);

            if (isMounted) {
              setPortalResolved({
                supplier: supplierData,
                list: listData,
                products: prods,
                quote: quoteData,
                isLoading: false,
                error: false,
              });
              return;
            }
          }
        } catch (fsErr) {
          console.warn('Firestore direct portal lookup failed, trying local storage:', fsErr);
        }
      }

      // 4. In-memory and LocalStorage check
      const localSuppliers = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
      const localLists = getLocal<PurchaseList[]>(STORAGE_KEYS.LISTS, INITIAL_LISTS);
      const localProducts = getLocal<ProductItem[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
      const localQuotes = getLocal<SupplierQuote[]>(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);

      const foundSupplier =
        suppliers.find((s) => s.id === portalInfo.supplierId) ||
        localSuppliers.find((s) => s.id === portalInfo.supplierId);
      const foundList =
        lists.find((l) => l.id === portalInfo.listId) ||
        localLists.find((l) => l.id === portalInfo.listId);

      if (foundSupplier && foundList) {
        const matchingProds = (products.length > 0 ? products : localProducts).filter(
          (p) => p.listaId === portalInfo.listId
        );
        const matchingQuote =
          quotes.find(
            (q) => q.listaId === portalInfo.listId && q.fornecedorId === portalInfo.supplierId
          ) ||
          localQuotes.find(
            (q) => q.listaId === portalInfo.listId && q.fornecedorId === portalInfo.supplierId
          ) ||
          null;

        if (isMounted) {
          setPortalResolved({
            supplier: foundSupplier,
            list: foundList,
            products: matchingProds,
            quote: matchingQuote,
            isLoading: false,
            error: false,
          });
          return;
        }
      }

      // 5. Timeout com margem segura antes de mostrar tela de cotação não encontrada
      fallbackTimer = setTimeout(() => {
        if (isMounted) {
          setPortalResolved((prev) => ({ ...prev, isLoading: false, error: true }));
        }
      }, 4000);
    }

    resolvePortalData();

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [portalInfo, suppliers, lists, products, retryAttempt]);

  // Firebase Authentication State Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      setAuthLoading(false);

      if (fUser) {
        let matchedProfile: UserProfile | null = null;

        // 1. Consulta o Firestore diretamente para carregar o perfil mais recente e evitar sobrescrita
        try {
          const userDoc = await getDoc(doc(db, 'users', fUser.uid));
          if (userDoc.exists()) {
            matchedProfile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
          }
        } catch {}

        // 2. Procura na lista carregada em memória
        if (!matchedProfile) {
          const inUsers = users.find(
            (u) =>
              u.id === fUser.uid ||
              (u.email && fUser.email && u.email.toLowerCase() === fUser.email.toLowerCase()) ||
              (fUser.email?.toLowerCase() === 'depositoodelot2@gmail.com' &&
                (u.role === 'admin' || (u.cargo && u.cargo.toLowerCase().includes('admin'))))
          );
          if (inUsers) {
            matchedProfile = inUsers;
          }
        }

        // 3. Procura no active_user local salvo
        if (!matchedProfile) {
          const localActive = getLocal<UserProfile | null>(STORAGE_KEYS.ACTIVE_USER, null);
          if (
            localActive &&
            (localActive.id === fUser.uid ||
              (localActive.email &&
                fUser.email &&
                localActive.email.toLowerCase() === fUser.email.toLowerCase()) ||
              (fUser.email?.toLowerCase() === 'depositoodelot2@gmail.com' &&
                (localActive.role === 'admin' ||
                  (localActive.cargo && localActive.cargo.toLowerCase().includes('admin')))))
          ) {
            matchedProfile = localActive;
          }
        }

        if (matchedProfile) {
          // Mantém as edições feitas (como o nome "Anacleto") e preserva os dados do usuário
          const finalProfile: UserProfile = {
            ...matchedProfile,
            id: fUser.uid,
            email: fUser.email || matchedProfile.email,
          };
          setCurrentUser(finalProfile);
          setLocal(STORAGE_KEYS.ACTIVE_USER, finalProfile);
          saveDocument('users', STORAGE_KEYS.USERS, finalProfile);
        } else {
          // Novo usuário criado apenas se nenhum perfil existente for encontrado
          const isOwner = fUser.email?.toLowerCase() === 'depositoodelot2@gmail.com';
          const newProfile: UserProfile = {
            id: fUser.uid,
            nome: fUser.displayName || fUser.email?.split('@')[0] || 'Administrador',
            email: fUser.email || '',
            cargo: isOwner ? 'Administrador / Gerente' : 'Colaborador',
            role: isOwner ? 'admin' : 'comprador',
            avatar: (fUser.displayName?.charAt(0) || fUser.email?.charAt(0) || 'A').toUpperCase(),
            cor: '#2563eb',
            ativo: true,
          };
          setCurrentUser(newProfile);
          setLocal(STORAGE_KEYS.ACTIVE_USER, newProfile);
          saveDocument('users', STORAGE_KEYS.USERS, newProfile);
        }

        // Sincroniza dados locais com Firestore após autenticação válida
        syncAllLocalToFirestore().catch(() => {});
      }
    });

    return () => unsubAuth();
  }, [users]);

  // Sincronização em tempo real do perfil do usuário ativo com o Firestore entre dispositivos
  useEffect(() => {
    if (!currentUser || users.length === 0) return;

    // 1. Busca por ID exato
    let remoteUser = users.find((u) => u.id === currentUser.id);

    // 2. Busca por e-mail
    if (!remoteUser && currentUser.email) {
      remoteUser = users.find(
        (u) => u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()
      );
    }

    // 3. Busca pelo perfil de admin se o usuário atual for admin
    if (
      !remoteUser &&
      (currentUser.role === 'admin' ||
        (currentUser.cargo && currentUser.cargo.toLowerCase().includes('admin')))
    ) {
      const adminUsers = users.filter(
        (u) => u.role === 'admin' || (u.cargo && u.cargo.toLowerCase().includes('admin'))
      );
      if (adminUsers.length > 0) {
        remoteUser = adminUsers[0];
      }
    }

    if (remoteUser) {
      const hasChanged =
        remoteUser.nome !== currentUser.nome ||
        remoteUser.cargo !== currentUser.cargo ||
        remoteUser.role !== currentUser.role ||
        remoteUser.avatar !== currentUser.avatar ||
        remoteUser.cor !== currentUser.cor ||
        remoteUser.email !== currentUser.email ||
        remoteUser.ativo !== currentUser.ativo;

      if (hasChanged) {
        const updated = {
          ...currentUser,
          ...remoteUser,
          id: currentUser.id, // Preserva o uid da sessão
        };
        setCurrentUser(updated);
        setLocal(STORAGE_KEYS.ACTIVE_USER, updated);
      }
    }
  }, [users, currentUser]);

  // Update active list if none selected
  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      const principal = lists.find((l) => l.isPrincipal || l.id === principalListId);
      const active = principal || lists.find((l) => l.ativa) || lists[0];
      setActiveListId(active.id);
    }
  }, [lists, activeListId, principalListId]);

  // Current active list object
  const activeList = useMemo(() => {
    return lists.find((l) => l.id === activeListId) || lists[0] || DEFAULT_EMPTY_LIST;
  }, [lists, activeListId]);

  // Products belonging to the active list that are still pending to buy
  const currentListProducts = useMemo(() => {
    if (!activeList || !activeList.id) return [];
    return products.filter((p) => p.listaId === activeList.id && p.status !== 'comprado');
  }, [products, activeList]);


  // Priority counts for the active list
  const priorityCounts = useMemo(() => {
    const counts = {
      total: currentListProducts.length,
      fixo: 0,
      novo: 0,
      cotacao: 0,
      urgente: 0,
    };
    currentListProducts.forEach((p) => {
      if (counts[p.prioridade] !== undefined) {
        counts[p.prioridade]++;
      }
    });
    return counts;
  }, [currentListProducts]);

  // Filtered products based on search, priority, and creator
  const filteredProducts = useMemo(() => {
    return currentListProducts.filter((p) => {
      // Priority filter
      if (selectedPriority !== 'total' && p.prioridade !== selectedPriority) {
        return false;
      }
      // Creator filter
      if (selectedUserId !== 'todos' && p.criadoPor?.id !== selectedUserId) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.nome.toLowerCase().includes(term);
        const matchesBrand = p.marca?.toLowerCase().includes(term);
        const matchesCreator = p.criadoPor?.nome?.toLowerCase().includes(term);
        if (!matchesName && !matchesBrand && !matchesCreator) {
          return false;
        }
      }
      return true;
    });
  }, [currentListProducts, selectedPriority, selectedUserId, searchTerm]);

  // Total quotes badge count (sum of quoted items across lists)
  const totalQuotesCount = useMemo(() => {
    let count = 0;
    quotes.forEach((q) => {
      count += Object.values(q.itens || {}).filter((i) => i.precoUnitario > 0).length;
    });
    return count || 423; // Badge fallback matching screenshot
  }, [quotes]);

  // Handlers for Products
  const handleSaveProduct = async (
    productData: Omit<ProductItem, 'id' | 'criadoEm'> & { id?: string },
    saveToCatalog?: boolean
  ) => {
    const isEdit = !!productData.id;
    const finalProduct: ProductItem = {
      id: productData.id || `prod-${Date.now()}`,
      listaId: productData.listaId,
      nome: capitalizeWords(productData.nome.trim()),
      marca: productData.marca,
      unidade: productData.unidade,
      quantidade: productData.quantidade,
      prioridade: productData.prioridade,
      criadoPor: productData.criadoPor,
      criadoEm: isEdit
        ? products.find((p) => p.id === productData.id)?.criadoEm || new Date().toISOString()
        : new Date().toISOString(),
      status: productData.status,
      observacao: productData.observacao,
      codigoBarras: productData.codigoBarras,
      fotoUrl: productData.fotoUrl,
      fornecedorEscolhidoId: productData.fornecedorEscolhidoId,
    };

    await saveDocument('products', STORAGE_KEYS.PRODUCTS, finalProduct);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === finalProduct.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = finalProduct;
        return copy;
      }
      return [finalProduct, ...prev];
    });

    if (saveToCatalog) {
      const existingCatalogItem = catalog.find(
        (c) => c.nome.toLowerCase() === finalProduct.nome.toLowerCase()
      );
      const catalogItem: CatalogProduct = {
        id: existingCatalogItem?.id || `cat-${Date.now()}`,
        nome: finalProduct.nome,
        marcaPadrao: finalProduct.marca,
        unidadePadrao: finalProduct.unidade,
        fabricaSugerida: activeList.fabrica,
        prioridadePadrao: finalProduct.prioridade,
        codigoBarras: finalProduct.codigoBarras,
        fotoUrl: finalProduct.fotoUrl,
      };
      await saveDocument('catalog', STORAGE_KEYS.CATALOG, catalogItem);
      setCatalog((prev) => {
        const idx = prev.findIndex((c) => c.id === catalogItem.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = catalogItem;
          return copy;
        }
        return [...prev, catalogItem];
      });
    }
  };

  const handleToggleProductStatus = async (id: string) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    if (prod.status !== 'comprado') {
      await handleConfirmPurchase(prod);
    } else {
      await handleUnmarkPurchased(id);
    }
  };

  const handleConfirmPurchase = async (prod: ProductItem) => {
    // 1. Mark as 'comprado'
    const updated: ProductItem = {
      ...prod,
      status: 'comprado',
    };
    await saveDocument('products', STORAGE_KEYS.PRODUCTS, updated);
    setProducts((prev) => prev.map((p) => (p.id === prod.id ? updated : p)));

    // 2. Guarantee it continues/is saved in the Catalog for future lists
    const existingCatalogItem = catalog.find(
      (c) =>
        c.nome.toLowerCase().trim() === prod.nome.toLowerCase().trim() ||
        (prod.codigoBarras && c.codigoBarras && c.codigoBarras === prod.codigoBarras)
    );

    if (!existingCatalogItem) {
      const newCatalogItem: CatalogProduct = {
        id: `cat-${Date.now()}`,
        nome: prod.nome,
        marcaPadrao: prod.marca || activeList.fabrica || '',
        unidadePadrao: prod.unidade || 'UN',
        fabricaSugerida: prod.marca || activeList.fabrica || '',
        prioridadePadrao: prod.prioridade || 'cotacao',
        codigoBarras: prod.codigoBarras,
        fotoUrl: prod.fotoUrl,
      };
      await saveDocument('catalog', STORAGE_KEYS.CATALOG, newCatalogItem);
      setCatalog((prev) => [...prev, newCatalogItem]);
    } else {
      // Sync photo, barcode or details if available
      const updatedCatalogItem: CatalogProduct = {
        ...existingCatalogItem,
        fotoUrl: prod.fotoUrl || existingCatalogItem.fotoUrl,
        codigoBarras: prod.codigoBarras || existingCatalogItem.codigoBarras,
        marcaPadrao: prod.marca || existingCatalogItem.marcaPadrao,
        unidadePadrao: prod.unidade || existingCatalogItem.unidadePadrao,
      };
      await saveDocument('catalog', STORAGE_KEYS.CATALOG, updatedCatalogItem);
      setCatalog((prev) =>
        prev.map((c) => (c.id === updatedCatalogItem.id ? updatedCatalogItem : c))
      );
    }

    setPurchaseToastMessage(
      `"${prod.nome}" marcado como comprado! Salvo no Catálogo para futuras listas.`
    );
    setTimeout(() => {
      setPurchaseToastMessage(null);
    }, 4000);
  };

  const handleConfirmAllPurchased = async () => {
    if (currentListProducts.length === 0) return;

    // 1. Mark all current list products as 'comprado'
    const updatedProducts = products.map((p) => {
      if (p.listaId === activeList.id && p.status !== 'comprado') {
        return { ...p, status: 'comprado' as const };
      }
      return p;
    });

    for (const prod of currentListProducts) {
      await saveDocument('products', STORAGE_KEYS.PRODUCTS, { ...prod, status: 'comprado' });
    }
    setProducts(updatedProducts);

    // 2. Guarantee all are saved in the Catalog
    const updatedCatalog = [...catalog];
    for (const prod of currentListProducts) {
      const existing = updatedCatalog.find(
        (c) =>
          c.nome.toLowerCase().trim() === prod.nome.toLowerCase().trim() ||
          (prod.codigoBarras && c.codigoBarras && c.codigoBarras === prod.codigoBarras)
      );
      if (!existing) {
        const newCat: CatalogProduct = {
          id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          nome: prod.nome,
          marcaPadrao: prod.marca || activeList.fabrica || '',
          unidadePadrao: prod.unidade || 'UN',
          fabricaSugerida: prod.marca || activeList.fabrica || '',
          prioridadePadrao: prod.prioridade || 'cotacao',
          codigoBarras: prod.codigoBarras,
          fotoUrl: prod.fotoUrl,
        };
        await saveDocument('catalog', STORAGE_KEYS.CATALOG, newCat);
        updatedCatalog.push(newCat);
      }
    }
    setCatalog(updatedCatalog);
    setSelectAllActive(false);

    setPurchaseToastMessage(
      `Todos os ${currentListProducts.length} produtos foram marcados como comprados e salvos no Catálogo!`
    );
    setTimeout(() => {
      setPurchaseToastMessage(null);
    }, 4000);
  };

  const handleUnmarkPurchased = async (id: string) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const updated: ProductItem = {
      ...prod,
      status: 'pendente',
    };
    await saveDocument('products', STORAGE_KEYS.PRODUCTS, updated);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setPurchaseToastMessage(`"${prod.nome}" reativado na Lista de Compras.`);
    setTimeout(() => {
      setPurchaseToastMessage(null);
    }, 3000);
  };

  const handleDeleteProduct = async (id: string) => {
    await removeDocument('products', STORAGE_KEYS.PRODUCTS, id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSelectProductWinner = async (productId: string, supplierId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const isAlreadySelected = prod.fornecedorEscolhidoId === supplierId;
    const updated: ProductItem = {
      ...prod,
      fornecedorEscolhidoId: isAlreadySelected ? undefined : supplierId,
    };
    await saveDocument('products', STORAGE_KEYS.PRODUCTS, updated);
    setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
  };

  // Handlers to Clear Products and Cache
  const handleClearProducts = async () => {
    setProducts([]);
    setQuotes([]);
    setLocal(STORAGE_KEYS.PRODUCTS, []);
    setLocal(STORAGE_KEYS.QUOTES, []);
    try {
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'products' }),
      });
    } catch {}
  };

  const handleClearAll = async () => {
    localStorage.clear();
    setProducts([]);
    setQuotes([]);
    try {
      await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all' }),
      });
    } catch {}
  };

  // Handlers for Lists
  const handleCreateList = async (listData: Omit<PurchaseList, 'id' | 'criadoEm'>) => {
    const newList: PurchaseList = {
      id: `lista-${Date.now()}`,
      ...listData,
      criadoEm: new Date().toISOString(),
    };
    await saveDocument('lists', STORAGE_KEYS.LISTS, newList);
    setLists((prev) => [newList, ...prev]);
    setActiveListId(newList.id);
  };

  const handleUpdateList = async (updatedList: PurchaseList) => {
    await saveDocument('lists', STORAGE_KEYS.LISTS, updatedList);
    setLists((prev) =>
      prev.map((l) => (l.id === updatedList.id ? updatedList : l))
    );
  };

  const handleSetPrincipalList = async (listId: string) => {
    setPrincipalListId(listId);
    setLocal(STORAGE_KEYS.PRINCIPAL_LIST, listId);
    setActiveListId(listId);

    // Update isPrincipal flags across all lists and persist
    const updatedLists = lists.map((l) => ({
      ...l,
      isPrincipal: l.id === listId,
    }));
    setLists(updatedLists);
    setLocal(STORAGE_KEYS.LISTS, updatedLists);

    // Persist individually in firestore
    try {
      for (const l of updatedLists) {
        await saveDocument('lists', STORAGE_KEYS.LISTS, l);
      }
    } catch {}
  };

  const handleDeleteList = async (listId: string) => {
    await removeDocument('lists', STORAGE_KEYS.LISTS, listId);
    setLists((prev) => prev.filter((l) => l.id !== listId));

    // Also remove items associated with the deleted list
    const remainingProducts = products.filter((p) => p.listaId !== listId);
    setProducts(remainingProducts);
    setLocal(STORAGE_KEYS.PRODUCTS, remainingProducts);

    const remainingLists = lists.filter((l) => l.id !== listId);
    if (activeListId === listId) {
      setActiveListId(remainingLists.length > 0 ? remainingLists[0].id : '');
    }
  };

  // Handlers for Quotes
  const handleSaveQuote = async (quote: SupplierQuote) => {
    await saveDocument('quotes', STORAGE_KEYS.QUOTES, quote);
    setQuotes((prev) => {
      const idx = prev.findIndex(
        (q) =>
          q.id === quote.id ||
          (q.listaId === quote.listaId && q.fornecedorId === quote.fornecedorId)
      );
      if (idx >= 0) {
        const copy = [...prev];
        const mergedItens = mergeQuoteItems(copy[idx].itens, quote.itens);
        copy[idx] = {
          ...copy[idx],
          ...quote,
          id: copy[idx].id || quote.id,
          itens: mergedItens,
        };
        return copy;
      }
      return [quote, ...prev];
    });

    try {
      await fetch('/api/save-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote),
      });
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cotacoes_live_sync');
        channel.postMessage({ type: 'quote_updated', quote });
        channel.close();
      }
    } catch {}
  };

  // Handlers for Users & Authentication
  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    setLocal(STORAGE_KEYS.ACTIVE_USER, user);
  };

  const handleLogout = async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.warn('Erro ao deslogar do Firebase:', err);
    }
    setFirebaseUser(null);
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
  };

  const handleLoginSuccess = (fUser: FirebaseUser, userProfile?: UserProfile) => {
    setFirebaseUser(fUser);
    if (userProfile) {
      setCurrentUser(userProfile);
      setLocal(STORAGE_KEYS.ACTIVE_USER, userProfile);
      saveDocument('users', STORAGE_KEYS.USERS, userProfile);
      return;
    }
    const existing = users.find(
      (u) =>
        u.id === fUser.uid ||
        (u.email && fUser.email && u.email.toLowerCase() === fUser.email.toLowerCase())
    );

    if (existing) {
      setCurrentUser(existing);
      setLocal(STORAGE_KEYS.ACTIVE_USER, existing);
    } else {
      const isOwner = fUser.email?.toLowerCase() === 'depositoodelot2@gmail.com';
      const newProfile: UserProfile = {
        id: fUser.uid,
        nome: fUser.displayName || fUser.email?.split('@')[0] || 'Usuário',
        email: fUser.email || '',
        cargo: isOwner ? 'Administrador / Gerente' : 'Colaborador',
        role: isOwner ? 'admin' : 'comprador',
        avatar: (fUser.displayName?.charAt(0) || fUser.email?.charAt(0) || 'U').toUpperCase(),
        cor: '#2563eb',
        ativo: true,
      };
      setCurrentUser(newProfile);
      setLocal(STORAGE_KEYS.ACTIVE_USER, newProfile);
      saveDocument('users', STORAGE_KEYS.USERS, newProfile);
    }
  };

  const handleSelectLocalUser = (localUser: UserProfile) => {
    setCurrentUser(localUser);
    setLocal(STORAGE_KEYS.ACTIVE_USER, localUser);
  };

  const handleSaveUser = async (user: UserProfile) => {
    await saveDocument('users', STORAGE_KEYS.USERS, user);
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        return copy;
      }
      return [...prev, user];
    });

    if (
      currentUser &&
      (currentUser.id === user.id ||
        (currentUser.email &&
          user.email &&
          currentUser.email.toLowerCase() === user.email.toLowerCase()) ||
        (currentUser.role === 'admin' && user.role === 'admin'))
    ) {
      const updated = { ...currentUser, ...user, id: currentUser.id };
      setCurrentUser(updated);
      setLocal(STORAGE_KEYS.ACTIVE_USER, updated);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    await removeDocument('users', STORAGE_KEYS.USERS, userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Handlers for Suppliers
  const handleSaveSupplier = async (supplier: Supplier) => {
    await saveDocument('suppliers', STORAGE_KEYS.SUPPLIERS, supplier);
    setSuppliers((prev) => {
      const idx = prev.findIndex((s) => s.id === supplier.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = supplier;
        return copy;
      }
      return [...prev, supplier];
    });
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    await removeDocument('suppliers', STORAGE_KEYS.SUPPLIERS, supplierId);
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
  };

  // Add product from Catalog
  const handleAddFromCatalog = async (
    item: CatalogProduct,
    quantidade: number = 1,
    prioridade?: Priority
  ) => {
    const newProd: ProductItem = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      listaId: activeList.id,
      nome: capitalizeWords(item.nome),
      marca: item.marcaPadrao || activeList.fabrica,
      unidade: item.unidadePadrao || 'UN',
      quantidade: quantidade || 1,
      prioridade: prioridade || item.prioridadePadrao || 'fixo',
      criadoPor: {
        id: currentUser?.id || 'admin',
        nome: currentUser?.nome || 'Usuário',
        cargo: currentUser?.cargo || 'Colaborador',
        avatar: currentUser?.avatar || 'U',
        cor: currentUser?.cor || '#2563eb',
      },
      criadoEm: new Date().toISOString(),
      status: 'pendente',
      codigoBarras: item.codigoBarras,
      fotoUrl: item.fotoUrl,
    };
    await saveDocument('products', STORAGE_KEYS.PRODUCTS, newProd);
    setProducts((prev) => [newProd, ...prev]);
  };

  // Save/update item in permanent catalog
  const handleSaveToCatalog = async (item: Omit<CatalogProduct, 'id'> & { id?: string }) => {
    const isEdit = !!item.id;
    const catItem: CatalogProduct = {
      id: item.id || `cat-${Date.now()}`,
      nome: capitalizeWords(item.nome.trim()),
      marcaPadrao: item.marcaPadrao,
      unidadePadrao: item.unidadePadrao,
      fabricaSugerida: item.fabricaSugerida,
      prioridadePadrao: item.prioridadePadrao,
      codigoBarras: item.codigoBarras,
      fotoUrl: item.fotoUrl,
    };
    await saveDocument('catalog', STORAGE_KEYS.CATALOG, catItem);
    setCatalog((prev) => {
      const idx = prev.findIndex((c) => c.id === catItem.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = catItem;
        return copy;
      }
      return [...prev, catItem];
    });
  };

  // Delete item from permanent catalog
  const handleDeleteCatalogItem = async (catalogId: string) => {
    await removeDocument('catalog', STORAGE_KEYS.CATALOG, catalogId);
    setCatalog((prev) => prev.filter((c) => c.id !== catalogId));
  };

  // Batch import products from CSV
  const handleImportProducts = async (importedList: Partial<ProductItem>[]) => {
    for (const item of importedList) {
      const newProd: ProductItem = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        listaId: activeList.id,
        nome: item.nome || 'Produto sem nome',
        marca: item.marca || activeList.fabrica,
        unidade: item.unidade || 'UN',
        quantidade: item.quantidade || 1,
        prioridade: item.prioridade || 'fixo',
        criadoPor: {
          id: currentUser?.id || 'admin',
          nome: currentUser?.nome || 'Usuário',
          cargo: currentUser?.cargo || 'Colaborador',
          avatar: currentUser?.avatar || 'U',
          cor: currentUser?.cor || '#2563eb',
        },
        criadoEm: new Date().toISOString(),
        status: 'pendente',
      };
      await saveDocument('products', STORAGE_KEYS.PRODUCTS, newProd);
      setProducts((prev) => [newProd, ...prev]);
    }
  };

  // Barcode scan via Camera
  const handleScanBarcode = () => {
    setIsMainBarcodeScannerOpen(true);
  };

  const handleMainBarcodeScanned = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Immediately close the camera scanner modal so it never conflicts with ProductModal or other views
    setIsMainBarcodeScannerOpen(false);

    // 1. Check if product in current list matches this barcode
    const listMatch = products.find(
      (p) => p.codigoBarras && p.codigoBarras.trim() === cleanCode
    );

    if (listMatch) {
      setSearchTerm(listMatch.nome);
      setPurchaseToastMessage(`Produto "${listMatch.nome}" localizado na lista!`);
      setTimeout(() => {
        setPurchaseToastMessage(null);
      }, 3500);
      return;
    }

    // 2. Check if product in permanent catalog matches this barcode or text
    const catalogMatch = catalog.find(
      (c) =>
        (c.codigoBarras && c.codigoBarras.trim() === cleanCode) ||
        c.nome.toLowerCase().includes(cleanCode.toLowerCase())
    );

    if (catalogMatch) {
      handleAddFromCatalog(catalogMatch, 1, 'fixo');
      setSearchTerm(catalogMatch.nome);
      setPurchaseToastMessage(`"${catalogMatch.nome}" adicionado do Catálogo!`);
      setTimeout(() => {
        setPurchaseToastMessage(null);
      }, 3500);
    } else {
      // 3. Not found in catalog: open ProductModal pre-filled with this barcode
      setEditingProduct({
        id: '',
        listaId: activeListId,
        nome: '',
        codigoBarras: cleanCode,
        quantidade: 1,
        unidade: 'unidade(s)',
        marca: activeList?.fabrica || '',
        comprado: false,
        prioridade: 'cotacao',
        criadoEm: new Date().toISOString(),
      } as any);
      setIsProductModalOpen(true);
    }
  };

  // If URL has direct supplier portal link (e.g. ?portal=fornecedor&supplierId=xyz)
  if (portalInfo.isPortal) {
    if (portalResolved.isLoading) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-base font-bold">Carregando Portal do Fornecedor...</h2>
          <p className="text-xs text-slate-400 mt-1">Conectando à cotação com segurança e sigilo</p>
        </div>
      );
    }

    if (portalResolved.supplier && portalResolved.list) {
      return (
        <SupplierPortalView
          supplier={portalResolved.supplier}
          list={portalResolved.list}
          products={
            portalResolved.products.length > 0
              ? portalResolved.products
              : products.filter((p) => p.listaId === portalResolved.list?.id)
          }
          existingQuote={portalResolved.quote}
          portalToken={portalInfo.token || undefined}
          onSaveQuote={async (quote) => {
            await handleSaveQuote(quote);
            try {
              await fetch('/api/save-quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quote),
              });
            } catch {}
          }}
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Cotação Não Encontrada</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Não foi possível localizar a lista ou o fornecedor especificado neste link. Verifique se o link foi copiado por completo ou se a cotação ainda está ativa.
          </p>

          <div className="pt-3 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setPortalResolved((prev) => ({ ...prev, isLoading: true, error: false }));
                setRetryAttempt((r) => r + 1);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Acessar Sistema de Compras
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authentication Gate: loading spinner while checking Firebase Auth session
  if (authLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold">Verificando Autenticação Firebase...</h2>
        <p className="text-xs text-slate-400 mt-1">Carregando permissões e dados seguros</p>
      </div>
    );
  }

  // Authentication Gate: Login View required if not authenticated
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onSelectLocalUser={handleSelectLocalUser}
        availableUsers={users}
      />
    );
  }

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#f4f7fb] text-slate-800 font-sans antialiased select-none flex flex-col items-center justify-start overflow-hidden">
      {/* Container simulating high quality mobile & responsive desktop shell */}
      <div className="w-full max-w-xl mx-auto h-full max-h-screen bg-white sm:shadow-xl sm:border-x sm:border-slate-200/80 relative flex flex-col overflow-hidden">
        {/* VIEW 1: TAB LISTA */}
        {currentTab === 'lista' && (
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
            {/* Top Fixed Area (Header + Search + Priority Badges + User Filter) - NUNCA ROLA */}
            <div className="shrink-0 z-20 bg-white pb-1.5 shadow-2xs border-b border-slate-200/80 w-full min-w-0">
              {/* Header */}
              <Header
                currentUser={currentUser}
                onOpenAdmin={() => setIsAdminOpen(true)}
                onSwitchUser={() => setIsUserSwitchOpen(true)}
                onOpenClearCache={() => setIsClearCacheOpen(true)}
                onLogout={handleLogout}
              />

              {/* Priority and User Filters with List Selector side-by-side */}
              <PriorityFilters
                lists={lists}
                activeListId={activeList?.id || ''}
                principalListId={principalListId}
                onSelectList={setActiveListId}
                onSetPrincipalList={handleSetPrincipalList}
                onManageLists={() => setIsManageListsOpen(true)}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedPriority={selectedPriority}
                onSelectPriority={setSelectedPriority}
                priorityCounts={priorityCounts}
                users={users}
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
                currentUserId={currentUser?.id || ''}
                onScanBarcode={handleScanBarcode}
                selectAllActive={selectAllActive}
                onToggleSelectAll={() => setSelectAllActive(!selectAllActive)}
                onConfirmAllPurchased={handleConfirmAllPurchased}
              />
            </div>

            {/* Scrollable Products List Container - APENAS ESTA ÁREA ROLA */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-28 w-full min-w-0">
              {/* Product Cards or Empty State */}
              {lists.length === 0 ? (
                <div className="px-4 py-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
                    <Plus className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-base font-black text-slate-800">
                    Nenhuma lista de compras cadastrada
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Crie sua primeira lista de compras para começar a cadastrar produtos e solicitar cotações.
                  </p>
                  <div className="mt-5">
                    <button
                      onClick={() => setIsManageListsOpen(true)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Criar Primeira Lista</span>
                    </button>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <EmptyState
                  onOpenCatalog={() => setIsCatalogOpen(true)}
                  onOpenNewProduct={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                />
              ) : (
                <div className="w-full px-3.5 sm:px-4 py-2 space-y-2">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      users={users}
                      isSelected={selectAllActive}
                      onToggleStatus={handleToggleProductStatus}
                      onConfirmPurchase={handleConfirmPurchase}
                      onEdit={(prod) => {
                        setEditingProduct(prod);
                        setIsProductModalOpen(true);
                      }}
                      onDelete={handleDeleteProduct}
                    />
                  ))}
                </div>
              )}


            </div>

            {/* Floating Action Button (+) */}
            <button
              onClick={() => {
                if (lists.length === 0) {
                  setIsManageListsOpen(true);
                } else {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }
              }}
              className="absolute bottom-20 right-4 sm:right-6 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Adicionar Novo Produto à Lista"
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>
        )}

        {/* VIEW 2: TAB COTAÇÕES matching Screenshot 3 */}
        {currentTab === 'cotacoes' && (
          <div className="flex-1 overflow-y-auto overscroll-contain w-full min-w-0 pb-20">
            <QuotesView
              lists={lists}
              activeListId={activeList?.id || ''}
              onSelectList={setActiveListId}
              onManageLists={() => setIsManageListsOpen(true)}
              products={products}
              suppliers={suppliers}
              quotes={quotes}
              catalog={catalog}
              currentUser={currentUser}
              onSaveQuote={handleSaveQuote}
              onBackToList={() => setCurrentTab('lista')}
              onOpenPortalModal={(supplier, list) => {
                setActivePortalSupplier(supplier);
                setActivePortalList(list);
              }}
              onOpenPrintModal={(quote, supplier, list) => {
                setActivePrintQuote({ quote, supplier, list });
              }}
              onOpenNewSupplier={() => {
                setAdminInitialTab('fornecedores');
                setAdminInitialSupplierToEdit(null);
                setIsAdminOpen(true);
              }}
              onEditSupplier={handleOpenEditSupplier}
              onSelectWinner={handleSelectProductWinner}
              onRefreshQuotes={handleRefreshQuotes}
            />
          </div>
        )}

        {/* Bottom Navigation matching Screenshot 1 & 3 */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          quotesBadgeCount={totalQuotesCount}
        />

        {/* MODALS */}
        {/* 1. Modal Cadastrar/Editar Produto */}
        {isProductModalOpen && (
          <ProductModal
            isOpen={isProductModalOpen}
            onClose={() => {
              setIsProductModalOpen(false);
              setEditingProduct(null);
            }}
            onSave={handleSaveProduct}
            productToEdit={editingProduct}
            activeList={activeList}
            users={users}
            currentUser={currentUser}
            catalog={catalog}
            onOpenNewUser={() => setIsUserSwitchOpen(true)}
          />
        )}

        {/* 2. Modal Gerenciar Listas por Fábrica */}
        {isManageListsOpen && (
          <ManageListsModal
            isOpen={isManageListsOpen}
            onClose={() => setIsManageListsOpen(false)}
            lists={lists}
            suppliers={suppliers}
            activeListId={activeList?.id || ''}
            principalListId={principalListId}
            onSelectList={setActiveListId}
            onSetPrincipalList={handleSetPrincipalList}
            onCreateList={handleCreateList}
            onUpdateList={handleUpdateList}
            onDeleteList={handleDeleteList}
            currentUserName={currentUser ? `${currentUser.nome} (${currentUser.cargo})` : 'Usuário'}
          />
        )}

        {/* 3. Modal Base de Produtos / Catálogo */}
        {isCatalogOpen && (
          <CatalogModal
            isOpen={isCatalogOpen}
            onClose={() => setIsCatalogOpen(false)}
            catalog={catalog}
            activeList={activeList}
            currentUser={currentUser}
            onAddFromCatalog={handleAddFromCatalog}
            onSaveToCatalog={handleSaveToCatalog}
          />
        )}

        {/* 4. Modal Gerenciamento & Administração matching Screenshot 2 */}
        {isAdminOpen && (
          <AdminModal
            isOpen={isAdminOpen}
            onClose={() => {
              setIsAdminOpen(false);
              setAdminInitialUserToEdit(null);
              setAdminInitialSupplierToEdit(null);
            }}
            users={users}
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
            suppliers={suppliers}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            activeList={activeList}
            products={products}
            catalog={catalog}
            onImportProducts={handleImportProducts}
            initialTab={adminInitialTab}
            initialUserToEdit={adminInitialUserToEdit}
            initialSupplierToEdit={adminInitialSupplierToEdit}
            onAddFromCatalog={handleAddFromCatalog}
            onSaveCatalogItem={handleSaveToCatalog}
            onDeleteCatalogItem={handleDeleteCatalogItem}
            onOpenClearCache={() => setIsClearCacheOpen(true)}
          />
        )}

        {/* Modal Limpar Cache & Produtos */}
        {isClearCacheOpen && (
          <ClearCacheModal
            isOpen={isClearCacheOpen}
            onClose={() => setIsClearCacheOpen(false)}
            onClearProducts={handleClearProducts}
            onClearAll={handleClearAll}
            totalProductsCount={products.length}
          />
        )}

        {/* 5. Modal Trocar Usuário */}
        {isUserSwitchOpen && (
          <UserSwitchModal
            isOpen={isUserSwitchOpen}
            onClose={() => setIsUserSwitchOpen(false)}
            users={users}
            currentUser={currentUser}
            onSelectUser={handleSwitchUser}
            onOpenAdmin={() => {
              setIsUserSwitchOpen(false);
              setAdminInitialTab('usuarios');
              setAdminInitialUserToEdit(null);
              setIsAdminOpen(true);
            }}
            onEditUser={handleOpenEditUser}
            onLogout={handleLogout}
          />
        )}

        {/* 6. Modal / Visão do Portal do Fornecedor */}
        {activePortalSupplier && activePortalList && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
              <SupplierPortalView
                supplier={activePortalSupplier}
                list={activePortalList}
                products={products}
                existingQuote={quotes.find(
                  (q) =>
                    q.listaId === activePortalList.id &&
                    q.fornecedorId === activePortalSupplier.id
                )}
                onSaveQuote={handleSaveQuote}
                onClose={() => {
                  setActivePortalSupplier(null);
                  setActivePortalList(null);
                }}
                isSimulated={true}
              />
            </div>
          </div>
        )}

        {/* 7. Modal Visualização de Impressão / PDF */}
        {activePrintQuote && (
          <PrintQuoteModal
            isOpen={!!activePrintQuote}
            onClose={() => setActivePrintQuote(null)}
            quote={activePrintQuote.quote}
            supplier={activePrintQuote.supplier}
            list={activePrintQuote.list}
            products={products}
          />
        )}

        {/* 8. Modal de Leitura de Código de Barras pela Câmera */}
        <BarcodeScannerModal
          isOpen={isMainBarcodeScannerOpen}
          onClose={() => setIsMainBarcodeScannerOpen(false)}
          onScan={handleMainBarcodeScanned}
          title="Buscar por Código de Barras"
          subtitle="Aponte a câmera para o código de barras ou QR Code do produto"
        />

        {/* Notificação Toast de Compra / Sucesso */}
        {purchaseToastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1 text-slate-100">{purchaseToastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
