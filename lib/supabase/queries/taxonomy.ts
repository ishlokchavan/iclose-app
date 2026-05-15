import { supabase } from '../client';
import type { Area, PropertyType, Subtype } from '../../../types/database';

export async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Area[];
}

export async function fetchTypes(areaId?: string): Promise<PropertyType[]> {
  let query = supabase
    .from('property_types')
    .select('*')
    .order('name', { ascending: true });

  if (areaId) {
    query = query.eq('area_id', areaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PropertyType[];
}

export async function fetchSubtypes(typeId?: string): Promise<Subtype[]> {
  let query = supabase
    .from('subtypes')
    .select('*')
    .order('name', { ascending: true });

  if (typeId) {
    query = query.eq('type_id', typeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Subtype[];
}
