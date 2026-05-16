import { supabase } from '../client';
import type { Inquiry, InquiryStatus } from '../../../types/database';

const INQUIRY_SELECT = `
  *,
  learner:profiles!learner_id(*),
  area:areas(*),
  property_type:property_types!type_id(*)
`;

export async function fetchAllInquiries(filters?: { status?: string }): Promise<Inquiry[]> {
  let query = supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Inquiry[];
}

export async function fetchMyInquiries(learnerId: string): Promise<Inquiry[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Inquiry[];
}

export async function fetchInquiry(id: string): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Inquiry;
}

export async function createInquiry(inquiry: {
  learner_id: string;
  description: string;
  email?: string;
  phone?: string;
  area_id?: string;
  type_id?: string;
  source_topic_id?: string;
}): Promise<Inquiry> {
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ ...inquiry, status: 'open' })
    .select()
    .single();
  if (error) throw error;
  return data as Inquiry;
}

export async function deleteInquiry(id: string): Promise<void> {
  const { error } = await supabase.from('inquiries').delete().eq('id', id);
  if (error) throw error;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<Inquiry> {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(INQUIRY_SELECT)
    .single();
  if (error) throw error;
  return data as Inquiry;
}
