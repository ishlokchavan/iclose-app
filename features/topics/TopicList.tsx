import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { TopicCard } from '../../components/patterns/TopicCard';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Topic } from '../../types/database';

interface TopicListProps {
  topics: Topic[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  showStatus?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export function TopicList({
  topics,
  isRefreshing = false,
  onRefresh,
  showStatus = false,
  emptyTitle = 'No topics found',
  emptyDescription = 'There are no topics to display right now.',
  emptyActionLabel,
  onEmptyAction,
}: TopicListProps) {
  const router = useRouter();

  if (topics.length === 0) {
    return (
      <EmptyState
        icon="play-circle-outline"
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <FlatList
      data={topics}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TopicCard
          topic={item}
          showStatus={showStatus}
          onPress={() =>
            router.push(
              showStatus
                ? `/(manager)/topics/${item.slug}`
                : `/(learner)/topics/${item.slug}`,
            )
          }
        />
      )}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0071e3"
          />
        ) : undefined
      }
    />
  );
}
