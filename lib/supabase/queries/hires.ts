import { supabase } from '../client';
import type { HireApplication } from '../../../types/database';

export async function fetchHireApplications(): Promise<HireApplication[]> {
  const [internsRes, specialistsRes] = await Promise.all([
    supabase
      .from('intern_applications')
      .select('id, first_name, last_name, email, phone, message, status, created_at, instagram, resume_path')
      .order('created_at', { ascending: false }),
    supabase
      .from('specialist_applications')
      .select('id, first_name, last_name, email, phone, message, status, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (internsRes.error) throw internsRes.error;
  if (specialistsRes.error) throw specialistsRes.error;

  const interns: HireApplication[] = (internsRes.data ?? []).map((r: any) => ({
    ...r,
    kind: 'intern' as const,
  }));

  const specialists: HireApplication[] = (specialistsRes.data ?? []).map((r: any) => ({
    ...r,
    kind: 'specialist' as const,
  }));

  return [...interns, ...specialists].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function updateHireStatus(
  id: string,
  kind: 'intern' | 'specialist',
  status: string,
): Promise<void> {
  const table = kind === 'intern' ? 'intern_applications' : 'specialist_applications';
  const { error } = await supabase.from(table).update({ status }).eq('id', id);
  if (error) throw error;
}
