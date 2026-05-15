import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchAreas, fetchTypes, fetchSubtypes } from '../../../lib/supabase/queries/taxonomy';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';

type Tab = 'areas' | 'types' | 'subtypes';

const TABS: { label: string; value: Tab }[] = [
  { label: 'Areas', value: 'areas' },
  { label: 'Types', value: 'types' },
  { label: 'Subtypes', value: 'subtypes' },
];

export default function TaxonomyScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('areas');

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
  });

  const { data: types = [], isLoading: typesLoading } = useQuery({
    queryKey: ['types'],
    queryFn: () => fetchTypes(),
    enabled: activeTab === 'types',
  });

  const { data: subtypes = [], isLoading: subtypesLoading } = useQuery({
    queryKey: ['subtypes'],
    queryFn: () => fetchSubtypes(),
    enabled: activeTab === 'subtypes',
  });

  const isLoading =
    (activeTab === 'areas' && areasLoading) ||
    (activeTab === 'types' && typesLoading) ||
    (activeTab === 'subtypes' && subtypesLoading);

  const currentData =
    activeTab === 'areas' ? areas :
    activeTab === 'types' ? types : subtypes;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader title="Taxonomy" subtitle="Areas, types & subtypes" />
      </View>

      {/* Tab switcher */}
      <View className="flex-row px-4 gap-2 mb-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              className={`flex-1 py-2 rounded-lg items-center border ${
                isActive ? 'bg-accent border-accent' : 'bg-surface border-hairline'
              }`}
              activeOpacity={0.75}
            >
              <Text
                className={`text-body-sm font-medium ${
                  isActive ? 'text-white' : 'text-ink-muted'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : currentData.length === 0 ? (
        <EmptyState
          icon="folder-outline"
          title={`No ${activeTab} yet`}
          description="Taxonomy entries will appear here once created."
        />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card className="mb-2">
              <Text className="text-display-md text-ink font-semibold">{item.name}</Text>
              {'description' in item && item.description ? (
                <Text className="text-body-sm text-ink-muted mt-1">{item.description}</Text>
              ) : null}
              <Text className="text-caption text-ink-tertiary mt-1">slug: {item.slug}</Text>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
