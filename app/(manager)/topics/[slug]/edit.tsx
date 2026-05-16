import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchTopic, updateTopic, deleteTopic } from '../../../../lib/supabase/queries/topics';
import { fetchAreas, fetchTypes, fetchSubtypes } from '../../../../lib/supabase/queries/taxonomy';
import { fetchEducators } from '../../../../lib/supabase/queries/educators';
import { Input } from '../../../../components/ui/Input';
import { SelectModal } from '../../../../components/ui/SelectModal';
import type { SelectOption } from '../../../../components/ui/SelectModal';
import { Spinner } from '../../../../components/ui/Spinner';
import type { TopicStatus } from '../../../../types/database';

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  published: { label: 'PUBLISHED', color: '#1a9e5c' },
  draft:     { label: 'DRAFT',     color: '#d97706' },
  archived:  { label: 'ARCHIVED',  color: '#6e6e73' },
};

function toSlug(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  youtube_id:  z.string().min(5, 'Enter a valid YouTube video ID'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditTopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [selectedAreaId, setSelectedAreaId]         = useState<string | null>(null);
  const [subarea, setSubarea]                       = useState('');
  const [selectedTypeId, setSelectedTypeId]         = useState<string | null>(null);
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<string[]>([]);
  const [selectedEducatorId, setSelectedEducatorId] = useState<string | null>(null);
  const [serverError, setServerError]               = useState<string | null>(null);

  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => fetchTopic(slug),
    enabled: !!slug,
  });

  const { data: areas = [] }    = useQuery({ queryKey: ['areas'], queryFn: fetchAreas });
  const { data: types = [] }    = useQuery({
    queryKey: ['types'],
    queryFn: () => fetchTypes(),
  });
  const { data: subtypes = [] } = useQuery({
    queryKey: ['subtypes', selectedTypeId],
    queryFn: () => fetchSubtypes(selectedTypeId ?? undefined),
    enabled: !!selectedTypeId,
  });
  const { data: educators = [] } = useQuery({ queryKey: ['educators'], queryFn: fetchEducators });

  const { control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', youtube_id: '', description: '' },
  });

  const titleValue = watch('title');

  // Seed form and picker state once topic loads
  useEffect(() => {
    if (!topic) return;
    reset({
      title:       topic.title,
      youtube_id:  topic.youtube_id ?? '',
      description: topic.description ?? '',
    });
    if (topic.area_id) setSelectedAreaId(topic.area_id);
    if (topic.subarea) setSubarea(topic.subarea);
    if (topic.type_id) setSelectedTypeId(topic.type_id);
    if (topic.educator_record_id) setSelectedEducatorId(topic.educator_record_id);
  }, [topic, reset]);

  // When type changes, clear subtypes
  useEffect(() => {
    setSelectedSubtypeIds([]);
  }, [selectedTypeId]);

  const toggleSubtype = (id: string) => {
    setSelectedSubtypeIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      updateTopic(topic!.id, {
        title:               data.title,
        youtube_id:          data.youtube_id,
        description:         data.description || null,
        area_id:             selectedAreaId,
        subarea:             subarea.trim() || null,
        type_id:             selectedTypeId,
        educator_record_id:  selectedEducatorId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', slug] });
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
      router.back();
    },
    onError: (err: any) => setServerError(err?.message ?? 'Failed to update topic.'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TopicStatus) => updateTopic(topic!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', slug] });
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTopic(topic!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
      router.push('/(manager)/topics');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete.'),
  });

  const handleDelete = () =>
    Alert.alert('Delete Topic', 'This will permanently delete the topic. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);

  if (topicLoading) return <Spinner fullScreen />;

  const cfg = topic ? (STATUS_CFG[topic.status] ?? { label: topic.status.toUpperCase(), color: '#9a9aa5' }) : null;
  const isBusy = isSubmitting || updateMutation.isPending || statusMutation.isPending || deleteMutation.isPending;

  const areaOptions: SelectOption[]     = areas.map((a) => ({ label: a.name, value: a.id }));
  const typeOptions: SelectOption[]     = types.map((t) => ({ label: t.name, value: t.id }));
  const educatorOptions: SelectOption[] = educators.map((e) => ({ label: e.name ?? 'Unknown', value: e.id }));

  const selectedAreaLabel     = areas.find((a) => a.id === selectedAreaId)?.name ?? null;
  const selectedTypeLabel     = types.find((t) => t.id === selectedTypeId)?.name ?? null;
  const selectedEducatorLabel = educators.find((e) => e.id === selectedEducatorId)?.name ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.navBackText}>Topic</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>Edit</Text>
          <TouchableOpacity
            style={[styles.navSave, isBusy && { opacity: 0.5 }]}
            onPress={handleSubmit((data) => updateMutation.mutate(data))}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {isBusy ? <ActivityIndicator size="small" color="#0071e3" /> : <Text style={styles.navSaveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Current status + actions */}
          {topic && cfg ? (
            <>
              <View style={styles.statusBlock}>
                <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
                  <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={styles.statusTitle} numberOfLines={1}>{topic.title}</Text>
              </View>

              <View style={styles.actionsCard}>
                {topic.status !== 'published' ? (
                  <TouchableOpacity
                    style={[styles.actionRow, styles.actionPublish]}
                    onPress={() => Alert.alert('Publish Topic', 'Make this topic visible to all learners?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Publish', onPress: () => statusMutation.mutate('published') },
                    ])}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye-outline" size={18} color="#fff" />
                    <Text style={styles.actionPublishText}>Publish</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionRow, styles.actionSecondary]}
                    onPress={() => statusMutation.mutate('draft')}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-undo-outline" size={18} color="#1d1d1f" />
                    <Text style={styles.actionSecondaryText}>Revert to Draft</Text>
                  </TouchableOpacity>
                )}

                {topic.status !== 'archived' ? (
                  <TouchableOpacity
                    style={[styles.actionRow, styles.infoRowBorder, styles.actionSecondary]}
                    onPress={() => Alert.alert('Archive Topic', 'Hide this topic from learners?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Archive', style: 'destructive', onPress: () => statusMutation.mutate('archived') },
                    ])}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="archive-outline" size={18} color="#1d1d1f" />
                    <Text style={styles.actionSecondaryText}>Archive</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionRow, styles.infoRowBorder, styles.actionSecondary]}
                    onPress={() => statusMutation.mutate('draft')}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh-outline" size={18} color="#1d1d1f" />
                    <Text style={styles.actionSecondaryText}>Restore to Draft</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionRow, styles.infoRowBorder]}
                  onPress={handleDelete}
                  disabled={isBusy}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#b81c3a" />
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Basics */}
          <Text style={styles.sectionLabel}>BASICS</Text>
          <View style={styles.formCard}>
            <Controller control={control} name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Title" onChangeText={onChange} onBlur={onBlur} value={value}
                  error={errors.title?.message} />
              )}
            />

            <View style={styles.slugPreview}>
              <Text style={styles.slugLabel}>URL slug</Text>
              <Text style={styles.slugValue}>/topics/{toSlug(titleValue) || '…'}</Text>
              <Text style={styles.slugHint}>Auto-generated from title.</Text>
            </View>

            <Controller control={control} name="youtube_id"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="YouTube Video ID" autoCapitalize="none" autoCorrect={false}
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  error={errors.youtube_id?.message}
                  hint="The 11-char ID from youtu.be/… or watch?v=…" />
              )}
            />
            <Controller control={control} name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Description (optional)" placeholder="What will learners gain from this topic?"
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
              )}
            />
          </View>

          {/* Educator */}
          {educatorOptions.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>EDUCATOR</Text>
              <View style={styles.formCard}>
                <Text style={styles.pickerLabel}>The specialist who will appear on this topic.</Text>
                <SelectModal
                  title="Select Educator"
                  options={educatorOptions}
                  value={selectedEducatorId}
                  onChange={setSelectedEducatorId}
                  placeholder="No educator"
                  noneLabel="No educator"
                />
                {selectedEducatorLabel ? (
                  <Text style={styles.selectionHint}>{selectedEducatorLabel} selected</Text>
                ) : null}
              </View>
            </>
          ) : null}

          {/* Taxonomy */}
          <Text style={styles.sectionLabel}>TAXONOMY</Text>
          <View style={styles.formCard}>
            {/* Area */}
            <Text style={styles.pickerLabel}>Area / Community</Text>
            <SelectModal
              title="Select Area"
              options={areaOptions}
              value={selectedAreaId}
              onChange={(val) => { setSelectedAreaId(val); setSelectedTypeId(null); setSelectedSubtypeIds([]); }}
              placeholder="No area selected"
              noneLabel="No area"
              searchable
            />
            {selectedAreaLabel ? (
              <Text style={styles.selectionHint}>{selectedAreaLabel} selected</Text>
            ) : null}

            {/* Cluster / Building */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Cluster / Building (optional)</Text>
              <TextInput
                style={styles.textField}
                value={subarea}
                onChangeText={setSubarea}
                placeholder="e.g. Burj Khalifa"
                placeholderTextColor="#9a9aa5"
              />
            </View>

            {/* Property Type */}
            {typeOptions.length > 0 ? (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Property Type</Text>
                <SelectModal
                  title="Select Property Type"
                  options={typeOptions}
                  value={selectedTypeId}
                  onChange={(val) => { setSelectedTypeId(val); setSelectedSubtypeIds([]); }}
                  placeholder="No type selected"
                  noneLabel="No type"
                />
                {selectedTypeLabel ? (
                  <Text style={styles.selectionHint}>{selectedTypeLabel} selected</Text>
                ) : null}
              </View>
            ) : null}

            {/* Subtypes */}
            {selectedTypeId && subtypes.length > 0 ? (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Subtypes</Text>
                <View style={styles.chipsWrap}>
                  {subtypes.map((sub) => {
                    const isActive = selectedSubtypeIds.includes(sub.id);
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => toggleSubtype(sub.id)}
                        style={[styles.chip, isActive && styles.chipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{sub.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          {serverError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10, paddingTop: 6,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  navBack:     { flexDirection: 'row', alignItems: 'center', width: 88, paddingLeft: 4 },
  navBackText: { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  navTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },
  navSave:     { width: 88, alignItems: 'flex-end', paddingRight: 12 },
  navSaveText: { fontSize: 17, fontWeight: '600', color: '#0071e3' },

  statusBlock: {
    backgroundColor: '#ffffff', padding: 16, paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
    gap: 6,
  },
  statusBadge:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusTitle:     { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },

  actionsCard:  { backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  actionRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  infoRowBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d2d2d7' },
  actionPublish:     { backgroundColor: '#0071e3' },
  actionPublishText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  actionSecondary:   {},
  actionSecondaryText: { fontSize: 15, color: '#1d1d1f' },
  actionDeleteText:    { fontSize: 15, color: '#b81c3a' },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5 },
  formCard:     { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },

  slugPreview: { marginBottom: 8, paddingHorizontal: 4 },
  slugLabel:   { fontSize: 12, fontWeight: '500', color: '#6e6e73', marginBottom: 2 },
  slugValue:   { fontSize: 13, color: '#1d1d1f', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  slugHint:    { fontSize: 11, color: '#9a9aa5', marginTop: 2 },

  pickerLabel:   { fontSize: 13, fontWeight: '500', color: '#6e6e73', marginBottom: 6 },
  pickerSection: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d2d2d7' },
  selectionHint: { fontSize: 12, color: '#0071e3', marginTop: 5, marginLeft: 2 },
  textField: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1d1d1f', backgroundColor: '#f5f5f7',
  },

  chipsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f7', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  chipActive:     { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText:       { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },

  errorBox:  { marginHorizontal: 16, marginTop: 8, backgroundColor: '#fff0f0', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#fecaca' },
  errorText: { fontSize: 14, color: '#b81c3a' },
});
