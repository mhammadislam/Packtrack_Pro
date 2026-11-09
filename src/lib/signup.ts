import { supabase } from '@/lib/supabase';

export type SignupOutcome = 'pending_approval' | 'active' | 'duplicate_email' | 'error';

export const PENDING_APPROVAL_MESSAGE = 'Your account is pending approval. Please wait for Admin approval.';

const SUGGESTION_SUFFIXES = ['123', '_2026', '_pk', '_01', '_786'];

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('The username check returned an unexpected response.');
  return data;
}

export async function suggestUsernames(base: string): Promise<string[]> {
  const candidates = SUGGESTION_SUFFIXES.map((suffix) => `${base.slice(0, 20 - suffix.length)}${suffix}`);
  const results = await Promise.all(
    candidates.map(async (candidate) => ({ candidate, free: await isUsernameAvailable(candidate) })),
  );
  return results.filter((result) => result.free).slice(0, 3).map((result) => result.candidate);
}

interface SignupAttemptLog {
  username: string;
  email: string;
  phone: string;
  outcome: SignupOutcome;
  detail: string;
}

export async function logSignupAttempt(entry: SignupAttemptLog): Promise<void> {
  const { error } = await supabase.rpc('log_signup_attempt', {
    p_username: entry.username,
    p_email: entry.email,
    p_phone: entry.phone,
    p_outcome: entry.outcome,
    p_detail: entry.detail,
  });
  if (error) console.warn('Sign-up attempt could not be written to the audit log.', error.message);
}
