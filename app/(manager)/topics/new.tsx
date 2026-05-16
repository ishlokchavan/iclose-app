import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { createTopic } from '../../../lib/supabase/queries/topics';
import { fetchAreas, fetchTypes } from '../../../lib/supabase/queries/taxonomy';
import { fetchEducators } from '../../../lib/supabase/queries/educators';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { TopicFilters } from '../../../features/topics/TopicFilters';

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  youtube_id: z.string().min(5, 'Enter a valid YouTube video ID'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewTopicScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEducator, setSelectedEducator] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: fetchAreas });
  const { data: types = [] } = useQuery({
    queryKey: ['types', selectedArea],
    queryFn: () => fetchTypes(areas.find((a) => a.slug === selectedArea)?.id),
  });
  const { data: educators = [] } = useQuery({
    queryKey: ['educators'],
    queryFn: fetchEducators,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', youtube_id: '', description: '' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const areaObj = areas.find((a) => a.slug === selectedArea);
      const typeObj = types.find((t) => t.slug === selectedType);
      const educatorObj = educators.find(
        (e) => e.name === selectedEducator,
      );

      await createTopic({
        title: data.title,
        slug: data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        youtube_id: data.youtube_id,
        description: data.description || null,
        status: 'draft',
        area_id: areaObj?.id ?? null,
        type_id: typeObj?.id ?? null,
        educator_id: educatorObj?.id ?? null,
      });

      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
      router.back();
    } catch (err: any) {
      setServerError(err?.message ?? 'Failed to create topic.');
    }
  };

  const areaChips = areas.map((a) => ({ label: a.name, value: a.slug }));
  const typeChips = types.map((t) => ({ label: t.name, value: t.slug }));
  const educatorChips = educators.map((e) => ({
    label: e.name ?? 'Unknown',
    value: e.name ?? e.id,
  }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-hairline bg-surface">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-3"
          >
            <Ionicons name="close" size={24} color="#1d1d1f" />
          </TouchableOpacity>
          <Text className="flex-1 text-display-md text-ink font-semibold">New Topic</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Title"
                placeholder="e.g. Understanding Buyer's Agent Agreements"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.title?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="youtube_id"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="YouTube Video ID"
                placeholder="e.g. dQw4w9WgXcQ"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.youtube_id?.message}
                hint="The ID from the YouTube URL (after ?v=)"
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Description (optional)"
                placeholder="What will learners gain from this topic?"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: 'top' }}
              />
            )}
          />

          {areaChips.length > 0 && (
            <View className="mb-4">
              <Text className="text-body-sm font-medium text-ink mb-2">Area</Text>
              <View className="-mx-4">
                <TopicFilters
                  chips={areaChips}
                  selected={selectedArea}
                  onSelect={(v) => { setSelectedArea(v); setSelectedType(null); }}
                />
              </View>
            </View>
          )}

          {typeChips.length > 0 && (
            <View className="mb-4">
              <Text className="text-body-sm font-medium text-ink mb-2">Property Type</Text>
              <View className="-mx-4">
                <TopicFilters chips={typeChips} selected={selectedType} onSelect={setSelectedType} />
              </View>
            </View>
          )}

          {educatorChips.length > 0 && (
            <View className="mb-4">
              <Text className="text-body-sm font-medium text-ink mb-2">Educator</Text>
              <View className="-mx-4">
                <TopicFilters
                  chips={educatorChips}
                  selected={selectedEducator}
                  onSelect={setSelectedEducator}
                />
              </View>
            </View>
          )}

          {serverError ? (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <Text className="text-body-sm text-destructive">{serverError}</Text>
            </View>
          ) : null}

          <Button
            label="Create Topic"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
