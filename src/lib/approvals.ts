import { supabase } from '@/lib/supabase';

export interface PendingApproval {
  id: string;
  user_id: string;
  username: string;
  email: string;
  phone: string;
  requested_at: string;
  full_name: string;
}

interface ApprovalRow extends Omit<PendingApproval, 'full_name'> {
  profile: { full_name: string } | null;
}

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('id, user_id, username, email, phone, requested_at, profile:profiles!approval_requests_user_id_fkey(full_name)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ApprovalRow[]).map(({ profile, ...row }) => ({ ...row, full_name: profile?.full_name ?? '' }));
}

export async function approveSignup(userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_signup', { p_user_id: userId });
  if (error) throw error;
}

export async function rejectSignup(userId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_signup', { p_user_id: userId, p_reason: reason });
  if (error) throw error;
}
