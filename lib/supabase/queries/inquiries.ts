import { supabase } from '../client';
import type { Inquiry } from '../../../types/database';

export async function fetchMyInquiries(userId: string): Promise<Inquiry[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(`
      *,
      topic:topics(id, title, slug),
      area:areas(*),
      property_type:property_types(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Inquiry[];
}

export async function fetchAllInquiries(filters?: { status?: string }): Promise<Inquiry[]> {
  let query = supabase
    .from('inquiries')
    .select(`
      *,
      user:profiles(*),
      topic:topics(id, title, slug),
      area:areas(*),
      property_type:property_types(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Inquiry[];
}

export async function fetchInquiry(id: string): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(`
      *,
      user:profiles(*),
      topic:topics(id, title, slug),
      area:areas(*),
      property_type:property_types(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Inquiry;
}

export async function createInquiry(inquiry: {
  user_id: string;
  title: string;
  description: string;
  area_id?: string;
  type_id?: string;
  topic_id?: string;
}): Promise<Inquiry> {
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ ...inquiry, status: 'open' })
    .select()
    .single();
  if (error) throw error;
  return data as Inquiry;
}

export async function updateInquiryStatus(
  id: string,
  status: Inquiry['status'],
  response?: string,
  respondedBy?: string,
): Promise<Inquiry> {
  const updates: Partial<Inquiry> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (response) {
    updates.response = response;
    updates.responded_by = respondedBy;
    updates.responded_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('inquiries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Inquiry;
}
