import { supabase } from '../client';
import type { HireApplication, HireRemark } from '../../../types/database';

export async function fetchHireApplications(): Promise<HireApplication[]> {
  const { data, error } = await supabase
    .from('intern_applications')
    .select('id, first_name, last_name, email, phone, message, status, created_at, instagram, resume_path, referer')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, kind: 'intern' as const }));
}

export async function updateHireStatus(
  id: string,
  status: string,
): Promise<void> {
  const { error } = await supabase.from('intern_applications').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function fetchHireRemarks(applicationId: string): Promise<HireRemark[]> {
  const { data, error } = await supabase
    .from('hire_remarks')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HireRemark[];
}

export async function addHireRemark(
  applicationId: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<void> {
  const { error } = await supabase.from('hire_remarks').insert({
    application_id: applicationId,
    content,
    created_by: authorId,
    created_by_name: authorName,
  });
  if (error) throw error;
}

export async function getResumeSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteHireApplication(id: string): Promise<void> {
  const { error } = await supabase.from('intern_applications').delete().eq('id', id);
  if (error) throw error;
}
