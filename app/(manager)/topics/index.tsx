import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAllTopics } from '../../../lib/supabase/queries/topics';
import { TopicList } from '../../../features/topics/TopicList';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { Spinner } from '../../../components/ui/Spinner';
import type { TopicStatus } from '../../../types/database';

const STATUS_TABS: { label: string; value: TopicStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
];

export default function ManagerTopicsScreen() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<TopicStatus | 'all'>('all');

  const { data: topics = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allTopics', activeStatus],
    queryFn: () =>
      fetchAllTopics(activeStatus !== 'all' ? { status: activeStatus } : undefined),
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader
          title="Topics"
          actionLabel="New"
          onAction={() => router.push('/(manager)/topics/new')}
        />
      </View>

      {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveStatus(tab.value)}
              className={`px-4 py-2 rounded-lg border ${
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
      </ScrollView>

      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <TopicList
          topics={topics}
          isRefreshing={isRefetching}
          onRefresh={refetch}
          showStatus
          emptyTitle="No topics"
          emptyDescription="Create your first topic to get started."
          emptyActionLabel="Create Topic"
          onEmptyAction={() => router.push('/(manager)/topics/new')}
        />
      )}
    </SafeAreaView>
  );
}
