/**
 * Authentification 100 % locale : comptes dans IndexedDB, mot de passe haché
 * (SHA-256 salé via WebCrypto), session mémorisée dans localStorage pour que
 * l'application installée reste connectée entre deux lancements.
 */
import type { Profile } from '../../types/invoice';
import type { AuthUser, LocalUserRecord, ProfileInput } from '../../types/auth';
import { getUserById, getUserByPhone, putUser } from '../db/repo';
import { normalizePhoneDigits, validateTogoPhone } from './phone-auth';

const SESSION_KEY = 'efacture-session';

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
  // Contexte non sécurisé (http sur réseau local) : repli simple, jamais en clair.
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

export async function signUp(phoneRaw: string, password: string, input: ProfileInput): Promise<LocalUserRecord> {
  if (!validateTogoPhone(phoneRaw)) throw new Error('Numéro togolais invalide (ex : 90 12 34 56).');
  if (password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
  const phone = normalizePhoneDigits(phoneRaw);
  if (await getUserByPhone(phone)) throw new Error('Ce numéro est déjà inscrit sur cet appareil.');

  const now = new Date().toISOString();
  const salt = randomHex();
  const record: LocalUserRecord = {
    id: crypto.randomUUID(),
    phone,
    salt,
    password_hash: await hashPassword(password, salt),
    profile: {
      nom_commerce: input.nom_commerce.trim(),
      telephone: phone,
      adresse: input.adresse?.trim() || '',
      quartier: input.quartier?.trim() || '',
      default_margin: input.default_margin,
      created_at: now,
      updated_at: now,
    },
    created_at: now,
  };
  await putUser(record);
  return record;
}

export async function signIn(phoneRaw: string, password: string): Promise<LocalUserRecord> {
  if (!validateTogoPhone(phoneRaw)) throw new Error('Numéro togolais invalide (ex : 90 12 34 56).');
  const record = await getUserByPhone(normalizePhoneDigits(phoneRaw));
  if (!record) throw new Error('Aucun compte avec ce numéro sur cet appareil.');
  const hash = await hashPassword(password, record.salt);
  if (hash !== record.password_hash) throw new Error('Mot de passe incorrect.');
  return record;
}

export async function updateUserProfile(userId: string, patch: Partial<ProfileInput>): Promise<LocalUserRecord> {
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
  const salt = randomHex();
  await putUser({ ...record, salt, password_hash: await hashPassword(next, salt) });
}

/* ---------------- Session ---------------- */

export function saveSession(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function restoreSession(): Promise<LocalUserRecord | null> {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const record = await getUserById(id);
  if (!record) {
    clearSession();
    return null;
  }
  return record;
}

/** Création d'un compte de démonstration (identifiants fixes) si absent. */
export async function ensureDemoUser(): Promise<LocalUserRecord> {
  const phone = '90000000';
  const existing = await getUserByPhone(phone);
  if (existing) return existing;
  const now = new Date().toISOString();
  const salt = randomHex();
  const record: LocalUserRecord = {
    id: 'demo-local-user',
    phone,
    salt,
    password_hash: await hashPassword('demo', salt),
    is_demo: true,
    profile: {
      nom_commerce: 'Épicerie Demo Adawlato',
      telephone: phone,
      adresse: 'Marché Adawlato, Lomé',
      quartier: 'Adawlato',
      default_margin: 0.15,
      created_at: now,
      updated_at: now,
    },
    created_at: now,
  };
  await putUser(record);
  return record;
}
