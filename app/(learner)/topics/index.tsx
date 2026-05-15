import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchTopics } from '../../../lib/supabase/queries/topics';
import { fetchAreas } from '../../../lib/supabase/queries/taxonomy';
import { TopicList } from '../../../features/topics/TopicList';
import { TopicFilters } from '../../../features/topics/TopicFilters';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { Spinner } from '../../../components/ui/Spinner';

export default function TopicsBrowseScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
  });

  const { data: topics = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['topics', { search, area: selectedArea }],
    queryFn: () => fetchTopics({ search: search || undefined, area: selectedArea ?? undefined }),
  });

  const areaChips = areas.map((a) => ({ label: a.name, value: a.slug }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Search bar */}
      <View className="px-4 pt-4 pb-2">
        <PageHeader title="Browse" />
        <View className="flex-row items-center bg-surface rounded-lg px-3 border border-hairline">
          <Ionicons name="search-outline" size={18} color="#6e6e73" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search topics…"
            placeholderTextColor="#9a9aa5"
            className="flex-1 py-3 px-2 text-body text-ink"
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Ionicons
              name="close-circle"
              size={18}
              color="#9a9aa5"
              onPress={() => setSearch('')}
            />
          )}
        </View>
      </View>

      {/* Filters */}
      {areaChips.length > 0 && (
        <TopicFilters
          chips={areaChips}
          selected={selectedArea}
          onSelect={setSelectedArea}
        />
      )}

      {/* List */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <TopicList
          topics={topics}
          isRefreshing={isRefetching}
          onRefresh={refetch}
          emptyTitle="No topics found"
          emptyDescription="Try adjusting your search or filters."
        />
      )}
    </SafeAreaView>
  );
}
