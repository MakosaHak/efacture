/**
 * Authentification : comptes dans IndexedDB (mot de passe haché, session
 * dans localStorage) et, si Supabase est configuré, le même compte créé
 * côté cloud (Supabase Auth) pour synchroniser entre appareils.
 *
 * Règle : l'identifiant local d'un compte synchronisé est l'identifiant
 * Supabase de l'utilisateur, ce qui permet les règles de sécurité par ligne.
 */
import type { Profile } from '../../types/invoice';
import type { AuthUser, LocalUserRecord, ProfileInput } from '../../types/auth';
import { getUserById, getUserByPhone, putUser, removeUser } from '../db/repo';
import { normalizePhoneDigits, validateTogoPhone } from './phone-auth';
import { cloudEnabled, isNetworkError, isOnline, phoneToEmail, supabase } from '../supabase';
import { fetchCloudProfile } from '../sync/cloud-sync';

const SESSION_KEY = 'efacture-session';

/** Compte d'exemple livré avec l'application (une vraie boutique, données réalistes). */
export const SAMPLE_ACCOUNT = {
  phone: '71795074',
  password: '12345678',
  profile: {
    nom_commerce: 'Chez Afi, Alimentation Générale',
    nom_personne: 'Afi KOUMAKO',
    adresse: 'Marché d’Assivito, rue des Tisserands, Lomé',
    quartier: 'Assivito',
    default_margin: 0.15,
  },
};

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const c of `${salt}:${password}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `fallback-${h.toString(16)}`;
}

export function toAuthUser(record: LocalUserRecord): AuthUser {
  return { id: record.id, phone: record.phone, created_at: record.created_at };
}

export function toProfile(record: LocalUserRecord): Profile {
  return { id: record.id, ...record.profile };
}

function newProfile(phone: string, input: Partial<ProfileInput>): Omit<Profile, 'id'> {
  const now = new Date().toISOString();
  return {
    nom_personne: input.nom_personne?.trim() || '',
    nom_commerce: input.nom_commerce?.trim() || '',
    telephone: phone,
    adresse: input.adresse?.trim() || '',
    quartier: input.quartier?.trim() || '',
    default_margin: input.default_margin,
    created_at: now,
    updated_at: now,
  };
}

async function createLocalRecord(id: string, phone: string, password: string, profile: Omit<Profile, 'id'>, isDemo = false): Promise<LocalUserRecord> {
  // Un ancien compte local avec ce numéro mais un autre identifiant (créé avant la synchronisation) laisse la place.
  const previous = await getUserByPhone(phone);
  if (previous && previous.id !== id) await removeUser(previous.id);
  const salt = randomHex();
  const record: LocalUserRecord = {
    id,
    phone,
    salt,
    password_hash: await hashPassword(password, salt),
    profile,
    is_demo: isDemo,
    created_at: new Date().toISOString(),
  };
  await putUser(record);
  return record;
}

/* ------------------------------------------------------------------ */
/* Cloud (Supabase Auth)                                               */
/* ------------------------------------------------------------------ */

function cloudMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/already registered|already exists|User already/i.test(msg)) return 'Ce numéro est déjà inscrit.';
  if (/Invalid login credentials/i.test(msg)) return 'Numéro ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Compte non confirmé côté serveur. Contactez l’administrateur.';
  if (/Password should be/i.test(msg)) return 'Mot de passe trop court (6 caractères minimum).';
  return msg;
}

async function cloudSignUp(phone: string, password: string): Promise<string> {
  if (!supabase) throw new Error('Cloud non configuré');
  const email = phoneToEmail(phone);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(cloudMessage(error));
  if (data.session?.user) return data.session.user.id;
  // Confirmation d'e-mail activée côté projet : on tente une connexion directe.
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) throw new Error('Compte créé mais non confirmé côté serveur. Désactivez la confirmation d’e-mail dans Supabase.');
  return signedIn.data.user.id;
}

async function cloudSignIn(phone: string, password: string): Promise<string> {
  if (!supabase) throw new Error('Cloud non configuré');
  const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error) throw new Error(cloudMessage(error));
  return data.user.id;
}

/* ------------------------------------------------------------------ */
/* Inscription / connexion                                             */
/* ------------------------------------------------------------------ */

export async function signUp(phoneRaw: string, password: string, input: ProfileInput): Promise<LocalUserRecord> {
  if (!validateTogoPhone(phoneRaw)) throw new Error('Numéro togolais invalide (ex : 90 12 34 56).');
  if (password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
  const phone = normalizePhoneDigits(phoneRaw);
  const profile = newProfile(phone, input);

  if (cloudEnabled && isOnline()) {
    const id = await cloudSignUp(phone, password);
    return createLocalRecord(id, phone, password, profile);
  }
  if (cloudEnabled) throw new Error('Connexion internet nécessaire pour créer un compte.');

  if (await getUserByPhone(phone)) throw new Error('Ce numéro est déjà inscrit sur cet appareil.');
  return createLocalRecord(crypto.randomUUID(), phone, password, profile);
}

export async function signIn(phoneRaw: string, password: string): Promise<LocalUserRecord> {
  if (!validateTogoPhone(phoneRaw)) throw new Error('Numéro togolais invalide (ex : 90 12 34 56).');
  const phone = normalizePhoneDigits(phoneRaw);

  const isSample = phone === SAMPLE_ACCOUNT.phone && password === SAMPLE_ACCOUNT.password;

  if (cloudEnabled && isOnline()) {
    try {
      let id: string;
      try {
        id = await cloudSignIn(phone, password);
      } catch (err) {
        // Le compte d'Afi n'existe pas encore côté cloud : on le crée à sa première connexion.
        if (isSample && !isNetworkError(err)) id = await cloudSignUp(phone, password);
        else throw err;
      }
      const existing = await getUserById(id);
      if (existing) {
        // Mot de passe peut-être changé sur un autre appareil : on réaligne le hachage local.
        const salt = randomHex();
        const refreshed = { ...existing, salt, password_hash: await hashPassword(password, salt) };
        await putUser(refreshed, { sync: false });
        return refreshed;
      }
      const cloud = await fetchCloudProfile(id);
      const { phone: _p, ...cloudProfile } = cloud ?? {};
      const profile = { ...newProfile(phone, isSample ? SAMPLE_ACCOUNT.profile : {}), ...cloudProfile };
      return createLocalRecord(id, phone, password, profile as Omit<Profile, 'id'>, isSample);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Réseau indisponible : repli sur le compte local s'il existe.
    }
  }

  const record = await getUserByPhone(phone);
  if (!record && isSample) {
    return createLocalRecord(crypto.randomUUID(), phone, password, newProfile(phone, SAMPLE_ACCOUNT.profile), true);
  }
  if (!record) {
    throw new Error(
      cloudEnabled ? 'Connexion internet nécessaire pour la première connexion sur cet appareil.' : 'Aucun compte avec ce numéro sur cet appareil.',
    );
  }
  const hash = await hashPassword(password, record.salt);
  if (hash !== record.password_hash) throw new Error('Mot de passe incorrect.');
  return record;
}

export async function updateUserProfile(userId: string, patch: Partial<Omit<Profile, 'id' | 'created_at'>>): Promise<LocalUserRecord> {
  const record = await getUserById(userId);
  if (!record) throw new Error('Compte introuvable.');
  const next: LocalUserRecord = {
    ...record,
    profile: { ...record.profile, ...patch, updated_at: new Date().toISOString() },
  };
  await putUser(next);
  return next;
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const record = await getUserById(userId);
  if (!record) throw new Error('Compte introuvable.');
  if ((await hashPassword(current, record.salt)) !== record.password_hash) {
    throw new Error('Mot de passe actuel incorrect.');
  }
  if (next.length < 6) throw new Error('Nouveau mot de passe : 6 caractères minimum.');
  if (cloudEnabled && supabase) {
    if (!isOnline()) throw new Error('Connexion internet nécessaire pour changer le mot de passe.');
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw new Error(cloudMessage(error));
  }
  const salt = randomHex();
  await putUser({ ...record, salt, password_hash: await hashPassword(next, salt) }, { sync: false });
}

/* ---------------- Session ---------------- */

export function saveSession(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  if (supabase) void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function restoreSession(): Promise<LocalUserRecord | null> {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const record = await getUserById(id);
  if (!record) {
    clearSession();
    return null;
  }
  if (record.phone === SAMPLE_ACCOUNT.phone && !record.profile.nom_personne) {
    return updateUserProfile(record.id, { nom_personne: SAMPLE_ACCOUNT.profile.nom_personne });
  }
  return record;
}
