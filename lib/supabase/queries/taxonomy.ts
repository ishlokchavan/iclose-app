import { supabase } from '../client';
import type { Area, PropertyType } from '../../../types/database';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Areas ────────────────────────────────────────────────────────────────────

export async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Area[];
}

export async function addArea(name: string): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .insert({ name: name.trim(), slug: toSlug(name), sort_order: 0 });
  if (error) throw error;
}

export async function updateArea(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .update({ name: name.trim(), slug: toSlug(name) })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteArea(id: string): Promise<void> {
  const { error } = await supabase.from('areas').delete().eq('id', id);
  if (error) throw error;
}

// ─── Property types + subtypes ────────────────────────────────────────────────

export interface PropertySubtype {
  id: string;
  type_id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface PropertyTypeWithSubtypes extends PropertyType {
  subtypes: PropertySubtype[];
}

export async function fetchPropertyTypesWithSubtypes(): Promise<PropertyTypeWithSubtypes[]> {
  const [{ data: types, error: tErr }, { data: subs, error: sErr }] = await Promise.all([
    supabase.from('property_types').select('*').is('archived_at', null).order('sort_order', { ascending: true }),
    supabase.from('property_subtypes').select('*').is('archived_at', null).order('sort_order', { ascending: true }),
  ]);
  if (tErr) throw tErr;
  if (sErr) throw sErr;
  return (types ?? []).map((t: any) => ({
    ...t,
    subtypes: (subs ?? []).filter((s: any) => s.type_id === t.id),
  }));
}

export async function addPropertyType(name: string): Promise<void> {
  const { error } = await supabase
    .from('property_types')
    .insert({ name: name.trim(), slug: toSlug(name), sort_order: 0 });
  if (error) throw error;
}

export async function deletePropertyType(id: string): Promise<void> {
  const { error } = await supabase.from('property_types').delete().eq('id', id);
  if (error) throw error;
}

export async function addPropertySubtype(typeId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('property_subtypes')
    .insert({ type_id: typeId, name: name.trim(), slug: toSlug(name), sort_order: 0 });
  if (error) throw error;
}

export async function deletePropertySubtype(id: string): Promise<void> {
  const { error } = await supabase.from('property_subtypes').delete().eq('id', id);
  if (error) throw error;
}

// Legacy — kept for backward compat with other screens that import these
export async function fetchTypes(areaId?: string): Promise<PropertyType[]> {
  let q = supabase.from('property_types').select('*').order('name', { ascending: true });
  if (areaId) q = q.eq('area_id', areaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PropertyType[];
}

export async function fetchSubtypes(typeId?: string): Promise<any[]> {
  let q = supabase.from('property_subtypes').select('*').order('name', { ascending: true });
  if (typeId) q = q.eq('type_id', typeId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
