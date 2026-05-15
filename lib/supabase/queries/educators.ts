import { supabase } from '../client';
import type { Educator } from '../../../types/database';

export async function fetchEducators(): Promise<Educator[]> {
  const { data, error } = await supabase
    .from('educators')
    .select(`
      *,
      profile:profiles(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Educator[];
}

export async function fetchEducator(id: string): Promise<Educator | null> {
  const { data, error } = await supabase
    .from('educators')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Educator;
}
