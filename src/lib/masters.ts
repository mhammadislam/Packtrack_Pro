import { supabase } from '@/lib/supabase';
import type { DepartmentCode } from '@/lib/constants';
import type { Machine, Operator, Profile } from '@/lib/types';

export async function fetchOperators(): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operators')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOperator(name: string): Promise<Operator> {
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from('operators')
    .insert({ name: trimmed })
    .select('id, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      const existing = await supabase
        .from('operators')
        .select('id, name')
        .ilike('name', trimmed)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
    }
    throw error;
  }
  if (!data) throw new Error('The operator could not be saved.');
  return data;
}

export async function deleteOperator(id: string) {
  const { error } = await supabase.rpc('soft_delete_operator', { p_id: id });
  if (error) throw error;
}

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('id, department, name')
    .order('department', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Machine[];
}

export async function createMachine(department: DepartmentCode, name: string) {
  const { error } = await supabase.from('machines').insert({ department, name: name.trim() });
  if (error) {
    if (error.code === '23505') throw new Error('This machine already exists in that department.');
    throw error;
  }
}

export async function deleteMachine(id: string) {
  const { error } = await supabase.rpc('soft_delete_machine', { p_id: id });
  if (error) throw error;
}

export const PROFILE_COLUMNS = 'id, full_name, email, role, status, is_suspended, can_delete_entries, can_view_reports';

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export interface UserAccessUpdate {
  role: Profile['role'];
  is_suspended: boolean;
  can_delete_entries: boolean;
  can_view_reports: boolean;
}

export async function setUserAccess(userId: string, access: UserAccessUpdate) {
  const { error } = await supabase.rpc('set_user_access', {
    p_user_id: userId,
    p_role: access.role,
    p_is_suspended: access.is_suspended,
    p_can_delete_entries: access.can_delete_entries,
    p_can_view_reports: access.can_view_reports,
  });
  if (error) throw error;
}
