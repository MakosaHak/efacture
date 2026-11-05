import { normalizePhoneDigits, phoneToInternalEmail, validateTogoPhone } from './phone-auth';
import type { Profile } from '../../types/invoice';

const USERS_KEY = 'efacture-local-users';

export interface LocalPhoneUser {
  id: string;
  phone: string;
  password: string;
  profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
}

function loadUsers(): LocalPhoneUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as LocalPhoneUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalPhoneUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function localSignUpWithPhone(
  phoneRaw: string,
  password: string,
  profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>,
): LocalPhoneUser {
  const phone = normalizePhoneDigits(phoneRaw);
  if (!validateTogoPhone(phoneRaw)) throw new Error('Numéro togolais invalide.');
  const users = loadUsers();
  if (users.some((u) => u.phone === phone)) {
    throw new Error('Ce numéro est déjà inscrit.');
  }
  const user: LocalPhoneUser = {
    id: crypto.randomUUID(),
    phone,
    password,
    profile: { ...profile, telephone: phone },
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function localSignInWithPhone(phoneRaw: string, password: string): LocalPhoneUser | null {
  const phone = normalizePhoneDigits(phoneRaw);
  return loadUsers().find((u) => u.phone === phone && u.password === password) ?? null;
}

export function localFindByPhone(phoneRaw: string): LocalPhoneUser | null {
  const phone = normalizePhoneDigits(phoneRaw);
  return loadUsers().find((u) => u.phone === phone) ?? null;
}

export function localUserToProfile(user: LocalPhoneUser): Profile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    nom_commerce: user.profile.nom_commerce,
    telephone: user.profile.telephone || user.phone,
    adresse: user.profile.adresse || '',
    quartier: user.profile.quartier || '',
    marge_beneficiaire_defaut: user.profile.marge_beneficiaire_defaut,
    created_at: now,
    updated_at: now,
  };
}

export function localUpdateProfile(
  userId: string,
  patch: Omit<Profile, 'id' | 'created_at' | 'updated_at'>,
): LocalPhoneUser | null {
  const users = loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) return null;
  users[index] = {
    ...users[index],
    profile: { ...users[index].profile, ...patch },
  };
  saveUsers(users);
  return users[index];
}

export { phoneToInternalEmail, validateTogoPhone, normalizePhoneDigits };
