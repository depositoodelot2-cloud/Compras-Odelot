import React, { useState } from 'react';
import {
  ShieldCheck,
  ShoppingCart,
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  User,
  Briefcase,
  CheckCircle2,
  KeyRound,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } from '../firebase';
import { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (firebaseUser: any, userProfile?: UserProfile) => void;
  onSelectLocalUser?: (user: UserProfile) => void;
  availableUsers?: UserProfile[];
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onSelectLocalUser,
  availableUsers = [],
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('Administrador / Gerente');
  const [role, setRole] = useState<'admin' | 'comprador' | 'estoquista'>('admin');
  const [showPassword, setShowPassword] = useState(false);

  const translateFirebaseError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mail ou senha incorretos. Verifique seus dados ou crie uma conta.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado no sistema. Alterne para a aba "Fazer Login".';
      case 'auth/weak-password':
        return 'A senha é muito fraca. Digite pelo menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'O formato do e-mail digitado não é válido.';
      case 'auth/popup-closed-by-user':
        return 'A janela de login com Google foi fechada antes de concluir.';
      case 'auth/popup-blocked':
        return 'O navegador bloqueou a janela pop-up do Google. Permita popups para este site ou tente novamente.';
      case 'auth/unauthorized-domain':
        return 'Domínio atual não autorizado no Firebase. No Firebase Console > Authentication > Settings > Authorized domains, adicione este domínio.';
      case 'auth/operation-not-allowed':
        return 'Provedor de login não ativado no Firebase. Verifique se o Google ou E-mail/Senha estão ativos em Authentication > Sign-in method.';
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua conexão com a internet.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas consecutivas. Aguarde alguns instantes e tente novamente.';
      default:
        return err?.message || 'Ocorreu um erro na autenticação. Tente novamente.';
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const user = await loginWithGoogle();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Falha no login com Google:', err);
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Por favor, informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const user = await loginWithEmail(email, password);
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Erro no login por e-mail:', err);
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg('Por favor, informe o seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Por favor, informe um endereço de e-mail.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem. Digite a mesma senha nos dois campos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { user, profile } = await registerWithEmail(email, password, nome, cargo, role);
      setSuccessMsg('Conta criada com sucesso! Acessando...');
      setTimeout(() => {
        onLoginSuccess(user, profile);
      }, 400);
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Por favor, informe seu e-mail para receber as instruções de recuperação.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await resetPassword(email);
      setSuccessMsg(`Link de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada e spam.`);
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 text-slate-800 overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 sm:p-7 text-center text-white relative">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-2.5 shadow-inner">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Sistema de Compras
          </h2>
          <p className="text-xs text-blue-100 mt-0.5 font-medium">
            Gestão de Pedidos, Listas & Cotações
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-blue-900/60 border border-blue-400/30 text-[11px] font-bold text-blue-200">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Firebase: app-compra-8cae5</span>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-4">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* GOOGLE LOGIN - PROMINENT PRIMARY OPTION */}
          {mode !== 'forgot_password' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 active:bg-blue-100/50 disabled:opacity-60 text-slate-800 font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-xs hover:shadow-md cursor-pointer group"
              >
                {googleLoading ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-700 text-xs font-semibold">Conectando à Conta Google...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continuar com Google</span>
                    <Sparkles className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10.5px] uppercase font-bold tracking-wider">
                  <span className="bg-white px-2.5 text-slate-600">ou use e-mail e senha</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab switch: Fazer Login vs Criar Conta */}
          {mode !== 'forgot_password' && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fazer Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Criar Conta
              </button>
            </div>
          )}

          {/* 1. LOGIN COM EMAIL E SENHA */}
          {mode === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. REGISTRO DE CONTA */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cargo / Função
                  </label>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={cargo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCargo(val);
                        if (val.includes('Administrador') || val.includes('Gerente')) {
                          setRole('admin');
                        } else if (val.includes('Comprador')) {
                          setRole('comprador');
                        } else {
                          setRole('estoquista');
                        }
                      }}
                      className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 transition-all outline-hidden cursor-pointer"
                    >
                      <option value="Administrador / Gerente">Administrador / Gerente</option>
                      <option value="Comprador Pleno">Comprador Pleno</option>
                      <option value="Solicitante / Estoquista">Solicitante / Estoquista</option>
                      <option value="Diretoria">Diretoria</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nível de Acesso
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 transition-all outline-hidden cursor-pointer"
                  >
                    <option value="admin">Administrador (Total)</option>
                    <option value="comprador">Comprador</option>
                    <option value="estoquista">Estoquista / Solicitante</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Senha (mín. 6)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6"
                      autoComplete="new-password"
                      required
                      className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 transition-all outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      required
                      className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 transition-all outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer mt-1"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Criar Conta e Acessar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. RECUPERAR SENHA */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recuperação de Senha
                </h3>
                <p className="text-[11px] text-slate-500">
                  Digite seu e-mail cadastrado para receber o link de redefinição.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 transition-all outline-hidden"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Enviar Link de Recuperação</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {/* Quick-test access */}
          {availableUsers.length > 0 && onSelectLocalUser && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Ou acessar perfil salvo:
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {availableUsers.slice(0, 2).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onSelectLocalUser(u)}
                    className="p-2 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: u.cor || '#2563eb' }}
                      >
                        {u.avatar || u.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{u.nome}</p>
                        <p className="text-[10px] text-slate-600">{u.cargo}</p>
                      </div>
                    </div>
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-slate-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Autenticação Firebase em tempo real (Google & E-mail/Senha)</span>
        </div>
      </div>
    </div>
  );
};
