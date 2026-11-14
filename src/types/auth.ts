import type { Profile } from './invoice';

/** Utilisateur connecté (exposé à l'interface). */
export interface AuthUser {
  id: string;
  phone: string;
  created_at: string;
}

/** Enregistrement d'un compte dans la base locale (mot de passe haché). */
export interface LocalUserRecord {
  id: string;
  /** 8 chiffres, sans indicatif. */
  phone: string;
  password_hash: string;
  salt: string;
  profile: Omit<Profile, 'id'>;
  is_demo?: boolean;
  created_at: string;
}

export type ProfileInput = Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
