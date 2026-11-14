import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '../types/invoice';
import type { AuthUser, LocalUserRecord, ProfileInput } from '../types/auth';
import {
  changePassword as authChangePassword,
  clearSession,
  ensureSampleUser,
  restoreSession,
  saveSession,
  signIn as authSignIn,
  signUp as authSignUp,
  toAuthUser,
  toProfile,
  updateUserProfile,
} from '../lib/auth/local-auth';
import { seedSampleData } from '../lib/demo/seed';
import { requestPersistentStorage } from '../lib/db/local-db';
import { getUserById, putPhoto, removePhoto } from '../lib/db/repo';
import { normalizePhoneDigits, validateTogoPhone } from '../lib/auth/phone-auth';
import { cloudEnabled } from '../lib/supabase';
import { countCloudInvoices, getSyncState, onRemoteData, onSyncState, startSync, stopSync, syncNow, type SyncState } from '../lib/sync/cloud-sync';

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  /** Incrémenté quand des données arrivent du cloud : les écrans se rechargent. */
  dataVersion: number;
  sync: SyncState;
  cloudEnabled: boolean;
  syncNow: () => Promise<void>;
  signInWithPhonePassword: (phone: string, password: string) => Promise<void>;
  signUpWithPhonePassword: (phone: string, password: string, profile: ProfileInput) => Promise<void>;
  updateProfile: (data: ProfileInput) => Promise<void>;
  updateAvatar: (blob: Blob) => Promise<void>;
  removeAvatar: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  signInSample: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);
  const [sync, setSync] = useState<SyncState>(getSyncState());

  const apply = useCallback((record: LocalUserRecord) => {
    setUser(toAuthUser(record));
    setProfile(toProfile(record));
    saveSession(record.id);
    if (cloudEnabled) void startSync(record.id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((record) => {
        if (cancelled) return;
        if (record) {
          setUser(toAuthUser(record));
          setProfile(toProfile(record));
          if (cloudEnabled) void startSync(record.id);
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

  // Données arrivées du cloud : on rafraîchit les écrans et le profil affiché.
  useEffect(() => {
    const offData = onRemoteData(() => {
      setDataVersion((v) => v + 1);
      const id = user?.id;
      if (id) void getUserById(id).then((r) => r && setProfile(toProfile(r)));
    });
    const offState = onSyncState(setSync);
    return () => {
      offData();
      offState();
    };
  }, [user?.id]);

  /** Compte d'Afi : ses reçus d'exemple sont créés une seule fois, lors de sa première connexion. */
  const seedIfSample = useCallback(async (record: LocalUserRecord) => {
    if (!record.is_demo) return false;
    if (cloudEnabled) {
      await startSync(record.id);
      if ((await countCloudInvoices(record.id)) > 0) return false;
    }
    return seedSampleData(record.id);
  }, []);

  const signInWithPhonePassword = useCallback(
    async (phone: string, password: string) => {
      const record = await authSignIn(phone, password);
      saveSession(record.id);
      const seeded = await seedIfSample(record);
      apply((await getUserById(record.id)) ?? record);
      if (seeded) setDataVersion((v) => v + 1);
    },
    [apply, seedIfSample],
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
        nom_personne: (data.nom_personne || '').trim(),
        nom_commerce,
        telephone,
        adresse: data.adresse.trim(),
        quartier: data.quartier.trim(),
      });
      setProfile(toProfile(record));
    },
    [user],
  );

  const updateAvatar = useCallback(
    async (blob: Blob) => {
      if (!user) throw new Error('Non connecté.');
      const avatar_path = await putPhoto(`avatar-${user.id}-${Date.now()}`, blob, user.id);
      const previous = profile?.avatar_path;
      const record = await updateUserProfile(user.id, { avatar_path });
      if (previous) await removePhoto(previous, user.id);
      setProfile(toProfile(record));
    },
    [user, profile?.avatar_path],
  );

  const removeAvatar = useCallback(async () => {
    if (!user) throw new Error('Non connecté.');
    const previous = profile?.avatar_path;
    const record = await updateUserProfile(user.id, { avatar_path: undefined });
    if (previous) await removePhoto(previous, user.id);
    setProfile(toProfile(record));
  }, [user, profile?.avatar_path]);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error('Non connecté.');
      await authChangePassword(user.id, current, next);
    },
    [user],
  );

  const signInSample = useCallback(async () => {
    const record = await ensureSampleUser();
    saveSession(record.id);
    if (cloudEnabled) {
      // Les données existent peut-être déjà dans le cloud (autre appareil) : on les rapatrie avant de semer.
      await startSync(record.id);
      const already = await countCloudInvoices(record.id);
      if (already === 0) await seedSampleData(record.id);
    } else {
      await seedSampleData(record.id);
    }
    const fresh = (await getUserById(record.id)) ?? record;
    apply(fresh);
    setDataVersion((v) => v + 1);
  }, [apply]);

  const signOut = useCallback(async () => {
    stopSync();
    clearSession();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      dataVersion,
      sync,
      cloudEnabled,
      syncNow,
      signInWithPhonePassword,
      signUpWithPhonePassword,
      updateProfile,
      updateAvatar,
      removeAvatar,
      changePassword,
      signInSample,
      signOut,
    }),
    [user, profile, loading, dataVersion, sync, signInWithPhonePassword, signUpWithPhonePassword, updateProfile, updateAvatar, removeAvatar, changePassword, signInSample, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
