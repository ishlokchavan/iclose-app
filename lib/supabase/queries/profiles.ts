import { supabase } from '../client';
import type { Profile, UserRole } from '../../../types/database';

export interface FullUserProfile {
  // from profiles
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan_key: string;
  created_at: string;
  updated_at: string;
  // from leads (null if user has no matching lead record)
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  source: string | null;
  is_verified: boolean | null;
  verified_at: string | null;
  lead_created_at: string | null;
  consent_marketing: boolean | null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Profile;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'role' | 'headline' | 'bio'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateUserRole(
  userId: string,
  role: Profile['role'],
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function fetchFullUserProfile(userId: string): Promise<FullUserProfile | null> {
  const { data, error } = await supabase.rpc('get_full_user_profile', { p_id: userId });
  if (error) throw error;
  return data as FullUserProfile | null;
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (error) throw error;
}
