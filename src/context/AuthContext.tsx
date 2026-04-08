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
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileSource = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => void;
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

export async function fetchProfile(input: string | ProfileSource) {
  const source: ProfileSource = typeof input === 'string' ? { id: input } : input;
  const now = new Date().toISOString();
  const fallbackRole = source.user_metadata?.role === 'nettoyeur' ? 'nettoyeur' : 'client';
  const metadataFirstName =
    typeof source.user_metadata?.first_name === 'string' && source.user_metadata.first_name.trim().length > 0
      ? source.user_metadata.first_name.trim()
      : null;
  const metadataLastName =
    typeof source.user_metadata?.last_name === 'string' && source.user_metadata.last_name.trim().length > 0
      ? source.user_metadata.last_name.trim()
      : null;
  const metadataCity =
    typeof source.user_metadata?.city === 'string' && source.user_metadata.city.trim().length > 0
      ? source.user_metadata.city.trim()
      : null;

  const fallbackProfile: Profile = {
    id: source.id,
    email: source.email ?? '',
    role: fallbackRole,
    first_name: metadataFirstName,
    last_name: metadataLastName,
    city: metadataCity,
    phone: null,
    avatar_url: null,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', source.id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') {
      return fallbackProfile;
    }
    throw new Error(error.message ?? 'Unable to load profile.');
  }

  const dbProfile = (data as Profile | null) ?? null;
  if (!dbProfile) {
    return fallbackProfile;
  }

  const mergedProfile: Profile = {
    ...dbProfile,
    email: dbProfile.email || source.email || '',
    first_name: dbProfile.first_name ?? metadataFirstName,
    last_name: dbProfile.last_name ?? metadataLastName,
    city: dbProfile.city ?? metadataCity
  };

  const identityPatch: Partial<Profile> = {};
  if (!dbProfile.first_name && metadataFirstName) {
    identityPatch.first_name = metadataFirstName;
  }
  if (!dbProfile.last_name && metadataLastName) {
    identityPatch.last_name = metadataLastName;
  }
  if (!dbProfile.city && metadataCity) {
    identityPatch.city = metadataCity;
  }

  if (Object.keys(identityPatch).length > 0) {
    const { error: patchError } = await supabase.from('profiles').update(identityPatch).eq('id', source.id);
    if (patchError) {
      console.error('profile identity sync error:', patchError);
    }
  }

  return mergedProfile;
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
        const nextProfile = await fetchProfile({
          id: nextSession.user.id,
          email: nextSession.user.email,
          user_metadata: nextSession.user.user_metadata as Record<string, unknown> | null
        });
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
    } = auth.onAuthStateChange((event: string, nextSession: AuthSession | null) => {
      if (!isMounted) {
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        void syncAuthState(nextSession);
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
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
      updateProfile: (patch: Partial<Profile>) => {
        setProfile((current) => {
          if (!current) return current;
          return {
            ...current,
            ...patch,
            updated_at: new Date().toISOString()
          };
        });
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
