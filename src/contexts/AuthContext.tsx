import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { PROFILE_COLUMNS } from '@/lib/masters';
import { logSignupAttempt, PENDING_APPROVAL_MESSAGE, type SignupOutcome } from '@/lib/signup';

export interface SignUpInput {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface SignUpResult {
  outcome: SignupOutcome;
  message: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  accessNotice: string | null;
  isAdmin: boolean;
  isFirstAdmin: boolean;
  canDeleteEntries: boolean;
  canViewReports: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AccessResult {
  profile: Profile | null;
  isFirstAdmin: boolean;
  error: string | null;
  notice: string | null;
}

const LOAD_ERROR: AccessResult = {
  profile: null,
  isFirstAdmin: false,
  error: 'Your profile could not be loaded. Please try again.',
  notice: null,
};

async function rejectedNotice(userId: string): Promise<string> {
  const { data } = await supabase
    .from('approval_requests')
    .select('rejection_reason')
    .eq('user_id', userId)
    .maybeSingle();
  const reason = data?.rejection_reason?.trim();
  return reason
    ? `Your account request was not approved. Reason: ${reason}`
    : 'Your account request was not approved. Please contact the administrator.';
}

async function fetchAccess(userId: string): Promise<AccessResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) return LOAD_ERROR;
  if (!data) return { ...LOAD_ERROR, error: 'Your profile was not found. Please contact your administrator.' };
  const profile = data as Profile;
  if (profile.status === 'pending_approval') {
    return { profile: null, isFirstAdmin: false, error: null, notice: PENDING_APPROVAL_MESSAGE };
  }
  if (profile.status === 'rejected') {
    return { profile: null, isFirstAdmin: false, error: null, notice: await rejectedNotice(userId) };
  }
  if (profile.is_suspended) {
    return {
      profile: null,
      isFirstAdmin: false,
      error: 'Your access has been suspended. Please contact the first administrator.',
      notice: null,
    };
  }
  const { data: firstAdmin, error: firstAdminError } = await supabase.rpc('is_first_admin');
  if (firstAdminError) return LOAD_ERROR;
  return { profile, isFirstAdmin: firstAdmin === true, error: null, notice: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const clearSession = () => {
      setSession(null);
      setProfile(null);
      setIsFirstAdmin(false);
      setProfileError(null);
      setLoading(false);
    };

    const applySession = (nextSession: Session | null) => {
      (async () => {
        if (!active) return;
        if (!nextSession) {
          clearSession();
          return;
        }
        const result = await fetchAccess(nextSession.user.id);
        if (!active) return;
        if (result.notice) {
          clearSession();
          setAccessNotice(result.notice);
          await supabase.auth.signOut();
          return;
        }
        setSession(nextSession);
        setProfile(result.profile);
        setIsFirstAdmin(result.isFirstAdmin);
        setProfileError(result.error);
        setLoading(false);
      })();
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAccessNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    if (error.message.toLowerCase().includes('invalid login credentials')) return 'The email or password is incorrect.';
    if (error instanceof TypeError) return 'Could not reach the server. Check your internet connection and try again.';
    return error.message;
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    const email = input.email.trim();
    const username = input.username.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name: input.fullName.trim(), username, phone: input.phone } },
    });

    const log = (outcome: SignupOutcome, detail: string) =>
      logSignupAttempt({ username, email, phone: input.phone, outcome, detail });

    if (error) {
      const duplicate = error.message.toLowerCase().includes('already registered');
      const outcome: SignupOutcome = duplicate ? 'duplicate_email' : 'error';
      const message = duplicate
        ? 'An account with this email already exists. Please sign in instead.'
        : error.message;
      await log(outcome, error.message);
      return { outcome, message };
    }
    if (!data.user) {
      await log('error', 'No user returned');
      return { outcome: 'error', message: 'Your account could not be created. Please try again.' };
    }

    const { data: row } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', data.user.id)
      .maybeSingle();
    const outcome: SignupOutcome = row?.status === 'active' ? 'active' : 'pending_approval';
    await log(outcome, outcome);
    return { outcome, message: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      accessNotice,
      isAdmin: profile?.role === 'admin',
      isFirstAdmin,
      canDeleteEntries: profile?.role === 'admin' || profile?.can_delete_entries === true,
      canViewReports: profile?.role === 'admin' || profile?.can_view_reports === true,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, isFirstAdmin, loading, profileError, accessNotice, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
