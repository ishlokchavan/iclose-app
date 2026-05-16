import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Badge } from '../ui/Badge';
import type { Topic } from '../../types/database';

interface TopicCardProps {
  topic: Topic;
  onPress: () => void;
  showStatus?: boolean;
}

export function TopicCard({ topic, onPress, showStatus = false }: TopicCardProps) {
  const educatorName = topic.educator?.name ?? 'Unknown Educator';
  const areaName = topic.area?.name;

  const thumbnailUrl = topic.cover_url
    ?? (topic.youtube_id
      ? `https://img.youtube.com/vi/${topic.youtube_id}/hqdefault.jpg`
      : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-surface rounded-lg overflow-hidden mb-3"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Cover image */}
      <View className="w-full bg-surface-subtle" style={{ height: 180 }}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={{ width: '100%', height: 180 }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-ink-tertiary text-caption">No preview</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-3">
        <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
          {areaName ? (
            <View className="bg-accent-subtle rounded-sm px-2 py-0.5">
              <Text className="text-caption font-medium text-accent">{areaName}</Text>
            </View>
          ) : null}
          {showStatus ? (
            <Badge label={topic.status} variant={topic.status} />
          ) : null}
        </View>

        <Text className="text-display-md text-ink font-semibold mb-1" numberOfLines={2}>
          {topic.title}
        </Text>

        <Text className="text-body-sm text-ink-muted">{educatorName}</Text>
      </View>
    </TouchableOpacity>
  );
}
