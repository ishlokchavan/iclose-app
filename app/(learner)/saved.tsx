import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchSavedTopics } from '../../lib/supabase/queries/topics';
import { useAuth } from '../../lib/auth/context';
import { TopicList } from '../../features/topics/TopicList';
import { PageHeader } from '../../components/patterns/PageHeader';
import { Spinner } from '../../components/ui/Spinner';

export default function SavedScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: topics = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['savedTopics', user?.id],
    queryFn: () => fetchSavedTopics(user!.id),
    enabled: !!user,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader title="Saved" subtitle={`${topics.length} topic${topics.length !== 1 ? 's' : ''}`} />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <TopicList
          topics={topics}
          isRefreshing={isRefetching}
          onRefresh={refetch}
          emptyTitle="Nothing saved yet"
          emptyDescription="Bookmark topics while browsing to find them here later."
          emptyActionLabel="Browse Topics"
          onEmptyAction={() => router.push('/(learner)/topics')}
        />
      )}
    </SafeAreaView>
  );
}
