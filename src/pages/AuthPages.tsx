import { ChangeEvent, useMemo, useState } from 'react';
import type { AuthSession } from '@supabase/supabase-js';
import {
  Eye,
  EyeOff,
  Home,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Sparkles,
  User
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getPathForRoute } from '../i18n/routes';
import { NettoyoLogo } from '../components/NettoyoLogo';
import { SEOHead } from '../components/SEOHead';
import supabase from '../lib/supabase';
import { fetchProfile } from '../context/AuthContext';
import { getSeoMeta } from '../seo/metadata';
import { getHreflangAlternates } from '../seo/hreflang';

type Role = 'client' | 'nettoyeur';

type AuthApi = {
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<{
    data: {
      user:
        | {
            id: string;
            email?: string | null;
            user_metadata?: Record<string, unknown> | null;
          }
        | null;
    };
    error: { message: string } | null;
  }>;
  signInWithOAuth: (input: {
    provider: 'google';
    options: { redirectTo: string };
  }) => Promise<{ error: { message: string } | null }>;
  signUp: (credentials: {
    email: string;
    password: string;
    options: {
      data: {
        role: Role;
        first_name: string;
        last_name: string;
      };
    };
  }) => Promise<{
    data: { session: AuthSession | null; user: { id: string } | null };
    error: { message: string } | null;
  }>;
};

const auth = supabase.auth as unknown as AuthApi;

const triggerWelcomeEmail = async (userId: string, accessToken: string | null) => {
  try {
    const response = await fetch('/api/notifications/welcome-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[welcome-email] route returned 404. This is expected when running Vite dev (npm run dev) without Vercel runtime.');
      } else {
        console.error('[welcome-email] trigger failed', { userId, status: response.status });
      }
    }
  } catch (error) {
    console.error('[welcome-email] request error', { userId, error });
  }
};

type LoginContent = {
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  submit: string;
  submitLoading: string;
  noAccount: string;
  createAccount: string;
  divider: string;
  google: string;
  googleLoading: string;
  facebook: string;
  apple: string;
};

type SignupContent = {
  title: string;
  subtitle: string;
  choose: string;
  selected: string;
  client: { title: string; description: string; formTitle: string };
  cleaner: { title: string; description: string; formTitle: string };
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  city: string;
  checkboxPrefix: string;
  checkboxLink: string;
  submit: string;
  submitLoading: string;
  success: string;
  divider: string;
  google: string;
  facebook: string;
  apple: string;
  already: string;
  login: string;
  selectRoleError: string;
};

const loginContent: Record<Language, LoginContent> = {
  fr: {
    title: 'Bon retour parmi nous',
    subtitle: 'Connectez-vous à votre compte',
    emailPlaceholder: 'Adresse e-mail',
    passwordPlaceholder: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    submit: 'Se connecter',
    submitLoading: 'Connexion en cours...',
    noAccount: "Vous n'avez pas encore de compte ?",
    createAccount: 'Créer un compte Nettoyó',
    divider: 'ou',
    google: 'Continuer avec Google',
    googleLoading: 'Connexion en cours...',
    facebook: 'Continuer avec Facebook',
    apple: 'Continuer avec Apple'
  },
  en: {
    title: 'Welcome back',
    subtitle: 'Log in to your account',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    forgotPassword: 'Forgot your password?',
    submit: 'Log in',
    submitLoading: 'Logging in...',
    noAccount: "Don't have an account yet?",
    createAccount: 'Create a Nettoyó account',
    divider: 'or',
    google: 'Continue with Google',
    googleLoading: 'Logging in...',
    facebook: 'Continue with Facebook',
    apple: 'Continue with Apple'
  },
  es: {
    title: 'Bienvenido de nuevo',
    subtitle: 'Inicia sesión en tu cuenta',
    emailPlaceholder: 'Correo electrónico',
    passwordPlaceholder: 'Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    submit: 'Iniciar sesión',
    submitLoading: 'Iniciando sesión...',
    noAccount: '¿Todavía no tienes una cuenta?',
    createAccount: 'Crear una cuenta Nettoyó',
    divider: 'o',
    google: 'Continuar con Google',
    googleLoading: 'Iniciando sesión...',
    facebook: 'Continuar con Facebook',
    apple: 'Continuar con Apple'
  }
};

const signupContent: Record<Language, SignupContent> = {
  fr: {
    title: 'Créez votre compte',
    subtitle: 'Dites-nous qui vous êtes pour commencer',
    choose: 'Choisir',
    selected: 'Sélectionné ✓',
    client: {
      title: 'Je suis un client',
      description: 'Je recherche un nettoyeur de confiance pour mon domicile ou mon bureau',
      formTitle: 'Créez votre compte client'
    },
    cleaner: {
      title: 'Je suis un nettoyeur',
      description: 'Je veux proposer mes services et trouver des clients près de chez moi',
      formTitle: 'Créez votre compte nettoyeur'
    },
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    city: 'Votre ville',
    checkboxPrefix: "J'accepte les",
    checkboxLink: "conditions d'utilisation et la politique de confidentialité",
    submit: 'Créer mon compte',
    submitLoading: 'Création du compte...',
    success: 'Vérifiez votre email pour confirmer votre compte',
    divider: 'ou',
    google: 'Continuer avec Google',
    facebook: 'Continuer avec Facebook',
    apple: 'Continuer avec Apple',
    already: 'Déjà un compte ?',
    login: 'Se connecter',
    selectRoleError: 'Choisissez un rôle pour continuer'
  },
  en: {
    title: 'Create your account',
    subtitle: 'Tell us who you are to get started',
    choose: 'Choose',
    selected: 'Selected ✓',
    client: {
      title: 'I am a client',
      description: 'I am looking for a trusted cleaner for my home or office',
      formTitle: 'Create your client account'
    },
    cleaner: {
      title: 'I am a cleaner',
      description: 'I want to offer my services and find clients near me',
      formTitle: 'Create your cleaner account'
    },
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    city: 'Your city',
    checkboxPrefix: 'I agree to the',
    checkboxLink: 'terms of use and privacy policy',
    submit: 'Create my account',
    submitLoading: 'Creating account...',
    success: 'Check your email to confirm your account',
    divider: 'or',
    google: 'Continue with Google',
    facebook: 'Continue with Facebook',
    apple: 'Continue with Apple',
    already: 'Already have an account?',
    login: 'Log in',
    selectRoleError: 'Choose a role to continue'
  },
  es: {
    title: 'Crea tu cuenta',
    subtitle: 'Dinos quién eres para empezar',
    choose: 'Elegir',
    selected: 'Seleccionado ✓',
    client: {
      title: 'Soy un cliente',
      description: 'Busco un limpiador de confianza para mi hogar u oficina',
      formTitle: 'Crea tu cuenta de cliente'
    },
    cleaner: {
      title: 'Soy un limpiador',
      description: 'Quiero ofrecer mis servicios y encontrar clientes cerca de mí',
      formTitle: 'Crea tu cuenta de limpiador'
    },
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    city: 'Tu ciudad',
    checkboxPrefix: 'Acepto los',
    checkboxLink: 'términos de uso y la política de privacidad',
    submit: 'Crear mi cuenta',
    submitLoading: 'Creando cuenta...',
    success: 'Revisa tu email para confirmar tu cuenta',
    divider: 'o',
    google: 'Continuar con Google',
    facebook: 'Continuar con Facebook',
    apple: 'Continuar con Apple',
    already: '¿Ya tienes una cuenta?',
    login: 'Iniciar sesión',
    selectRoleError: 'Elige un rol para continuar'
  }
};

const forgotPasswordSlugs: Record<Language, string> = {
  fr: 'mot-de-passe-oublie',
  en: 'forgot-password',
  es: 'olvide-mi-contrasena'
};

function GoogleIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5A9.5 9.5 0 1 0 12 21.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.9H12Z"/><path fill="#34A853" d="M3.4 7.9 6.6 10A5.9 5.9 0 0 1 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5c-3.6 0-6.7 2-8.6 5.4Z"/><path fill="#4A90E2" d="M12 21.5c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.3-2.6-5.5-3.8l-3.1 2.4A9.5 9.5 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M3.4 16.3 6.6 14A5.7 5.7 0 0 1 6.3 12c0-.7.1-1.4.3-2L3.4 7.9A9.6 9.6 0 0 0 2.5 12c0 1.5.3 3 .9 4.3Z"/></svg>; }
function FacebookIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7v-3.5h3.1V9.4c0-3.1 1.8-4.8 4.6-4.8 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.4l-.6 3.5H14v8.4A12 12 0 0 0 24 12Z"/></svg>; }
function AppleIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M15.2 3.1c0 1-.4 2-1.1 2.7-.7.7-1.8 1.2-2.8 1.1-.1-1 .4-2 1.1-2.7.7-.7 1.8-1.2 2.8-1.1Zm3.9 13.4c-.4 1-.9 1.9-1.6 2.8-.9 1.2-1.7 1.7-2.4 1.7-.6 0-1.1-.2-1.8-.5-.7-.3-1.3-.5-2-.5s-1.3.2-2 .5c-.7.3-1.2.5-1.8.5-.7 0-1.5-.6-2.5-1.8-1-1.3-1.9-2.8-2.5-4.5-.7-1.8-.9-3.5-.6-4.9.2-1.1.7-2 1.5-2.7.8-.7 1.7-1 2.8-1 .6 0 1.3.2 2 .5.7.3 1.2.5 1.5.5.2 0 .8-.2 1.6-.6.8-.4 1.6-.6 2.3-.6 1.9.2 3.3 1 4.3 2.6-1.7 1-2.5 2.4-2.5 4.2 0 1.4.5 2.6 1.5 3.5.4.4.9.7 1.4.9Z"/></svg>; }

function SocialButton({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="relative flex w-full items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-5 py-3.5 font-medium text-[#1A1A2E] shadow-[0_8px_20px_rgba(17,24,39,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_12px_24px_rgba(17,24,39,0.08)] disabled:cursor-not-allowed disabled:opacity-70"><span className="absolute left-5">{icon}</span><span>{label}</span></button>;
}

function Divider({ label }: { label: string }) { return <div className="flex items-center gap-4"><div className="h-px flex-1 bg-[#E5E7EB]" /><span className="text-sm text-[#9CA3AF]">{label}</span><div className="h-px flex-1 bg-[#E5E7EB]" /></div>; }
function Spinner() { return <Loader2 size={18} className="animate-spin" />; }

function InputField({ icon, placeholder, type = 'text', value, onChange, rightSlot }: { icon: React.ReactNode; placeholder: string; type?: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; rightSlot?: React.ReactNode; }) {
  return <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">{icon}</span><input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full rounded-xl border border-[#E5E7EB] bg-white py-3.5 pl-12 pr-12 text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.14)]" />{rightSlot ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">{rightSlot}</span> : null}</div>;
}

function AuthCard({ children, maxWidth = 'max-w-[480px]' }: { children: React.ReactNode; maxWidth?: string }) { return <div className={`w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(17,24,39,0.08)] sm:p-8`}>{children}</div>; }
function AuthFeedback({ message, tone }: { message: string | null; tone: 'error' | 'success' }) { if (!message) return null; return <div className={`rounded-xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-[rgba(239,68,68,0.08)] text-[#B91C1C]' : 'bg-[rgba(168,230,207,0.22)] text-[#047857]'}`}>{message}</div>; }

export function LoginPage() {
  const { language, navigateTo } = useLanguage();
  const content = loginContent[language];
  const seo = getSeoMeta('login', language);
  const hreflang = getHreflangAlternates('login');
  const signupPath = getPathForRoute(language, 'signup');
  const forgotPath = `/${language}/${forgotPasswordSlugs[language]}`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'password' | 'google' | null>(null);

  const handlePasswordLogin = async () => {
    setErrorMessage(null);
    setLoadingMode('password');
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error) { setErrorMessage(error.message); setLoadingMode(null); return; }
    if (!data.user) { setErrorMessage('Unable to load user account.'); setLoadingMode(null); return; }
    try {
      const profile = await fetchProfile({
        id: data.user.id,
        email: data.user.email ?? null,
        user_metadata: data.user.user_metadata ?? null
      });
      navigateTo(
        profile?.role === 'admin'
          ? 'adminDashboard'
          : profile?.role === 'nettoyeur'
            ? 'cleanerDashboard'
            : 'clientDashboard'
      );
    } catch (profileError) {
      setErrorMessage(profileError instanceof Error ? profileError.message : 'Unable to load profile.');
    } finally {
      setLoadingMode(null);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoadingMode('google');
    const { error } = await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
    if (error) { setErrorMessage(error.message); setLoadingMode(null); }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-[#F7F7F7] px-4 py-10 sm:px-6 lg:px-8">
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        ogImage={seo.ogImage}
        hreflang={hreflang}
        noIndex
      />
      <AuthCard>
        <div className="flex flex-col items-center text-center"><div className="overflow-visible px-6 pt-2"><NettoyoLogo className="h-16 sm:h-18" /></div><h1 className="mt-5 text-3xl font-bold text-[#1A1A2E]">{content.title}</h1><p className="mt-2 text-[#6B7280]">{content.subtitle}</p></div>
        <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); void handlePasswordLogin(); }}>
          <InputField icon={<Mail size={18} />} placeholder={content.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} />
          <InputField icon={<Lock size={18} />} placeholder={content.passwordPlaceholder} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} rightSlot={<button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
          <div className="text-right"><a href={forgotPath} className="text-sm text-[#4FC3F7] underline underline-offset-2">{content.forgotPassword}</a></div>
          <AuthFeedback message={errorMessage} tone="error" />
          <button type="submit" disabled={loadingMode !== null} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-3.5 font-bold text-white shadow-[0_14px_28px_rgba(79,195,247,0.28)] transition-all hover:bg-[#3FAAD4] hover:shadow-[0_18px_30px_rgba(79,195,247,0.34)] disabled:cursor-not-allowed disabled:opacity-70">{loadingMode === 'password' ? <Spinner /> : null}{loadingMode === 'password' ? content.submitLoading : content.submit}</button>
          <div className="pt-1 text-center"><p className="text-[#6B7280]">{content.noAccount}</p><a href={signupPath} className="mt-3 inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-[#4FC3F7] bg-white px-6 py-3.5 font-bold text-[#4FC3F7] transition-colors hover:bg-[rgba(79,195,247,0.05)]">{content.createAccount}</a></div>
        </form>
        <div className="mt-8"><Divider label={content.divider} /></div>
        <div className="mt-8 space-y-3">
          <SocialButton label={loadingMode === 'google' ? content.googleLoading : content.google} icon={loadingMode === 'google' ? <Spinner /> : <GoogleIcon />} onClick={handleGoogleLogin} disabled={loadingMode !== null} />
          <SocialButton label={content.facebook} icon={<FacebookIcon />} />
          <SocialButton label={content.apple} icon={<AppleIcon />} />
        </div>
      </AuthCard>
    </div>
  );
}

function RoleCard({ title, description, tone, selected, faded, buttonLabel, icon }: { title: string; description: string; tone: 'sky' | 'mint'; selected: boolean; faded: boolean; buttonLabel: string; icon: React.ReactNode; }) {
  const toneClasses = tone === 'sky' ? { wrapper: selected ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.05)] shadow-[0_0_0_4px_rgba(79,195,247,0.12)]' : 'border-[#E5E7EB]', icon: 'bg-[rgba(79,195,247,0.15)] text-[#4FC3F7]', button: selected ? 'bg-[#4FC3F7] text-white' : 'border-[1.5px] border-[#4FC3F7] text-[#4FC3F7]' } : { wrapper: selected ? 'border-[#A8E6CF] bg-[rgba(168,230,207,0.05)] shadow-[0_0_0_4px_rgba(168,230,207,0.18)]' : 'border-[#E5E7EB]', icon: 'bg-[rgba(168,230,207,0.15)] text-[#60B99A]', button: selected ? 'bg-[#A8E6CF] text-[#1A1A2E]' : 'border-[1.5px] border-[#A8E6CF] text-[#60B99A]' };
  return <div className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-[0_14px_36px_rgba(17,24,39,0.06)] transition-all duration-200 ${toneClasses.wrapper} ${faded ? 'opacity-50' : 'opacity-100'}`}><div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${toneClasses.icon}`}>{icon}</div><h3 className="mt-5 text-xl font-bold text-[#1A1A2E]">{title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-[#6B7280]">{description}</p><div className={`mt-6 inline-flex justify-center rounded-full px-5 py-3 text-sm font-bold ${toneClasses.button}`}>{buttonLabel}</div></div>;
}

export function SignupPage() {
  const { language, navigateTo } = useLanguage();
  const content = signupContent[language];
  const seo = getSeoMeta('signup', language);
  const hreflang = getHreflangAlternates('signup');
  const loginPath = getPathForRoute(language, 'login');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const socialButtons = useMemo(() => [{ label: content.google, icon: <GoogleIcon /> }, { label: content.facebook, icon: <FacebookIcon /> }, { label: content.apple, icon: <AppleIcon /> }], [content.apple, content.facebook, content.google]);
  const selectedTone = selectedRole === 'nettoyeur' ? 'mint' : 'sky';

  const handleSignup = async () => {
    setErrorMessage(null); setSuccessMessage(null);
    if (!selectedRole) { setErrorMessage(content.selectRoleError); return; }
    if (password !== confirmPassword) { setErrorMessage(language === 'fr' ? 'Les mots de passe ne correspondent pas.' : language === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.'); return; }
    setLoading(true);
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCity = city.trim();
    const { data, error } = await auth.signUp({
      email,
      password,
      options: {
        data: {
          role: selectedRole,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          city: normalizedCity
        }
      }
    });
    if (error) { setErrorMessage(error.message); setLoading(false); return; }
    if (data.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: normalizedFirstName || null,
          last_name: normalizedLastName || null,
          city: normalizedCity || null
        })
        .eq('id', data.user.id);
      if (profileError) {
        console.error('signup profile sync error:', profileError);
      }

      void triggerWelcomeEmail(data.user.id, data.session?.access_token ?? null);
    }
    const resolveDestination = async (
      userId: string,
      userEmail?: string | null,
      userMetadata?: Record<string, unknown> | null
    ) => {
      const profile = await fetchProfile({
        id: userId,
        email: userEmail ?? null,
        user_metadata: userMetadata ?? null
      });
      return profile.role === 'admin' ? 'adminDashboard' : profile.role === 'nettoyeur' ? 'cleanerDashboard' : 'clientDashboard';
    };

    if (data.session?.user?.id) {
      const destination = await resolveDestination(
        data.session.user.id,
        data.session.user.email,
        data.session.user.user_metadata as Record<string, unknown> | null
      );
      setLoading(false);
      navigateTo(destination);
      return;
    }

    if (data.user?.id) {
      const signInResult = await auth.signInWithPassword({ email, password });
      if (!signInResult.error && signInResult.data.user?.id) {
        const destination = await resolveDestination(
          signInResult.data.user.id,
          signInResult.data.user.email,
          signInResult.data.user.user_metadata as Record<string, unknown> | null
        );
        setLoading(false);
        navigateTo(destination);
        return;
      }
    }

    setSuccessMessage(content.success); setLoading(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-[#F7F7F7] px-4 py-10 sm:px-6 lg:px-8">
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        ogImage={seo.ogImage}
        hreflang={hreflang}
        noIndex
      />
      <AuthCard maxWidth="max-w-[520px]">
        <div className="flex flex-col items-center text-center"><div className="overflow-visible px-6 pt-2"><NettoyoLogo className="h-16 sm:h-18" /></div><h1 className="mt-5 text-3xl font-bold text-[#1A1A2E]">{content.title}</h1><p className="mt-2 text-[#6B7280]">{content.subtitle}</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => setSelectedRole('client')} className="text-left"><RoleCard title={content.client.title} description={content.client.description} tone="sky" selected={selectedRole === 'client'} faded={selectedRole === 'nettoyeur'} buttonLabel={selectedRole === 'client' ? content.selected : content.choose} icon={<Home size={28} />} /></button>
          <button type="button" onClick={() => setSelectedRole('nettoyeur')} className="text-left"><RoleCard title={content.cleaner.title} description={content.cleaner.description} tone="mint" selected={selectedRole === 'nettoyeur'} faded={selectedRole === 'client'} buttonLabel={selectedRole === 'nettoyeur' ? content.selected : content.choose} icon={<Sparkles size={28} />} /></button>
        </div>
        <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${selectedRole ? 'mt-8 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}><div className="overflow-hidden">{selectedRole ? <div><div className={`h-0.5 w-full ${selectedTone === 'sky' ? 'bg-[#4FC3F7]' : 'bg-[#A8E6CF]'}`} /><div className="pt-6"><h2 className="text-2xl font-bold text-[#1A1A2E]">{selectedRole === 'client' ? content.client.formTitle : content.cleaner.formTitle}</h2><form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSignup(); }}><div className="grid gap-4 sm:grid-cols-2"><InputField icon={<User size={18} />} placeholder={content.firstName} value={firstName} onChange={(event) => setFirstName(event.target.value)} /><InputField icon={<User size={18} />} placeholder={content.lastName} value={lastName} onChange={(event) => setLastName(event.target.value)} /></div><InputField icon={<Mail size={18} />} placeholder={content.email} value={email} onChange={(event) => setEmail(event.target.value)} /><InputField icon={<Lock size={18} />} placeholder={content.password} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} rightSlot={<button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} /><InputField icon={<Lock size={18} />} placeholder={content.confirmPassword} type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} rightSlot={<button type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />{selectedRole === 'nettoyeur' ? <InputField icon={<MapPin size={18} />} placeholder={content.city} value={city} onChange={(event) => setCity(event.target.value)} /> : null}<label className="flex items-start gap-3 text-sm text-[#6B7280]"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#4FC3F7]" /><span>{content.checkboxPrefix} <a href="#" className="text-[#4FC3F7] underline underline-offset-2">{content.checkboxLink}</a></span></label><AuthFeedback message={errorMessage} tone="error" /><AuthFeedback message={successMessage} tone="success" /><button type="submit" disabled={loading} className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 font-bold shadow-[0_14px_28px_rgba(17,24,39,0.12)] transition-all disabled:cursor-not-allowed disabled:opacity-70 ${selectedRole === 'client' ? 'bg-[#4FC3F7] text-white hover:bg-[#3FAAD4] hover:shadow-[0_18px_30px_rgba(79,195,247,0.34)]' : 'bg-[#A8E6CF] text-[#1A1A2E] hover:bg-[#97d9be] hover:shadow-[0_18px_30px_rgba(168,230,207,0.3)]'}`}>{loading ? <Spinner /> : null}{loading ? content.submitLoading : content.submit}</button></form><div className="mt-6"><Divider label={content.divider} /></div><div className="mt-6 space-y-3">{socialButtons.map((button) => <SocialButton key={button.label} label={button.label} icon={button.icon} />)}</div></div></div> : null}</div></div>
        {!selectedRole ? <div className="mt-6"><AuthFeedback message={errorMessage} tone="error" /></div> : null}
        <div className="my-8 h-px bg-[#E5E7EB]" />
        <div className="text-center"><p className="text-[#6B7280]">{content.already}</p><a href={loginPath} className="mt-4 inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-[#4FC3F7] bg-white px-6 py-3.5 font-bold text-[#4FC3F7] transition-colors hover:bg-[rgba(79,195,247,0.05)]">{content.login}</a></div>
      </AuthCard>
    </div>
  );
}
