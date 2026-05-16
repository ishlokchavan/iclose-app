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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { createTopic } from '../../../lib/supabase/queries/topics';
import { fetchAreas, fetchTypes, fetchSubtypes } from '../../../lib/supabase/queries/taxonomy';
import { fetchEducators } from '../../../lib/supabase/queries/educators';
import { Input } from '../../../components/ui/Input';
import { SelectModal } from '../../../components/ui/SelectModal';
import type { SelectOption } from '../../../components/ui/SelectModal';

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  youtube_id:  z.string().min(5, 'Enter a valid YouTube video ID'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function toSlug(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function NewTopicScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [selectedAreaId, setSelectedAreaId]         = useState<string | null>(null);
  const [subarea, setSubarea]                       = useState('');
  const [selectedTypeId, setSelectedTypeId]         = useState<string | null>(null);
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<string[]>([]);
  const [selectedEducatorId, setSelectedEducatorId] = useState<string | null>(null);
  const [serverError, setServerError]               = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]             = useState(false);

  const { data: areas = [] }     = useQuery({ queryKey: ['areas'], queryFn: fetchAreas });
  const { data: types = [] }     = useQuery({
    queryKey: ['types'],
    queryFn: () => fetchTypes(),
  });
  const { data: subtypes = [] }  = useQuery({
    queryKey: ['subtypes', selectedTypeId],
    queryFn: () => fetchSubtypes(selectedTypeId ?? undefined),
    enabled: !!selectedTypeId,
  });
  const { data: educators = [] } = useQuery({ queryKey: ['educators'], queryFn: fetchEducators });

  // When type changes, clear subtype selection
  useEffect(() => {
    setSelectedSubtypeIds([]);
  }, [selectedTypeId]);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', youtube_id: '', description: '' },
  });

  const titleValue = watch('title');

  const areaOptions: SelectOption[]     = areas.map((a) => ({ label: a.name, value: a.id }));
  const typeOptions: SelectOption[]     = types.map((t) => ({ label: t.name, value: t.id }));
  const educatorOptions: SelectOption[] = educators.map((e) => ({ label: e.name ?? 'Unknown', value: e.id }));

  const selectedAreaLabel     = areas.find((a) => a.id === selectedAreaId)?.name ?? null;
  const selectedTypeLabel     = types.find((t) => t.id === selectedTypeId)?.name ?? null;
  const selectedEducatorLabel = educators.find((e) => e.id === selectedEducatorId)?.name ?? null;

  const toggleSubtype = (id: string) => {
    setSelectedSubtypeIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await createTopic({
        title: data.title,
        slug: toSlug(data.title),
        youtube_id: data.youtube_id,
        description: data.description || null,
        status: 'draft',
        area_id: selectedAreaId,
        subarea: subarea.trim() || null,
        type_id: selectedTypeId,
        educator_record_id: selectedEducatorId,
      });
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
      router.back();
    } catch (err: any) {
      setServerError(err?.message ?? 'Failed to create topic.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.navBackText}>Topics</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>New Topic</Text>
          <TouchableOpacity
            style={[styles.navCreate, isSubmitting && { opacity: 0.5 }]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#0071e3" />
              : <Text style={styles.navCreateText}>Create</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basics */}
          <Text style={styles.sectionLabel}>BASICS</Text>
          <View style={styles.formCard}>
            <Controller control={control} name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Title" placeholder="e.g. 1450 sq.ft 2BED + Maid in JVC"
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  error={errors.title?.message} />
              )}
            />

            <View style={styles.slugPreview}>
              <Text style={styles.slugLabel}>URL slug</Text>
              <Text style={styles.slugValue}>/topics/{toSlug(titleValue) || '…'}</Text>
              <Text style={styles.slugHint}>Auto-generated from title.</Text>
            </View>

            <Controller control={control} name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Description (optional)" placeholder="What learners will get out of this video."
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
              )}
            />

            <Controller control={control} name="youtube_id"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="YouTube Video ID" placeholder="n9eQuJKP-Xs"
                  autoCapitalize="none" autoCorrect={false}
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  error={errors.youtube_id?.message}
                  hint="11-character ID from the youtu.be/… or watch?v=… URL." />
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
              onChange={setSelectedAreaId}
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

            {/* Type */}
            {typeOptions.length > 0 ? (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Type</Text>
                <SelectModal
                  title="Select Type"
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
  navBack:       { flexDirection: 'row', alignItems: 'center', width: 88, paddingLeft: 4 },
  navBackText:   { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  navTitle:      { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },
  navCreate:     { width: 88, alignItems: 'flex-end', paddingRight: 12 },
  navCreateText: { fontSize: 17, fontWeight: '600', color: '#0071e3' },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5 },
  formCard:     { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },

  slugPreview: { marginBottom: 8, paddingHorizontal: 4 },
  slugLabel:   { fontSize: 12, fontWeight: '500', color: '#6e6e73', marginBottom: 2 },
  slugValue:   { fontSize: 13, color: '#1d1d1f', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  slugHint:    { fontSize: 11, color: '#9a9aa5', marginTop: 2 },

  pickerLabel:    { fontSize: 13, fontWeight: '500', color: '#6e6e73', marginBottom: 6 },
  pickerSection:  { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d2d2d7' },
  selectionHint:  { fontSize: 12, color: '#0071e3', marginTop: 5, marginLeft: 2 },
  textField: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1d1d1f', backgroundColor: '#f5f5f7',
  },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f7', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  chipActive:     { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText:       { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },

  errorBox:  { marginHorizontal: 16, marginTop: 8, backgroundColor: '#fff0f0', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#fecaca' },
  errorText: { fontSize: 14, color: '#b81c3a' },
});
