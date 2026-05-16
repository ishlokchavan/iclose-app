import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchAreas,
  addArea,
  updateArea,
  deleteArea,
  fetchPropertyTypesWithSubtypes,
  addPropertyType,
  deletePropertyType,
  addPropertySubtype,
  deletePropertySubtype,
  type PropertyTypeWithSubtypes,
  type PropertySubtype,
} from '../../../lib/supabase/queries/taxonomy';
import { Spinner } from '../../../components/ui/Spinner';
import type { Area } from '../../../types/database';

type Tab = 'communities' | 'types';

// ─── Area row ─────────────────────────────────────────────────────────────────

function AreaRow({
  area,
  isLast,
  onSave,
  onDelete,
}: {
  area: Area;
  isLast: boolean;
  onSave: (id: string, name: string) => Promise<void>;
  onDelete: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(area.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleEdit = () => {
    setValue(area.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!value.trim() || value.trim() === area.name) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(area.id, value.trim()); } finally { setSaving(false); setEditing(false); }
  };

  const handleCancel = () => { setValue(area.name); setEditing(false); };

  return (
    <View style={[styles.areaRow, !isLast && styles.areaRowBorder]}>
      {editing ? (
        <TextInput
          ref={inputRef}
          style={styles.areaEditInput}
          value={value}
          onChangeText={setValue}
          autoCapitalize="words"
          autoCorrect={false}
          onSubmitEditing={handleSave}
          returnKeyType="done"
        />
      ) : (
        <Text style={styles.areaName} numberOfLines={1}>{area.name}</Text>
      )}
      <View style={styles.areaActions}>
        {editing ? (
          <>
            {saving
              ? <ActivityIndicator size="small" color="#0071e3" style={{ marginRight: 10 }} />
              : (
                <TouchableOpacity onPress={handleSave} style={styles.areaIconBtn} activeOpacity={0.7}>
                  <Ionicons name="checkmark" size={18} color="#0071e3" />
                </TouchableOpacity>
              )}
            <TouchableOpacity onPress={handleCancel} style={styles.areaIconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#9a9aa5" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={handleEdit} style={styles.areaIconBtn} activeOpacity={0.7}>
              <Ionicons name="pencil-outline" size={16} color="#6e6e73" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(area.id, area.name)} style={styles.areaIconBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color="#b81c3a" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Subtype chip ─────────────────────────────────────────────────────────────

function SubtypeChip({ subtype, onDelete }: { subtype: PropertySubtype; onDelete: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{subtype.name}</Text>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} activeOpacity={0.7}>
        <Ionicons name="close" size={13} color="#6e6e73" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Property type card ───────────────────────────────────────────────────────

function PropertyTypeCard({
  typeData,
  onDeleteType,
  onAddSubtype,
  onDeleteSubtype,
}: {
  typeData: PropertyTypeWithSubtypes;
  onDeleteType: () => void;
  onAddSubtype: (typeId: string, name: string) => Promise<void>;
  onDeleteSubtype: (id: string) => void;
}) {
  const [addingSubtype, setAddingSubtype] = useState(false);
  const [subtypeName, setSubtypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleAddSubtype = async () => {
    if (!subtypeName.trim()) return;
    setSaving(true);
    try {
      await onAddSubtype(typeData.id, subtypeName.trim());
      setSubtypeName('');
      setAddingSubtype(false);
    } finally { setSaving(false); }
  };

  const handleShowAdd = () => {
    setAddingSubtype(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <View style={styles.typeCard}>
      {/* Card header */}
      <View style={styles.typeCardHeader}>
        <Text style={styles.typeName}>{typeData.name}</Text>
        <TouchableOpacity onPress={onDeleteType} activeOpacity={0.7} style={styles.typeDeleteBtn}>
          <Ionicons name="trash-outline" size={14} color="#b81c3a" />
          <Text style={styles.typeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Subtypes + add */}
      <View style={styles.chipsWrap}>
        {typeData.subtypes.map((s) => (
          <SubtypeChip key={s.id} subtype={s} onDelete={() => onDeleteSubtype(s.id)} />
        ))}

        {addingSubtype ? (
          <View style={styles.addSubtypeInline}>
            <TextInput
              ref={inputRef}
              style={styles.addSubtypeInput}
              value={subtypeName}
              onChangeText={setSubtypeName}
              placeholder="Specialisation name"
              placeholderTextColor="#9a9aa5"
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={handleAddSubtype}
              returnKeyType="done"
            />
            {saving ? (
              <ActivityIndicator size="small" color="#0071e3" style={{ marginLeft: 8 }} />
            ) : (
              <TouchableOpacity
                style={[styles.addSubtypeConfirm, !subtypeName.trim() && { opacity: 0.4 }]}
                onPress={handleAddSubtype}
                disabled={!subtypeName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.addSubtypeConfirmText}>Add</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setAddingSubtype(false); setSubtypeName(''); }} style={{ marginLeft: 6 }} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#9a9aa5" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleShowAdd} activeOpacity={0.7} style={styles.addSubtypeBtn}>
            <Ionicons name="add" size={14} color="#0071e3" />
            <Text style={styles.addSubtypeBtnText}>Add specialisation</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TaxonomyScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('communities');

  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const addAreaInputRef = useRef<TextInput>(null);

  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const addTypeInputRef = useRef<TextInput>(null);

  // ── Queries ──
  const { data: areas = [], isLoading: areasLoading, refetch: refetchAreas, isRefetching: areasRefetching } = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
  });

  const { data: typesWithSubs = [], isLoading: typesLoading, refetch: refetchTypes, isRefetching: typesRefetching } = useQuery({
    queryKey: ['propertyTypesWithSubtypes'],
    queryFn: fetchPropertyTypesWithSubtypes,
  });

  // ── Area mutations ──
  const addAreaMutation = useMutation({
    mutationFn: (name: string) => addArea(name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['areas'] }); setNewAreaName(''); setAddingArea(false); },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to add community.'),
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateArea(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['areas'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update community.'),
  });

  const deleteAreaMutation = useMutation({
    mutationFn: (id: string) => deleteArea(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['areas'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete community.'),
  });

  // ── Type/subtype mutations ──
  const addTypeMutation = useMutation({
    mutationFn: (name: string) => addPropertyType(name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['propertyTypesWithSubtypes'] }); setNewTypeName(''); setAddingType(false); },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to add property type.'),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => deletePropertyType(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['propertyTypesWithSubtypes'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete property type.'),
  });

  const addSubtypeMutation = useMutation({
    mutationFn: ({ typeId, name }: { typeId: string; name: string }) => addPropertySubtype(typeId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['propertyTypesWithSubtypes'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to add specialisation.'),
  });

  const deleteSubtypeMutation = useMutation({
    mutationFn: (id: string) => deletePropertySubtype(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['propertyTypesWithSubtypes'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete specialisation.'),
  });

  // ── Handlers ──
  const handleDeleteArea = (id: string, name: string) => {
    Alert.alert('Delete Community', `Remove "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAreaMutation.mutate(id) },
    ]);
  };

  const handleDeleteType = (id: string, name: string) => {
    Alert.alert('Delete Property Type', `Remove "${name}" and all its specialisations? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTypeMutation.mutate(id) },
    ]);
  };

  const handleDeleteSubtype = (id: string, name: string) => {
    Alert.alert('Remove Specialisation', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteSubtypeMutation.mutate(id) },
    ]);
  };

  const handleShowAddArea = () => {
    setAddingArea(true);
    setTimeout(() => addAreaInputRef.current?.focus(), 50);
  };

  const handleShowAddType = () => {
    setAddingType(true);
    setTimeout(() => addTypeInputRef.current?.focus(), 50);
  };

  const isLoading = tab === 'communities' ? areasLoading : typesLoading;
  const isRefreshing = tab === 'communities' ? areasRefetching : typesRefetching;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTENT</Text>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>Manage how topics and inquiries are classified.</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          { value: 'communities' as Tab, label: 'Communities', count: areas.length },
          { value: 'types' as Tab, label: 'Property Types', count: typesWithSubs.length },
        ]).map((t) => {
          const active = tab === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTab(t.value)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{t.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={tab === 'communities' ? refetchAreas : refetchTypes}
              tintColor="#0071e3"
            />
          }
        >
          {/* ── Communities tab ── */}
          {tab === 'communities' ? (
            <>
              {/* List header */}
              <View style={styles.listCardHeader}>
                <Text style={styles.listCardHeaderText}>COMMUNITY</Text>
                <TouchableOpacity onPress={handleShowAddArea} activeOpacity={0.7} style={styles.addRowBtn}>
                  <Ionicons name="add" size={15} color="#0071e3" />
                  <Text style={styles.addRowBtnText}>Add community</Text>
                </TouchableOpacity>
              </View>

              {/* Area rows */}
              {areas.map((area, i) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  isLast={i === areas.length - 1 && !addingArea}
                  onSave={(id, name) => updateAreaMutation.mutateAsync({ id, name })}
                  onDelete={handleDeleteArea}
                />
              ))}

              {/* Inline add form */}
              {addingArea ? (
                <View style={styles.addAreaForm}>
                  <View style={styles.addAreaInputWrap}>
                    <Text style={styles.addAreaLabel}>Name</Text>
                    <TextInput
                      ref={addAreaInputRef}
                      style={styles.addAreaInput}
                      value={newAreaName}
                      onChangeText={setNewAreaName}
                      placeholder="e.g. Dubai Marina"
                      placeholderTextColor="#9a9aa5"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => { if (newAreaName.trim()) addAreaMutation.mutate(newAreaName); }}
                    />
                  </View>
                  <View style={styles.addAreaActions}>
                    <TouchableOpacity
                      style={[styles.addAreaConfirmBtn, (!newAreaName.trim() || addAreaMutation.isPending) && { opacity: 0.5 }]}
                      onPress={() => { if (newAreaName.trim()) addAreaMutation.mutate(newAreaName); }}
                      disabled={!newAreaName.trim() || addAreaMutation.isPending}
                      activeOpacity={0.8}
                    >
                      {addAreaMutation.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.addAreaConfirmText}>Add</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setAddingArea(false); setNewAreaName(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addAreaCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Footer count */}
              <View style={styles.listCardFooter}>
                <Text style={styles.listCardFooterText}>{areas.length} community(s)</Text>
              </View>
            </>
          ) : (
            /* ── Property Types tab ── */
            <>
              {typesWithSubs.map((typeData) => (
                <PropertyTypeCard
                  key={typeData.id}
                  typeData={typeData}
                  onDeleteType={() => handleDeleteType(typeData.id, typeData.name)}
                  onAddSubtype={(typeId, name) => addSubtypeMutation.mutateAsync({ typeId, name })}
                  onDeleteSubtype={(id) => handleDeleteSubtype(id, typesWithSubs.flatMap(t => t.subtypes).find(s => s.id === id)?.name ?? 'this specialisation')}
                />
              ))}

              {/* Add property type */}
              {addingType ? (
                <View style={styles.addTypeForm}>
                  <Text style={styles.addTypeFormTitle}>New property type</Text>
                  <Text style={styles.addAreaLabel}>Type name</Text>
                  <View style={styles.addTypeInputRow}>
                    <TextInput
                      ref={addTypeInputRef}
                      style={styles.addTypeInput}
                      value={newTypeName}
                      onChangeText={setNewTypeName}
                      placeholder="e.g. Residential"
                      placeholderTextColor="#9a9aa5"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => { if (newTypeName.trim()) addTypeMutation.mutate(newTypeName); }}
                    />
                    <TouchableOpacity
                      style={[styles.addSubtypeConfirm, (!newTypeName.trim() || addTypeMutation.isPending) && { opacity: 0.5 }]}
                      onPress={() => { if (newTypeName.trim()) addTypeMutation.mutate(newTypeName); }}
                      disabled={!newTypeName.trim() || addTypeMutation.isPending}
                      activeOpacity={0.8}
                    >
                      {addTypeMutation.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.addSubtypeConfirmText}>Add</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setAddingType(false); setNewTypeName(''); }} style={{ marginLeft: 6 }} activeOpacity={0.7}>
                      <Text style={styles.addAreaCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.addTypeBtn} onPress={handleShowAddType} activeOpacity={0.7}>
                  <Ionicons name="add" size={16} color="#0071e3" />
                  <Text style={styles.addTypeBtnText}>Add property type</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  eyebrow:  { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.8, marginBottom: 2 },
  title:    { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 13, color: '#6e6e73', marginTop: 3, lineHeight: 18 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#ebebed', borderRadius: 12, padding: 3,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 7, borderRadius: 10, gap: 5,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 2,
  },
  tabLabel:           { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  tabLabelActive:     { color: '#1d1d1f', fontWeight: '600' },
  tabBadge:           { backgroundColor: '#d2d2d7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeActive:     { backgroundColor: '#0071e3' },
  tabBadgeText:       { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  tabBadgeTextActive: { color: '#ffffff' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── Communities ──
  listCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f5f5f7', paddingHorizontal: 14, paddingVertical: 8,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderBottomWidth: 0,
  },
  listCardHeaderText: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.6 },
  addRowBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addRowBtnText: { fontSize: 13, color: '#0071e3', fontWeight: '500' },

  areaRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
  },
  areaRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7' },
  areaName:      { flex: 1, fontSize: 15, color: '#1d1d1f' },
  areaEditInput: {
    flex: 1, fontSize: 15, color: '#1d1d1f',
    borderBottomWidth: 1.5, borderBottomColor: '#0071e3',
    paddingVertical: 2, marginRight: 8,
  },
  areaActions:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  areaIconBtn:   { padding: 6 },

  addAreaForm: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
    padding: 14,
  },
  addAreaInputWrap: { marginBottom: 12 },
  addAreaLabel:     { fontSize: 12, fontWeight: '500', color: '#6e6e73', marginBottom: 6 },
  addAreaInput: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1d1d1f', backgroundColor: '#f5f5f7',
  },
  addAreaActions:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  addAreaConfirmBtn:  { backgroundColor: '#0071e3', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 9, alignItems: 'center', minWidth: 60 },
  addAreaConfirmText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  addAreaCancelText:  { fontSize: 14, color: '#6e6e73' },

  listCardFooter: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
    backgroundColor: '#ffffff',
  },
  listCardFooterText: { fontSize: 13, color: '#9a9aa5' },

  // ── Property types ──
  typeCard: {
    backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    overflow: 'hidden',
  },
  typeCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  typeName:       { fontSize: 16, fontWeight: '600', color: '#1d1d1f' },
  typeDeleteBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeDeleteText: { fontSize: 13, color: '#b81c3a', fontWeight: '500' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0f0f5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 13, color: '#1d1d1f' },

  addSubtypeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 4 },
  addSubtypeBtnText: { fontSize: 13, color: '#0071e3' },
  addSubtypeInline:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  addSubtypeInput: {
    flex: 1, fontSize: 14, color: '#1d1d1f',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#f5f5f7',
  },
  addSubtypeConfirm:     { marginLeft: 8, backgroundColor: '#0071e3', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  addSubtypeConfirmText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  addTypeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 14, backgroundColor: '#ffffff',
  },
  addTypeBtnText: { fontSize: 15, color: '#0071e3', fontWeight: '500' },

  addTypeForm: {
    backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    padding: 16,
  },
  addTypeFormTitle: { fontSize: 15, fontWeight: '600', color: '#1d1d1f', marginBottom: 12 },
  addTypeInputRow:  { flexDirection: 'row', alignItems: 'center' },
  addTypeInput: {
    flex: 1, fontSize: 15, color: '#1d1d1f',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#f5f5f7',
  },
});
