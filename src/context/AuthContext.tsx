import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

  type ReactNode,

} from 'react';

import type { Session, User } from '@supabase/supabase-js';

import { phoneToInternalEmail, validateTogoPhone } from '../lib/auth/phone-auth';

import {

  localFindByPhone,

  localSignInWithPhone,

  localSignUpWithPhone,

  localUserToProfile,

  type LocalPhoneUser,

} from '../lib/auth/local-phone-users';

import { sendPhoneOtp, verifyPhoneOtp, type SendOtpResult } from '../lib/auth/otp-service';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

import { DEMO_USER_ID, disableDemoMode, enableDemoMode, isDemoMode } from '../lib/demo/demo-mode';

import { DEMO_PROFILE, resetDemoStore } from '../lib/demo/demo-store';

import type { Profile } from '../types/invoice';



type ProfileInput = Omit<Profile, 'id' | 'created_at' | 'updated_at'>;



interface AuthContextValue {

  user: User | null;

  session: Session | null;

  profile: Profile | null;

  loading: boolean;

  isLocalDemo: boolean;

  signInWithPhonePassword: (phone: string, password: string) => Promise<void>;

  signUpWithPhonePassword: (phone: string, password: string, profile: ProfileInput) => Promise<void>;

  sendOtp: (phone: string) => Promise<SendOtpResult>;

  signInWithPhoneOtp: (phone: string, code: string) => Promise<void>;

  signUpWithPhoneOtp: (phone: string, code: string, profile: ProfileInput, password?: string) => Promise<void>;

  signInDemo: () => Promise<void>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;

}



const AuthContext = createContext<AuthContextValue | null>(null);



const LOCAL_SESSION_KEY = 'efacture-local-session';



const LOCAL_DEMO_USER = {

  id: DEMO_USER_ID,

  email: 'demo@e-facture.local',

  app_metadata: {},

  user_metadata: {},

  aud: 'authenticated',

  created_at: new Date().toISOString(),

} as User;



function userFromLocal(local: LocalPhoneUser): User {

  return {

    id: local.id,

    email: phoneToInternalEmail(local.phone),

    app_metadata: {},

    user_metadata: { phone: local.phone },

    aud: 'authenticated',

    created_at: new Date().toISOString(),

  } as User;

}



function activateLocalDemo(

  setUser: (u: User | null) => void,

  setProfile: (p: Profile | null) => void,

  setIsLocalDemo: (v: boolean) => void,

) {

  enableDemoMode();

  resetDemoStore();

  setUser(LOCAL_DEMO_USER);

  setProfile(DEMO_PROFILE);

  setIsLocalDemo(true);

}



function persistLocalSession(userId: string) {

  sessionStorage.setItem(LOCAL_SESSION_KEY, userId);

  disableDemoMode();

}



function clearLocalSession() {

  sessionStorage.removeItem(LOCAL_SESSION_KEY);

}



function restoreLocalSession(

  setUser: (u: User | null) => void,

  setProfile: (p: Profile | null) => void,

  setIsLocalDemo: (v: boolean) => void,

): boolean {

  const id = sessionStorage.getItem(LOCAL_SESSION_KEY);

  if (!id) return false;

  try {

    const users = JSON.parse(localStorage.getItem('efacture-local-users') || '[]') as LocalPhoneUser[];

    const found = users.find((u) => u.id === id);

    if (!found) return false;

    setUser(userFromLocal(found));

    setProfile(localUserToProfile(found));

    setIsLocalDemo(false);

    return true;

  } catch {

    return false;

  }

}



export function AuthProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<User | null>(null);

  const [session, setSession] = useState<Session | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);

  const [isLocalDemo, setIsLocalDemo] = useState(false);



  const loadProfile = useCallback(async (userId: string) => {

    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    setProfile(data as Profile | null);

  }, []);



  useEffect(() => {

    if (isDemoMode()) {

      activateLocalDemo(setUser, setProfile, setIsLocalDemo);

      setLoading(false);

      return;

    }



    if (restoreLocalSession(setUser, setProfile, setIsLocalDemo)) {

      setLoading(false);

      return;

    }



    if (!isSupabaseConfigured) {

      setLoading(false);

      return;

    }



    supabase.auth.getSession().then(({ data }) => {

      setSession(data.session);

      setUser(data.session?.user ?? null);

      if (data.session?.user) {

        loadProfile(data.session.user.id).finally(() => setLoading(false));

      } else {

        setLoading(false);

      }

    });



    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {

      if (isDemoMode()) return;

      setSession(newSession);

      setUser(newSession?.user ?? null);

      if (newSession?.user) {

        loadProfile(newSession.user.id);

      } else {

        setProfile(null);

      }

    });



    return () => sub.subscription.unsubscribe();

  }, [loadProfile]);



  const signInWithPhonePassword = async (phone: string, password: string) => {

    if (!validateTogoPhone(phone)) throw new Error('Numéro togolais invalide (ex: 90 12 34 56).');



    if (!isSupabaseConfigured) {

      const local = localSignInWithPhone(phone, password);

      if (!local) throw new Error('Numéro ou mot de passe incorrect.');

      setUser(userFromLocal(local));

      setProfile(localUserToProfile(local));

      persistLocalSession(local.id);

      setIsLocalDemo(false);

      return;

    }



    const email = phoneToInternalEmail(phone);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;

    disableDemoMode();

    setIsLocalDemo(false);

  };



  const signUpWithPhonePassword = async (phone: string, password: string, p: ProfileInput) => {

    if (!validateTogoPhone(phone)) throw new Error('Numéro togolais invalide.');

    if (password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.');



    if (!isSupabaseConfigured) {

      const local = localSignUpWithPhone(phone, password, { ...p, telephone: phone.replace(/\D/g, '').slice(-8) });

      setUser(userFromLocal(local));

      setProfile(localUserToProfile(local));

      persistLocalSession(local.id);

      setIsLocalDemo(false);

      return;

    }



    const email = phoneToInternalEmail(phone);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) throw error;

    if (data.user) {

      const { error: profileErr } = await supabase.from('profiles').insert({

        id: data.user.id,

        nom_commerce: p.nom_commerce,

        telephone: phone.replace(/\D/g, '').slice(-8),

        adresse: p.adresse || '',

        quartier: p.quartier || '',

      });

      if (profileErr) throw profileErr;

    }

    disableDemoMode();

    setIsLocalDemo(false);

  };



  const sendOtp = (phone: string) => {

    if (!validateTogoPhone(phone)) throw new Error('Numéro togolais invalide.');

    return sendPhoneOtp(phone);

  };



  const signInWithPhoneOtp = async (phone: string, code: string) => {

    if (!validateTogoPhone(phone)) throw new Error('Numéro togolais invalide.');



    if (!isSupabaseConfigured) {

      await verifyPhoneOtp(phone, code);

      const existing = localFindByPhone(phone);

      if (!existing) throw new Error('Numéro non inscrit — créez un compte d\'abord.');

      setUser(userFromLocal(existing));

      setProfile(localUserToProfile(existing));

      persistLocalSession(existing.id);

      setIsLocalDemo(false);

      return;

    }



    await verifyPhoneOtp(phone, code);

    disableDemoMode();

    setIsLocalDemo(false);

  };



  const signUpWithPhoneOtp = async (

    phone: string,

    code: string,

    p: ProfileInput,

    password?: string,

  ) => {

    if (!validateTogoPhone(phone)) throw new Error('Numéro togolais invalide.');



    if (!isSupabaseConfigured) {

      await verifyPhoneOtp(phone, code);

      if (localFindByPhone(phone)) throw new Error('Ce numéro est déjà inscrit.');

      const pwd = password && password.length >= 6 ? password : `otp-${crypto.randomUUID().slice(0, 8)}`;

      const local = localSignUpWithPhone(phone, pwd, {

        ...p,

        telephone: phone.replace(/\D/g, '').slice(-8),

      });

      setUser(userFromLocal(local));

      setProfile(localUserToProfile(local));

      persistLocalSession(local.id);

      setIsLocalDemo(false);

      return;

    }



    await verifyPhoneOtp(phone, code);

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session?.user) {

      await supabase.from('profiles').upsert({

        id: sessionData.session.user.id,

        nom_commerce: p.nom_commerce,

        telephone: phone.replace(/\D/g, '').slice(-8),

        adresse: p.adresse || '',

        quartier: p.quartier || '',

      });

      if (password && password.length >= 6) {

        await supabase.auth.updateUser({ password });

      }

    }

    disableDemoMode();

    setIsLocalDemo(false);

  };



  const signInDemo = async () => {

    activateLocalDemo(setUser, setProfile, setIsLocalDemo);

    clearLocalSession();

  };



  const signOut = async () => {

    if (isLocalDemo || isDemoMode()) {

      disableDemoMode();

      setUser(null);

      setProfile(null);

      setSession(null);

      setIsLocalDemo(false);

      clearLocalSession();

      return;

    }

    clearLocalSession();

    await supabase.auth.signOut();

  };



  const refreshProfile = async () => {

    if (isLocalDemo) {

      setProfile(DEMO_PROFILE);

      return;

    }

    if (user && isSupabaseConfigured) await loadProfile(user.id);

  };



  const value = useMemo(

    () => ({

      user,

      session,

      profile,

      loading,

      isLocalDemo,

      signInWithPhonePassword,

      signUpWithPhonePassword,

      sendOtp,

      signInWithPhoneOtp,

      signUpWithPhoneOtp,

      signInDemo,

      signOut,

      refreshProfile,

    }),

    [user, session, profile, loading, isLocalDemo, loadProfile],

  );



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}



export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;

}


