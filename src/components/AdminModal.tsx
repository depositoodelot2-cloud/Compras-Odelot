import React, { useState, useEffect } from 'react';
import {
  Shield,
  X,
  FileSpreadsheet,
  Package,
  Truck,
  Users,
  UserPlus,
  UserCheck,
  LogOut,
  Power,
  Edit2,
  Trash2,
  Check,
  Plus,
  KeyRound,
  Download,
  Upload,
  ExternalLink,
  Phone,
  Mail,
  Copy,
  Camera,
  Image as ImageIcon,
  ScanBarcode,
  MoreVertical,
  Search,
  Edit3,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff,
  ZoomIn
} from 'lucide-react';
import { UserProfile, Supplier, PurchaseList, ProductItem, CatalogProduct, Priority } from '../types';
import { USER_AVATAR_COLORS, getUserColorHex, capitalizeWords } from '../utils';
import { CameraModal } from './CameraModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ImageZoomModal } from './ImageZoomModal';
import { compressImage } from '../utils/imageUtils';
import { syncAllLocalToFirestore } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
  onSaveUser: (user: UserProfile) => void;
  onDeleteUser: (userId: string) => void;
  suppliers: Supplier[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  activeList: PurchaseList;
  products: ProductItem[];
  catalog: CatalogProduct[];
  onImportProducts: (imported: Partial<ProductItem>[]) => void;
  initialTab?: 'usuarios' | 'fornecedores' | 'planilhas' | 'catalogo';
  initialUserToEdit?: UserProfile | null;
  initialSupplierToEdit?: Supplier | null;
  onAddFromCatalog?: (item: CatalogProduct, quantidade?: number, prioridade?: Priority) => void;
  onSaveCatalogItem?: (item: Omit<CatalogProduct, 'id'> & { id?: string }) => void;
  onDeleteCatalogItem?: (id: string) => void;
  onOpenClearCache?: () => void;
}

type AdminTab = 'usuarios' | 'fornecedores' | 'planilhas' | 'catalogo';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSwitchUser,
  onSaveUser,
  onDeleteUser,
  onOpenClearCache,
  suppliers,
  onSaveSupplier,
  onDeleteSupplier,
  activeList,
  products,
  catalog,
  onImportProducts,
  initialTab,
  initialUserToEdit,
  initialSupplierToEdit,
  onAddFromCatalog,
  onSaveCatalogItem,
  onDeleteCatalogItem,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || 'usuarios');
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('123');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'comprador' | 'estoquista'>('admin');
  const [newUserCargo, setNewUserCargo] = useState('Gerente');
  const [newUserCor, setNewUserCor] = useState('#F97316');
  const [newUserAtivo, setNewUserAtivo] = useState(true);
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);

  // Supplier state
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierSenha, setNewSupplierSenha] = useState('');
  const [showSupplierPassword, setShowSupplierPassword] = useState(true);
  const [copiedSupplierPassword, setCopiedSupplierPassword] = useState(false);
  const [copiedSupplierCardId, setCopiedSupplierCardId] = useState<string | null>(null);

  // Helper to generate a random password for supplier
  const generateRandomPassword = (name?: string) => {
    const cleanPrefix = name
      ? name
          .trim()
          .split(' ')[0]
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
      : 'forn';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${cleanPrefix || 'forn'}#${randomNum}`;
  };

  // Catalog tab state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogProduct | null>(null);
  const [catalogNome, setCatalogNome] = useState('');
  const [catalogCodigoBarras, setCatalogCodigoBarras] = useState('');
  const [catalogMarca, setCatalogMarca] = useState('');
  const [catalogUnidade, setCatalogUnidade] = useState('UN');
  const [catalogPrioridade, setCatalogPrioridade] = useState<Priority>('cotacao');
  const [catalogFotoUrl, setCatalogFotoUrl] = useState('');
  const [isCatalogCameraOpen, setIsCatalogCameraOpen] = useState(false);
  const [isCatalogBarcodeScannerOpen, setIsCatalogBarcodeScannerOpen] = useState(false);
  const [isSearchBarcodeScannerOpen, setIsSearchBarcodeScannerOpen] = useState(false);
  const [activeCatalogMenuId, setActiveCatalogMenuId] = useState<string | null>(null);
  const [addedCatalogIds, setAddedCatalogIds] = useState<Record<string, boolean>>({});
  const [zoomedCatalogProduct, setZoomedCatalogProduct] = useState<CatalogProduct | null>(null);

  // Import text
  const [csvText, setCsvText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);
  const [supplierToDeleteId, setSupplierToDeleteId] = useState<string | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'permission';
    message: string;
  } | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);

  const handleForceSyncFirebase = async () => {
    setIsSyncingFirebase(true);
    setSyncStatus(null);
    try {
      const result = await syncAllLocalToFirestore();
      if (result.success) {
        setSyncStatus({
          type: 'success',
          message: `Sincronizado! ${result.count} registro(s) enviados ao Firebase com sucesso.`
        });
      } else if (result.isPermissionError) {
        setSyncStatus({
          type: 'permission',
          message: 'Permissões insuficientes no Firestore (Regras de Segurança bloqueadas).'
        });
      } else {
        setSyncStatus({
          type: 'error',
          message: result.error || 'Erro ao sincronizar com o Firebase.'
        });
      }
    } catch {
      setSyncStatus({
        type: 'error',
        message: 'Falha de conexão com o Firebase.'
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const copyFirestoreRulesToClipboard = () => {
    const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
    navigator.clipboard.writeText(rules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 3000);
  };

  const catalogPriorityCounts = {
    fixo: (catalog || []).filter((c) => (c.prioridadePadrao || 'cotacao') === 'fixo').length,
    novo: (catalog || []).filter((c) => c.prioridadePadrao === 'novo').length,
    cotacao: (catalog || []).filter((c) => (c.prioridadePadrao || 'cotacao') === 'cotacao').length,
    urgente: (catalog || []).filter((c) => c.prioridadePadrao === 'urgente').length,
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setActiveTab(initialTab);
    if (initialUserToEdit) {
      setActiveTab('usuarios');
      setEditingUser(initialUserToEdit);
      setNewUserName(initialUserToEdit.nome);
      setNewUserUsername(
        initialUserToEdit.username ||
        initialUserToEdit.email.split('@')[0] ||
        initialUserToEdit.nome.toLowerCase().replace(/\s+/g, '')
      );
      setNewUserSenha(initialUserToEdit.senha || '123');
      setNewUserRole(initialUserToEdit.role);
      setNewUserCargo(initialUserToEdit.cargo || 'Comprador');
      setNewUserCor(getUserColorHex(initialUserToEdit.cor));
      setNewUserAtivo(initialUserToEdit.ativo !== false);
      setShowNewUserForm(true);
      setShowSwitchDropdown(false);
    } else if (initialSupplierToEdit) {
      setActiveTab('fornecedores');
      setEditingSupplier(initialSupplierToEdit);
      setNewSupplierName(initialSupplierToEdit.nome);
      setNewSupplierEmail(initialSupplierToEdit.email);
      setNewSupplierPhone(initialSupplierToEdit.telefone);
      setNewSupplierContact(initialSupplierToEdit.contatoNome);
      setShowNewSupplierForm(true);
    }
  }, [isOpen, initialTab, initialUserToEdit, initialSupplierToEdit]);

  if (!isOpen) return null;

  const handleOpenNewUser = () => {
    const usedColors = users.map((u) => getUserColorHex(u.cor).toLowerCase());
    const nextColor =
      USER_AVATAR_COLORS.find((c) => !usedColors.includes(c.toLowerCase())) ||
      USER_AVATAR_COLORS[users.length % USER_AVATAR_COLORS.length];

    setEditingUser(null);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserSenha('123');
    setNewUserRole('comprador');
    setNewUserCargo('Comprador');
    setNewUserCor(nextColor);
    setNewUserAtivo(true);
    setShowNewUserForm(true);
    setShowSwitchDropdown(false);
  };

  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setNewUserName(u.nome);
    setNewUserUsername(
      u.username || u.email.split('@')[0] || u.nome.toLowerCase().replace(/\s+/g, '')
    );
    setNewUserSenha(u.senha || '123');
    setNewUserRole(u.role);
    setNewUserCargo(u.cargo || 'Comprador');
    setNewUserCor(getUserColorHex(u.cor));
    setNewUserAtivo(u.ativo !== false);
    setShowNewUserForm(true);
    setShowSwitchDropdown(false);
  };

  const handleSaveUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    const usernameClean =
      newUserUsername.trim() ||
      newUserName.trim().toLowerCase().replace(/\s+/g, '');
    const emailClean = `${usernameClean}@empresa.com.br`;
    const initial = newUserName.trim().charAt(0).toUpperCase();
    const positionClean = newUserCargo.trim() || 'Colaborador';
    const isRoleAdmin =
      positionClean.toLowerCase().includes('admin') ||
      positionClean.toLowerCase().includes('gerente') ||
      positionClean.toLowerCase().includes('diretor') ||
      newUserRole === 'admin';
    const isRoleEstoquista = positionClean.toLowerCase().includes('estoqu');
    const derivedRole: 'admin' | 'comprador' | 'estoquista' = isRoleAdmin
      ? 'admin'
      : isRoleEstoquista
      ? 'estoquista'
      : 'comprador';

    const finalEmail =
      editingUser && editingUser.email && !editingUser.email.endsWith('@empresa.com.br')
        ? editingUser.email
        : (editingUser?.email || emailClean);

    if (editingUser) {
      const updatedUser: UserProfile = {
        ...editingUser,
        nome: newUserName.trim(),
        cargo: positionClean,
        role: derivedRole,
        email: finalEmail,
        username: usernameClean,
        senha: newUserSenha.trim() || '123',
        cor: newUserCor,
        avatar: initial,
        ativo: newUserAtivo,
      };
      onSaveUser(updatedUser);
      if (
        currentUser &&
        (currentUser.id === updatedUser.id ||
          (currentUser.email && updatedUser.email && currentUser.email.toLowerCase() === updatedUser.email.toLowerCase()) ||
          (currentUser.role === 'admin' && updatedUser.role === 'admin'))
      ) {
        onSwitchUser(updatedUser);
      }
    } else {
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        nome: newUserName.trim(),
        cargo: positionClean,
        role: derivedRole,
        avatar: initial,
        cor: newUserCor,
        email: emailClean,
        username: usernameClean,
        senha: newUserSenha.trim() || '123',
        ativo: newUserAtivo,
      };
      onSaveUser(newUser);
    }

    setEditingUser(null);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserSenha('123');
    setShowNewUserForm(false);
  };

  const handleOpenNewSupplier = () => {
    setEditingSupplier(null);
    setNewSupplierName('');
    setNewSupplierEmail('');
    setNewSupplierPhone('');
    setNewSupplierContact('');
    setNewSupplierSenha(generateRandomPassword('forn'));
    setShowSupplierPassword(true);
    setCopiedSupplierPassword(false);
    setShowNewSupplierForm(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setNewSupplierName(s.nome);
    setNewSupplierEmail(s.email);
    setNewSupplierPhone(s.telefone);
    setNewSupplierContact(s.contatoNome);
    setNewSupplierSenha(s.senha || generateRandomPassword(s.nome));
    setShowSupplierPassword(true);
    setCopiedSupplierPassword(false);
    setShowNewSupplierForm(true);
  };

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const finalSenha =
      newSupplierSenha.trim() ||
      editingSupplier?.senha ||
      generateRandomPassword(newSupplierName);

    if (editingSupplier) {
      const updatedSupplier: Supplier = {
        ...editingSupplier,
        nome: newSupplierName.trim(),
        email: newSupplierEmail.trim() || editingSupplier.email,
        telefone: newSupplierPhone.trim() || editingSupplier.telefone,
        contatoNome: newSupplierContact.trim() || editingSupplier.contatoNome,
        senha: finalSenha,
      };
      onSaveSupplier(updatedSupplier);
    } else {
      const newSupplier: Supplier = {
        id: `forn-${Date.now()}`,
        nome: newSupplierName.trim(),
        email: newSupplierEmail.trim() || `${newSupplierName.toLowerCase().replace(/\s+/g, '')}@cotacao.com.br`,
        telefone: newSupplierPhone.trim() || '31999998888',
        contatoNome: newSupplierContact.trim() || 'Vendedor Comercial',
        listasIds: [activeList?.id || ''],
        tokenAcesso: `tok-${Math.random().toString(36).substring(2, 9)}`,
        senha: finalSenha,
        ativo: true,
      };
      onSaveSupplier(newSupplier);
    }

    setEditingSupplier(null);
    setNewSupplierName('');
    setNewSupplierEmail('');
    setNewSupplierPhone('');
    setNewSupplierContact('');
    setNewSupplierSenha('');
    setShowNewSupplierForm(false);
  };

  const handleExportCSV = () => {
    const listProducts = products.filter((p) => p.listaId === activeList?.id);
    const headers = 'Produto,Marca,Quantidade,Unidade,Prioridade,Solicitante,Status\n';
    const rows = listProducts
      .map(
        (p) =>
          `"${p.nome.replace(/"/g, '""')}","${p.marca}","${p.quantidade}","${p.unidade}","${p.prioridade}","${p.criadoPor?.nome}","${p.status}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista_compras_${(activeList?.fabrica || 'geral').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = () => {
    if (!csvText.trim()) return;
    const lines = csvText.split('\n');
    const newItems: Partial<ProductItem>[] = [];

    lines.forEach((line) => {
      const parts = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 1 && parts[0] && parts[0].toLowerCase() !== 'produto') {
        const nome = capitalizeWords(parts[0]);
        const marca = parts[1] || activeList?.fabrica || 'Geral';
        const quantidade = parseFloat(parts[2]) || 1;
        const unidade = parts[3] || 'UN';
        const prioridadeStr = (parts[4] || 'fixo').toLowerCase();
        const prioridade = ['fixo', 'novo', 'cotacao', 'urgente'].includes(prioridadeStr)
          ? (prioridadeStr as any)
          : 'fixo';

        newItems.push({
          listaId: activeList?.id || '',
          nome,
          marca,
          quantidade,
          unidade,
          prioridade,
          status: 'pendente',
        });
      }
    });

    if (newItems.length > 0) {
      onImportProducts(newItems);
      setCsvText('');
      alert(`${newItems.length} produtos importados com sucesso para ${activeList?.nome || 'a lista'}!`);
    }
  };

  const getPriorityStyle = (prioridade: Priority = 'cotacao') => {
    switch (prioridade) {
      case 'cotacao':
        return {
          label: 'COTAÇÃO',
          className: 'border border-amber-300 bg-amber-50/90 text-amber-800',
        };
      case 'fixo':
        return {
          label: 'FIXO',
          className: 'border border-blue-300 bg-blue-50/90 text-blue-800',
        };
      case 'novo':
        return {
          label: 'NOVO',
          className: 'border border-emerald-300 bg-emerald-50/90 text-emerald-800',
        };
      case 'urgente':
        return {
          label: 'URGENTE',
          className: 'border border-rose-300 bg-rose-50/90 text-rose-800',
        };
      default:
        return {
          label: 'COTAÇÃO',
          className: 'border border-amber-300 bg-amber-50/90 text-amber-800',
        };
    }
  };

  const handleOpenNewCatalog = () => {
    setEditingCatalogItem(null);
    setCatalogNome('');
    setCatalogCodigoBarras('');
    setCatalogMarca(activeList?.fabrica || 'Geral');
    setCatalogUnidade('UN');
    setCatalogPrioridade('cotacao');
    setCatalogFotoUrl('');
    setShowCatalogForm(true);
  };

  const handleOpenEditCatalog = (item: CatalogProduct) => {
    setEditingCatalogItem(item);
    setCatalogNome(item.nome);
    setCatalogCodigoBarras(item.codigoBarras || '');
    setCatalogMarca(item.marcaPadrao);
    setCatalogUnidade(item.unidadePadrao || 'UN');
    setCatalogPrioridade(item.prioridadePadrao || 'cotacao');
    setCatalogFotoUrl(item.fotoUrl || '');
    setShowCatalogForm(true);
  };

  const handleSaveCatalogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogNome.trim()) return;

    if (onSaveCatalogItem) {
      onSaveCatalogItem({
        id: editingCatalogItem ? editingCatalogItem.id : undefined,
        nome: capitalizeWords(catalogNome.trim()),
        marcaPadrao: catalogMarca.trim() || activeList?.fabrica || 'Geral',
        unidadePadrao: catalogUnidade,
        fabricaSugerida: catalogMarca.trim() || activeList?.fabrica || 'Geral',
        prioridadePadrao: catalogPrioridade,
        fotoUrl: catalogFotoUrl,
        codigoBarras: catalogCodigoBarras.trim() || undefined,
      });
    }

    setEditingCatalogItem(null);
    setShowCatalogForm(false);
    setCatalogNome('');
    setCatalogCodigoBarras('');
  };

  const handleQuickAdd = (item: CatalogProduct) => {
    if (onAddFromCatalog) {
      onAddFromCatalog(item, 1, item.prioridadePadrao || 'cotacao');
      setAddedCatalogIds((prev) => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setAddedCatalogIds((prev) => ({ ...prev, [item.id]: false }));
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - exactly matching Screenshot 2 */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-white relative">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 leading-tight">
                  Gerenciamento & Administração
                </h2>
                <button
                  type="button"
                  onClick={handleForceSyncFirebase}
                  disabled={isSyncingFirebase}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-lg transition-all cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
                  title="Sincronizar com Firebase (enviar todos os dados salvos)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
                </button>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Sessão Admin Ativa
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Firebase: {(firebaseConfig as any).projectId || 'Conectado'}
                </span>
              </div>
              {syncStatus && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-xs font-medium animate-in fade-in flex flex-col gap-1.5 ${
                    syncStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : syncStatus.type === 'permission'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      {syncStatus.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      <span>{syncStatus.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSyncStatus(null)}
                      className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-0.5"
                    >
                      ✕
                    </button>
                  </div>

                  {syncStatus.type === 'permission' && (
                    <div className="pt-1.5 border-t border-amber-200/80 text-[11px] leading-relaxed space-y-1.5">
                      <p>
                        Para autorizar gravação no seu Firestore, acesse a aba <strong>Regras (Rules)</strong> no Firebase Console e publique:
                      </p>
                      <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto select-all">
                        {`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`}
                      </pre>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={copyFirestoreRulesToClipboard}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10.5px] cursor-pointer transition-colors shadow-2xs"
                        >
                          {copiedRules ? '✓ Regras Copiadas!' : 'Copiar Regras'}
                        </button>
                        <a
                          href={`https://console.firebase.google.com/project/${(firebaseConfig as any).projectId || 'app-compra-8cae5'}/firestore/rules`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-lg text-[10.5px] cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <span>Abrir Firebase Console</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* System Modules Cards - compact version */}
        <div className="px-5 py-2.5 bg-slate-50/60 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600">
              Módulos do Sistema
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Google Sheets / Planilhas */}
            <button
              onClick={() => setActiveTab('planilhas')}
              className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeTab === 'planilhas'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30 text-emerald-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold truncate max-w-full">Planilhas</span>
            </button>

            {/* Catálogo de Produtos */}
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeTab === 'catalogo'
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/30 text-blue-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-1">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold truncate max-w-full">Catálogo</span>
            </button>

            {/* Fornecedores */}
            <button
              onClick={() => setActiveTab('fornecedores')}
              className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeTab === 'fornecedores'
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/30 text-indigo-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-1">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold truncate max-w-full">Fornecedores</span>
            </button>
          </div>
        </div>

        {/* Tab Controls Bar */}
        {activeTab !== 'usuarios' && (
          <div className="px-5 py-3 flex items-center justify-between gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('usuarios')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Usuários</span>
              </button>

              {activeTab === 'fornecedores' && (
                <button
                  onClick={handleOpenNewSupplier}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Novo Fornecedor</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair do Admin</span>
            </button>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB: USUÁRIOS */}
          {activeTab === 'usuarios' && (
            <div className="space-y-3.5">
              {/* Header Navigation matching image.png */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewUserForm(false);
                    setEditingUser(null);
                    setShowSwitchDropdown(false);
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    !showNewUserForm && !showSwitchDropdown
                      ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Usuários</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewUser}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showNewUserForm && !editingUser
                      ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Novo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showSwitchDropdown
                      ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Trocar...</span>
                </button>
              </div>

              {/* Quick Switch Dropdown */}
              {showSwitchDropdown && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 mb-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-extrabold uppercase text-slate-600 tracking-wide">
                      Alternar Usuário Ativo
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSwitchDropdown(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Fechar
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {users.map((u) => {
                      const isCurrent = u.id === currentUser?.id;
                      const colorHex = getUserColorHex(u.cor);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            onSwitchUser(u);
                            setShowSwitchDropdown(false);
                          }}
                          className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-50/80 border border-blue-200'
                              : 'hover:bg-white bg-white/70 border border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              style={{ backgroundColor: colorHex }}
                              className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                            >
                              {u.avatar || u.nome.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block truncate">
                                {u.nome}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {u.cargo} • @{u.username || u.email.split('@')[0]}
                              </span>
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              Ativo
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-blue-600">
                              Entrar →
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form matching image.png */}
              {showNewUserForm ? (
                <form
                  onSubmit={handleSaveUserSubmit}
                  className="space-y-4 pt-1 animate-in fade-in duration-150"
                >
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h3>

                  {/* NOME COMPLETO * */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-700 tracking-wide block mb-1">
                      NOME COMPLETO <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Anacleto (Gerente)"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>

                  {/* USUÁRIO DE ACESSO * */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-700 tracking-wide block mb-1">
                      USUÁRIO DE ACESSO <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: admin"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>

                  {/* SENHA DE ACESSO */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-700 tracking-wide block mb-1">
                      SENHA DE ACESSO
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123"
                      value={newUserSenha}
                      onChange={(e) => setNewUserSenha(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>

                  {/* TIPO DE CONTA (POSIÇÃO) */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-700 tracking-wide block mb-1">
                      TIPO DE CONTA (POSIÇÃO)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Gerente, Comprador, Estoquista, Almoxarife..."
                      value={newUserCargo}
                      onChange={(e) => setNewUserCargo(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>

                  {/* COR DO AVATAR / IDENTIFICADOR */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-700 tracking-wide block mb-2">
                      COR DO AVATAR / IDENTIFICADOR
                    </label>
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap pt-0.5">
                      {USER_AVATAR_COLORS.map((colorHex) => {
                        const isSelected =
                          newUserCor.toLowerCase() === colorHex.toLowerCase();
                        return (
                          <button
                            key={colorHex}
                            type="button"
                            onClick={() => setNewUserCor(colorHex)}
                            style={{ backgroundColor: colorHex }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all cursor-pointer relative ${
                              isSelected
                                ? 'ring-3 ring-slate-800 ring-offset-2 scale-110 shadow-xs'
                                : 'hover:scale-105 opacity-90 hover:opacity-100 shadow-2xs'
                            }`}
                            title={`Selecionar cor ${colorHex}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Checkbox Usuário Ativo */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newUserAtivo}
                        onChange={(e) => setNewUserAtivo(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 accent-blue-600 cursor-pointer shrink-0"
                      />
                      <span className="text-xs font-medium text-slate-700 leading-snug">
                        Usuário ativo (pode adicionar e gerenciar produtos na loja)
                      </span>
                    </label>
                  </div>

                  {/* Action Buttons: Cancelar / Salvar Usuário */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewUserForm(false);
                        setEditingUser(null);
                      }}
                      className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 px-4 py-2 cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      Salvar Usuário
                    </button>
                  </div>
                </form>
              ) : (
                /* User Cards List - with distinct user color */
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Colaboradores Cadastrados ({users.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenNewUser}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Usuário</span>
                    </button>
                  </div>

                  {users.map((u) => {
                    const isCurrent = u.id === currentUser?.id;
                    const colorHex = getUserColorHex(u.cor);

                    return (
                      <div
                        key={u.id}
                        className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all space-y-2"
                      >
                        {/* Top: Avatar & User Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar Circle with user color */}
                          <div
                            style={{ backgroundColor: colorHex }}
                            className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                          >
                            {u.avatar || u.nome.charAt(0)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {u.nome}
                              </span>
                              {u.role === 'admin' && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-blue-100 text-blue-800 leading-none">
                                  Admin
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-100 text-emerald-800 leading-none">
                                  Você
                                </span>
                              )}
                              {u.ativo === false && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-500 leading-none">
                                  Inativo
                                </span>
                              )}
                            </div>

                            <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                              @{u.username || u.email.split('@')[0]} • {u.cargo}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: Action Buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                          {/* Botão EDITAR: somente o ícone do lápis */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center border border-blue-200/80 cursor-pointer shadow-2xs transition-colors"
                            title="Editar dados deste usuário"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Entrar */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(u)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                              title="Alternar para este usuário"
                            >
                              Entrar
                            </button>
                          )}

                          {/* Botão Power / Ativar ou Desativar */}
                          <button
                            type="button"
                            onClick={() => {
                              onSaveUser({
                                ...u,
                                ativo: !u.ativo,
                              });
                            }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                              u.ativo !== false
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                            title={
                              u.ativo !== false
                                ? 'Usuário Ativo (Clique para desativar)'
                                : 'Usuário Inativo (Clique para ativar)'
                            }
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Excluir */}
                          {users.length > 1 && !isCurrent && (
                            userToDeleteId === u.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg animate-in fade-in duration-150">
                                <span className="text-[10px] font-bold text-rose-700">Excluir?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteUser(u.id);
                                    setUserToDeleteId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUserToDeleteId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUserToDeleteId(u.id)}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                                title="Excluir Usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: FORNECEDORES */}
          {activeTab === 'fornecedores' && (
            <div className="space-y-3">
              {showNewSupplierForm && (
                <form
                  onSubmit={handleSaveSupplierSubmit}
                  className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5">
                      <Edit2 className="w-4 h-4 text-indigo-600" />
                      <span>{editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor / Fábrica'}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewSupplierForm(false);
                        setEditingSupplier(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Razão Social / Nome Fantasia
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tigre Distribuidor Nordeste"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        E-mail de Acesso
                      </label>
                      <input
                        type="email"
                        placeholder="vendas@fornecedor.com.br"
                        value={newSupplierEmail}
                        onChange={(e) => setNewSupplierEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        WhatsApp / Telefone
                      </label>
                      <input
                        type="text"
                        placeholder="31999998888"
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nome do Representante / Vendedor
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Roberto Vendas"
                      value={newSupplierContact}
                      onChange={(e) => setNewSupplierContact(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                    />
                  </div>

                  {/* ÁREA DE GERAR / DEFINIR SENHA DO FORNECEDOR */}
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-700" />
                        <label className="text-[11px] font-extrabold uppercase text-indigo-900 tracking-wide">
                          Senha de Acesso do Fornecedor
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = generateRandomPassword(newSupplierName);
                          setNewSupplierSenha(generated);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Gerar nova senha para este fornecedor"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Gerar Senha</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showSupplierPassword ? 'text' : 'password'}
                          required
                          placeholder="Digite ou clique em Gerar Senha..."
                          value={newSupplierSenha}
                          onChange={(e) => setNewSupplierSenha(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 bg-white rounded-xl border border-indigo-200 text-xs font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSupplierPassword(!showSupplierPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          title={showSupplierPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showSupplierPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!newSupplierSenha) return;
                          navigator.clipboard.writeText(newSupplierSenha);
                          setCopiedSupplierPassword(true);
                          setTimeout(() => setCopiedSupplierPassword(false), 2000);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 border transition-colors cursor-pointer shadow-2xs shrink-0 ${
                          copiedSupplierPassword
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                        title="Copiar senha do fornecedor"
                      >
                        {copiedSupplierPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Copiada!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[10.5px] text-indigo-800/80 leading-snug">
                      • Esta senha é exclusiva deste fornecedor para acessar a cotação e preencher os preços.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSupplier ? 'Salvar Alterações do Fornecedor' : 'Salvar Fornecedor'}</span>
                  </button>
                </form>
              )}

              <div className="space-y-2.5">
                {suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{s.nome}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Ativo
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Contato: {s.contatoNome} • {s.email}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        WhatsApp: {s.telefone}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          Senha:
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 text-[11px]">
                            {s.senha || 'forn#2026'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(s.senha || 'forn#2026');
                            setCopiedSupplierCardId(s.id);
                            setTimeout(() => setCopiedSupplierCardId(null), 2000);
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copiar senha"
                        >
                          {copiedSupplierCardId === s.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                              <span className="text-emerald-700">Copiada</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão EDITAR FORNECEDOR */}
                      <button
                        onClick={() => handleOpenEditSupplier(s)}
                        className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1 border border-indigo-200 cursor-pointer shadow-2xs"
                        title="Editar fornecedor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      {supplierToDeleteId === s.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg animate-in fade-in duration-150">
                          <span className="text-[10px] font-bold text-rose-700">Excluir?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteSupplier(s.id);
                              setSupplierToDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupplierToDeleteId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSupplierToDeleteId(s.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PLANILHAS & EXPORTAÇÃO */}
          {activeTab === 'planilhas' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200">
                <h4 className="text-xs font-black text-emerald-900 uppercase mb-1">
                  Exportar Lista Atual ({activeList?.nome || 'Lista Atual'})
                </h4>
                <p className="text-xs text-emerald-800 mb-3">
                  Baixe a lista de produtos com prioridades, quantidades e marcas para abrir no Excel ou Google Planilhas.
                </p>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Planilha CSV</span>
                </button>
              </div>

              {/* Import Area */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-black text-slate-800 uppercase">
                  Importar Produtos em Lote
                </h4>
                <p className="text-[11px] text-slate-500">
                  Cole linhas no formato: <br />
                  <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-mono">
                    Nome do Produto, Marca, Quantidade, Unidade, Prioridade(fixo/novo/cotacao/urgente)
                  </code>
                </p>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Tubo 50mm, Tigre, 20, BARRA, fixo&#10;Luva Soldável 50mm, Tigre, 40, UN, urgente"
                  className="w-full p-2.5 bg-white rounded-xl border border-slate-300 text-xs font-mono outline-hidden"
                />
                <button
                  onClick={handleImportCSV}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar para {activeList?.fabrica || 'a Lista'}</span>
                </button>
              </div>

              {/* Clear Cache & Products Option */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                    Limpeza de Cache & Zerar Produtos
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    {products.length} produtos
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  Esvazie todos os produtos e cotações para iniciar um novo lançamento limpo, mantendo seus fornecedores, listas e usuários intactos.
                </p>
                {onOpenClearCache && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenClearCache();
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Cache & Iniciar Produtos Limpos</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB: CATÁLOGO */}
          {activeTab === 'catalogo' && (
            <div className="space-y-3">
              {/* Search & New Item Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar na base de produtos..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-100 focus:bg-white rounded-2xl text-xs font-semibold border border-transparent focus:border-blue-400 outline-hidden transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchBarcodeScannerOpen(true)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Buscar por Código de Barras com a Câmera"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewCatalog}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title="Cadastrar Novo Item na Base"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo</span>
                </button>
              </div>

              {/* Form to Add or Edit Catalog Item */}
              {showCatalogForm && (
                <form
                  onSubmit={handleSaveCatalogSubmit}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase text-slate-700">
                      {editingCatalogItem ? 'Editar Item da Base' : 'Cadastrar Item na Base'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowCatalogForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Prioridade Padrão acima do Nome do Produto com botões em formato de pílulas */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                      Prioridade Padrão
                    </label>
                    <div className="flex items-center gap-2">
                      {/* Fixo (F) */}
                      <button
                        type="button"
                        onClick={() => setCatalogPrioridade('fixo')}
                        className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
                          catalogPrioridade === 'fixo'
                            ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300'
                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        F <span className="font-semibold text-[11px] opacity-90">({catalogPriorityCounts.fixo})</span>
                      </button>

                      {/* Novo (N) */}
                      <button
                        type="button"
                        onClick={() => setCatalogPrioridade('novo')}
                        className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
                          catalogPrioridade === 'novo'
                            ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        N <span className="font-semibold text-[11px] opacity-90">({catalogPriorityCounts.novo})</span>
                      </button>

                      {/* Cotacao (C) */}
                      <button
                        type="button"
                        onClick={() => setCatalogPrioridade('cotacao')}
                        className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
                          catalogPrioridade === 'cotacao'
                            ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        C <span className="font-semibold text-[11px] opacity-90">({catalogPriorityCounts.cotacao})</span>
                      </button>

                      {/* Urgente (U) */}
                      <button
                        type="button"
                        onClick={() => setCatalogPrioridade('urgente')}
                        className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-2xs border ${
                          catalogPrioridade === 'urgente'
                            ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 animate-pulse'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        U <span className="font-semibold text-[11px] opacity-90">({catalogPriorityCounts.urgente})</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Nome do Produto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tubo Soldável 25mm 3m"
                      value={catalogNome}
                      onChange={(e) => setCatalogNome(capitalizeWords(e.target.value))}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                    />
                  </div>

                  {/* Código de Barras e Quantidade na mesma linha */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Código de Barras (Opcional)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Ex: 7891000100103"
                          value={catalogCodigoBarras}
                          onChange={(e) => setCatalogCodigoBarras(e.target.value)}
                          className="w-full pl-3 pr-10 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setIsCatalogBarcodeScannerOpen(true)}
                          className="absolute right-2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer p-1"
                          title="Ler Código de Barras com a Câmera"
                        >
                          <ScanBarcode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Quantidade
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: UN, CX, 1..."
                        value={catalogUnidade}
                        onChange={(e) => setCatalogUnidade(e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Foto do produto na base */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Foto do Produto (Opcional)
                    </label>
                    <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        {catalogFotoUrl ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                            <img
                              src={catalogFotoUrl}
                              alt="Foto"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setCatalogFotoUrl('')}
                              className="absolute top-0 right-0 p-0.5 bg-rose-600 text-white rounded-bl"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 pl-1">Sem foto</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsCatalogCameraOpen(true)}
                          className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Tirar foto com a câmera"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <label className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer">
                          <ImageIcon className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressed = await compressImage(file, 640, 640, 0.70);
                                  setCatalogFotoUrl(compressed);
                                } catch (err) {
                                  console.warn('Erro ao processar imagem do catálogo:', err);
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {editingCatalogItem ? 'Salvar Alterações na Base' : 'Salvar na Base Permanente'}
                  </button>
                </form>
              )}

              {/* Header subtitle */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span>
                  Base permanente ({catalog.length} itens) • Fábrica ativa:{' '}
                  <strong className="text-slate-700">{activeList?.fabrica || 'Principal'}</strong>
                </span>
              </div>

              {/* Product Cards identical to Lista de Compras and image.png */}
              <div className="space-y-1.5">
                {catalog
                  .filter((c) => {
                    const q = catalogSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      c.nome.toLowerCase().includes(q) ||
                      c.marcaPadrao.toLowerCase().includes(q) ||
                      c.fabricaSugerida.toLowerCase().includes(q) ||
                      (c.codigoBarras && c.codigoBarras.toLowerCase().includes(q))
                    );
                  })
                  .map((item) => {
                    const isAdded = !!addedCatalogIds[item.id];
                    const pStyle = getPriorityStyle(item.prioridadePadrao || 'cotacao');

                    return (
                      <div
                        key={item.id}
                        className={`relative bg-white rounded-xl border transition-all py-2.5 px-3 sm:px-3.5 flex items-center gap-3 shadow-2xs hover:shadow-xs ${
                          isAdded
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : 'border-slate-200/90 hover:border-blue-300'
                        }`}
                      >
                        {/* 1. Thumbnail / Photo square matching image */}
                        <div
                          onClick={() => {
                            if (item.fotoUrl) {
                              setZoomedCatalogProduct(item);
                            } else {
                              handleQuickAdd(item);
                            }
                          }}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center shrink-0 overflow-hidden relative group transition-colors ${
                            item.fotoUrl
                              ? 'cursor-zoom-in hover:border-blue-400 bg-slate-50'
                              : 'cursor-pointer hover:border-blue-400 bg-slate-50/50'
                          }`}
                          title={
                            item.fotoUrl
                              ? 'Clique na foto para visualizar (1x)'
                              : 'Clique para adicionar à lista'
                          }
                        >
                          {item.fotoUrl ? (
                            <>
                              <img
                                src={item.fotoUrl}
                                alt={item.nome}
                                className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                <ZoomIn className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera className="w-4 h-4 text-slate-400 stroke-[1.8]" />
                              <span className="text-[9px] font-semibold text-slate-400 leading-none mt-0.5">
                                Foto
                              </span>
                            </>
                          )}
                        </div>

                        {/* 2. Center Content - exact match to user image */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleQuickAdd(item)}
                        >
                          {/* Nome do produto */}
                          <h3
                            className="font-bold text-xs sm:text-sm leading-tight tracking-tight truncate hover:text-blue-700 transition-colors text-slate-900"
                            title={item.nome}
                          >
                            {item.nome}
                          </h3>

                          {/* Nome da prioridade + Círculo do Usuário + Número da Quantidade em azul */}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {/* Nome da Prioridade */}
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide leading-none ${pStyle.className}`}
                            >
                              {pStyle.label}
                            </span>

                            {/* Círculo com inicial do usuário */}
                            <span
                              style={{
                                borderColor: getUserColorHex(currentUser?.cor),
                                color: getUserColorHex(currentUser?.cor),
                                backgroundColor: `${getUserColorHex(currentUser?.cor)}15`,
                              }}
                              className="w-4.5 h-4.5 rounded-full border-[1.5px] font-black text-[9.5px] flex items-center justify-center shrink-0 leading-none shadow-2xs select-none"
                              title={`Perfil: ${currentUser?.nome || 'Admin'}`}
                            >
                              {(currentUser?.avatar || currentUser?.nome?.charAt(0) || 'A').toUpperCase()}
                            </span>

                            {/* Número da quantidade em azul */}
                            <span className="text-blue-600 font-extrabold text-xs sm:text-sm leading-none">
                              {(() => {
                                const parsedQty = parseFloat(item.unidadePadrao);
                                return !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
                              })()}
                            </span>

                            {/* Código de barras após a quantidade quando presente */}
                            {item.codigoBarras && item.codigoBarras.trim() && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded-md border border-slate-200/80 leading-none transition-colors"
                                title={`Código de Barras: ${item.codigoBarras}`}
                              >
                                <ScanBarcode className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{item.codigoBarras}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. Action Buttons: Single (+) Button without the word Adicionar, plus 3-dots */}
                        <div className="relative shrink-0 flex items-center gap-1">
                          {/* Botão com o sinal de mais (+) sem a palavra adicionar */}
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(item)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              isAdded
                                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600'
                            }`}
                            title={isAdded ? 'Adicionado à lista atual!' : `Adicionar "${item.nome}" à lista`}
                          >
                            {isAdded ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <Plus className="w-4 h-4 stroke-[2.8]" />
                            )}
                          </button>

                          {/* 3-dots menu button */}
                          <button
                            type="button"
                            onClick={() =>
                              setActiveCatalogMenuId(
                                activeCatalogMenuId === item.id ? null : item.id
                              )
                            }
                            className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Opções do item"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Options */}
                          {activeCatalogMenuId === item.id && (
                            <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCatalogMenuId(null);
                                  handleQuickAdd(item);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-blue-600" />
                                <span>Adicionar à {activeList?.fabrica || 'Lista'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCatalogMenuId(null);
                                  handleOpenEditCatalog(item);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Editar Item na Base</span>
                              </button>

                              {onDeleteCatalogItem && (
                                <>
                                  <div className="border-t border-slate-100 my-1"></div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCatalogMenuId(null);
                                      onDeleteCatalogItem(item.id);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Excluir da Base</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Camera Capture Modal for Catalog */}
      <CameraModal
        isOpen={isCatalogCameraOpen}
        onClose={() => setIsCatalogCameraOpen(false)}
        onCapture={(photo) => setCatalogFotoUrl(photo)}
        title={catalogNome.trim() ? `Foto de: ${catalogNome}` : 'Tirar Foto para a Base'}
      />

      {/* Barcode Scanner Modal for Catalog Form */}
      <BarcodeScannerModal
        isOpen={isCatalogBarcodeScannerOpen}
        onClose={() => setIsCatalogBarcodeScannerOpen(false)}
        onScan={(code) => {
          setCatalogCodigoBarras(code.trim());
          setIsCatalogBarcodeScannerOpen(false);
        }}
        title="Código de Barras da Base"
        subtitle="Aponte para o código de barras ou QR Code do produto"
      />

      {/* Barcode Scanner Modal for Searching Catalog */}
      <BarcodeScannerModal
        isOpen={isSearchBarcodeScannerOpen}
        onClose={() => setIsSearchBarcodeScannerOpen(false)}
        onScan={(code) => {
          setCatalogSearch(code.trim());
          setIsSearchBarcodeScannerOpen(false);
        }}
        title="Buscar por Código de Barras"
        subtitle="Aponte para o código de barras para localizar o item na base"
      />

      {/* 3x Zoom Image Modal */}
      {zoomedCatalogProduct && zoomedCatalogProduct.fotoUrl && (
        <ImageZoomModal
          isOpen={!!zoomedCatalogProduct}
          onClose={() => setZoomedCatalogProduct(null)}
          imageUrl={zoomedCatalogProduct.fotoUrl}
          title={zoomedCatalogProduct.nome}
          subtitle={`Unidade: ${zoomedCatalogProduct.unidadePadrao || 'UN'}${
            zoomedCatalogProduct.marcaPadrao ? ` • Marca: ${zoomedCatalogProduct.marcaPadrao}` : ''
          }`}
          badge={zoomedCatalogProduct.prioridadePadrao?.toUpperCase()}
        />
      )}
    </div>
  );
};
