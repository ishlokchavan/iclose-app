import { supabase } from '../client';

export interface Educator {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  expertise: string | null;
  photo_url: string | null;
  status: string;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EducatorInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  expertise?: string;
  bio?: string;
  photo_url?: string;
}

export async function fetchEducators(): Promise<Educator[]> {
  const { data, error } = await supabase
    .from('educators')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Educator[];
}

export async function addEducator(input: EducatorInput): Promise<void> {
  const name = [input.first_name.trim(), input.last_name.trim()].filter(Boolean).join(' ');
  const { error } = await supabase.from('educators').insert({
    name,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    expertise: input.expertise?.trim() || null,
    bio: input.bio?.trim() || null,
    photo_url: input.photo_url?.trim() || null,
    status: 'active',
    is_verified: false,
  });
  if (error) throw error;
}

export async function updateEducator(id: string, input: Partial<EducatorInput>): Promise<void> {
  const updates: Record<string, any> = { ...input };
  if (input.first_name !== undefined || input.last_name !== undefined) {
    updates.name = [input.first_name ?? '', input.last_name ?? ''].filter(Boolean).join(' ').trim();
    if (input.first_name !== undefined) updates.first_name = input.first_name.trim();
    if (input.last_name !== undefined) updates.last_name = input.last_name.trim();
  }
  if (input.email !== undefined) updates.email = input.email.trim();
  if (input.phone !== undefined) updates.phone = input.phone.trim() || null;
  if (input.expertise !== undefined) updates.expertise = input.expertise.trim() || null;
  if (input.bio !== undefined) updates.bio = input.bio.trim() || null;
  if (input.photo_url !== undefined) updates.photo_url = input.photo_url.trim() || null;

  const { error } = await supabase.from('educators').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteEducator(id: string): Promise<void> {
  const { error } = await supabase.from('educators').delete().eq('id', id);
  if (error) throw error;
}
