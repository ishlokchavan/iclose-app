import { supabase } from '../client';
import type { Topic } from '../../../types/database';

export async function fetchTopics(filters?: {
  area?: string;
  type?: string;
  search?: string;
  status?: string;
}): Promise<Topic[]> {
  let query = supabase
    .from('topics')
    .select(`
      *,
      area:areas(*),
      property_type:property_types(*),
      educator:educators(*, profile:profiles(*))
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.eq('status', 'published');
  }

  if (filters?.area) {
    query = query.eq('areas.slug', filters.area);
  }

  if (filters?.type) {
    query = query.eq('property_types.slug', filters.type);
  }

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Topic[];
}

export async function fetchTopic(slug: string): Promise<Topic | null> {
  const { data, error } = await supabase
    .from('topics')
    .select(`
      *,
      area:areas(*),
      property_type:property_types(*),
      educator:educators(*, profile:profiles(*))
    `)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Topic;
}

export async function fetchSavedTopics(userId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('saved_topics')
    .select(`
      *,
      topic:topics(
        *,
        area:areas(*),
        property_type:property_types(*),
        educator:educators(*, profile:profiles(*))
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.topic).filter(Boolean) as Topic[];
}

export async function saveTopic(userId: string, topicId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_topics')
    .insert({ user_id: userId, topic_id: topicId });
  if (error) throw error;
}

export async function unsaveTopic(userId: string, topicId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_topics')
    .delete()
    .eq('user_id', userId)
    .eq('topic_id', topicId);
  if (error) throw error;
}

export async function isTopicSaved(userId: string, topicId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_topics')
    .select('id')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function createTopic(topic: Partial<Topic>): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .insert(topic)
    .select()
    .single();
  if (error) throw error;
  return data as Topic;
}

export async function updateTopic(id: string, updates: Partial<Topic>): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Topic;
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAllTopics(filters?: { status?: string }): Promise<Topic[]> {
  let query = supabase
    .from('topics')
    .select(`
      *,
      area:areas(*),
      property_type:property_types(*),
      educator:educators(*, profile:profiles(*))
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Topic[];
}
