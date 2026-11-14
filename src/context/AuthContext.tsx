import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '../types/invoice';
import type { AuthUser, LocalUserRecord, ProfileInput } from '../types/auth';
import {
  changePassword as authChangePassword,
  clearSession,
  ensureDemoUser,
  restoreSession,
  saveSession,
  signIn as authSignIn,
  signUp as authSignUp,
  toAuthUser,
  toProfile,
  updateUserProfile,
} from '../lib/auth/local-auth';
import { seedDemoData } from '../lib/demo/seed';
import { requestPersistentStorage } from '../lib/db/local-db';
import { normalizePhoneDigits, validateTogoPhone } from '../lib/auth/phone-auth';

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isDemo: boolean;
  signInWithPhonePassword: (phone: string, password: string) => Promise<void>;
  signUpWithPhonePassword: (phone: string, password: string, profile: ProfileInput) => Promise<void>;
  updateProfile: (data: ProfileInput) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((record: LocalUserRecord) => {
    setUser(toAuthUser(record));
    setProfile(toProfile(record));
    setIsDemo(Boolean(record.is_demo));
    saveSession(record.id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((record) => {
        if (cancelled) return;
        if (record) {
          setUser(toAuthUser(record));
          setProfile(toProfile(record));
          setIsDemo(Boolean(record.is_demo));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void requestPersistentStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithPhonePassword = useCallback(
    async (phone: string, password: string) => {
      apply(await authSignIn(phone, password));
    },
    [apply],
  );

  const signUpWithPhonePassword = useCallback(
    async (phone: string, password: string, input: ProfileInput) => {
      apply(await authSignUp(phone, password, input));
    },
    [apply],
  );

  const updateProfile = useCallback(
    async (data: ProfileInput) => {
      if (!user) throw new Error('Non connecté.');
      const nom_commerce = data.nom_commerce.trim();
      if (nom_commerce.length < 2) throw new Error('Indiquez le nom du commerce.');
      let telephone = data.telephone.trim();
      if (telephone) {
        if (!validateTogoPhone(telephone)) throw new Error('Numéro togolais invalide (ex : 90 12 34 56).');
        telephone = normalizePhoneDigits(telephone);
      }
      const record = await updateUserProfile(user.id, {
        nom_commerce,
        telephone,
        adresse: data.adresse.trim(),
        quartier: data.quartier.trim(),
      });
      setProfile(toProfile(record));
    },
    [user],
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error('Non connecté.');
      await authChangePassword(user.id, current, next);
    },
    [user],
  );

  const signInDemo = useCallback(async () => {
    const record = await ensureDemoUser();
    await seedDemoData(record.id);
    apply(record);
  }, [apply]);

  const signOut = useCallback(async () => {
    clearSession();
    setUser(null);
    setProfile(null);
    setIsDemo(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isDemo,
      signInWithPhonePassword,
      signUpWithPhonePassword,
      updateProfile,
      changePassword,
      signInDemo,
      signOut,
    }),
    [user, profile, loading, isDemo, signInWithPhonePassword, signUpWithPhonePassword, updateProfile, changePassword, signInDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
