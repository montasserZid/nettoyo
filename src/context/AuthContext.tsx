import type { AuthSession, AuthUser } from '@supabase/supabase-js';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import supabase from '../lib/supabase';

export type Profile = {
  id: string;
  email: string;
  role: 'client' | 'nettoyeur';
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isClient: () => boolean;
  isCleaner: () => boolean;
};

type AuthApi = {
  getSession: () => Promise<{ data: { session: AuthSession | null } }>;
  onAuthStateChange: (
    callback: (event: string, session: AuthSession | null) => void
  ) => { data: { subscription: { unsubscribe: () => void } } };
  signOut: () => Promise<unknown>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const auth = supabase.auth as unknown as AuthApi;

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (nextSession: AuthSession | null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const nextProfile = await fetchProfile(nextSession.user.id);
        if (isMounted) {
          setProfile(nextProfile);
        }
      } catch {
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const init = async () => {
      try {
        const {
          data: { session: currentSession }
        } = await auth.getSession();
        await syncAuthState(currentSession);
      } finally {
        if (isMounted && !session) {
          setLoading(false);
        }
      }
    };

    void init();

    const {
      data: { subscription }
    } = auth.onAuthStateChange((_event: string, nextSession: AuthSession | null) => {
      setLoading(true);
      void syncAuthState(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      signOut: async () => {
        await auth.signOut();
      },
      isClient: () => profile?.role === 'client',
      isCleaner: () => profile?.role === 'nettoyeur'
    }),
    [loading, profile, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
