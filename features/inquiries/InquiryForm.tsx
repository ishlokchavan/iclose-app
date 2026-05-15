import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { TopicFilters } from '../topics/TopicFilters';
import { fetchAreas, fetchTypes } from '../../lib/supabase/queries/taxonomy';
import { createInquiry } from '../../lib/supabase/queries/inquiries';
import { useAuth } from '../../lib/auth/context';

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
});

type FormData = z.infer<typeof schema>;

interface InquiryFormProps {
  topicId?: string;
  onSuccess: () => void;
}

export function InquiryForm({ topicId, onSuccess }: InquiryFormProps) {
  const { user } = useAuth();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
  });

  const { data: types = [] } = useQuery({
    queryKey: ['types', selectedArea],
    queryFn: () => fetchTypes(selectedArea ? areas.find((a) => a.slug === selectedArea)?.id : undefined),
    enabled: true,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setServerError(null);
    try {
      const areaObj = areas.find((a) => a.slug === selectedArea);
      const typeObj = types.find((t) => t.slug === selectedType);

      await createInquiry({
        user_id: user.id,
        title: data.title,
        description: data.description,
        area_id: areaObj?.id,
        type_id: typeObj?.id,
        topic_id: topicId,
      });
      onSuccess();
    } catch (err: any) {
      setServerError(err?.message ?? 'Failed to submit inquiry.');
    }
  };

  const areaChips = areas.map((a) => ({ label: a.name, value: a.slug }));
  const typeChips = types.map((t) => ({ label: t.name, value: t.slug }));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Title"
            placeholder="Brief summary of your question"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Description"
            placeholder="Describe your question in detail…"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            error={errors.description?.message}
            multiline
            numberOfLines={5}
            style={{ height: 120, textAlignVertical: 'top' }}
          />
        )}
      />

      {areaChips.length > 0 ? (
        <View className="mb-4">
          <Text className="text-body-sm font-medium text-ink mb-2">Area (optional)</Text>
          <View className="-mx-4">
            <TopicFilters
              chips={areaChips}
              selected={selectedArea}
              onSelect={(v) => {
                setSelectedArea(v);
                setSelectedType(null);
              }}
            />
          </View>
        </View>
      ) : null}

      {typeChips.length > 0 ? (
        <View className="mb-4">
          <Text className="text-body-sm font-medium text-ink mb-2">Property Type (optional)</Text>
          <View className="-mx-4">
            <TopicFilters
              chips={typeChips}
              selected={selectedType}
              onSelect={setSelectedType}
            />
          </View>
        </View>
      ) : null}

      {serverError ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-body-sm text-destructive">{serverError}</Text>
        </View>
      ) : null}

      <Button
        label="Submit Inquiry"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        size="lg"
      />
    </ScrollView>
  );
}
