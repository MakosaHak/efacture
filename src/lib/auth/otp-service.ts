import { isSupabaseConfigured, supabase } from '../supabase';
import { isDemoMode } from '../demo/demo-mode';
import { toE164 } from './phone-auth';

const OTP_PREFIX = 'efacture-otp:';
const OTP_TTL_MS = 5 * 60 * 1000;

interface StoredOtp {
  code: string;
  expires: number;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeDemoOtp(phoneE164: string, code: string): void {
  const payload: StoredOtp = { code, expires: Date.now() + OTP_TTL_MS };
  sessionStorage.setItem(`${OTP_PREFIX}${phoneE164}`, JSON.stringify(payload));
}

function readDemoOtp(phoneE164: string): StoredOtp | null {
  const raw = sessionStorage.getItem(`${OTP_PREFIX}${phoneE164}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOtp;
  } catch {
    return null;
  }
}

export interface SendOtpResult {
  /** Code affiché en mode démo / dev (pas de SMS réel) */
  demoCode?: string;
  message: string;
}

/** Envoie un OTP SMS — Supabase si configuré, sinon code démo à l'écran */
export async function sendPhoneOtp(phoneRaw: string): Promise<SendOtpResult> {
  const phone = toE164(phoneRaw);
  const code = generateCode();
  storeDemoOtp(phone, code);

  if (!isSupabaseConfigured || isDemoMode()) {
    return {
      demoCode: code,
      message: `Code envoyé (simulation). Valide 5 min.`,
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        demoCode: code,
        message: `SMS non configuré sur Supabase — code démo : ${code}`,
      };
    }
    return { message: 'Code envoyé par SMS.' };
  } catch {
    return {
      demoCode: code,
      message: `Code démo (SMS indisponible) : ${code}`,
    };
  }
}

export async function verifyPhoneOtp(phoneRaw: string, token: string): Promise<void> {
  const phone = toE164(phoneRaw);
  const stored = readDemoOtp(phone);

  if (stored && stored.expires > Date.now() && stored.code === token.trim()) {
    sessionStorage.removeItem(`${OTP_PREFIX}${phone}`);
  } else if (isSupabaseConfigured && !isDemoMode()) {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: token.trim(),
      type: 'sms',
    });
    if (error) throw error;
    return;
  } else {
    throw new Error('Code incorrect ou expiré.');
  }
}

export function checkDemoOtpOnly(phoneRaw: string, token: string): boolean {
  const phone = toE164(phoneRaw);
  const stored = readDemoOtp(phone);
  if (!stored || stored.expires <= Date.now()) return false;
  return stored.code === token.trim();
}
