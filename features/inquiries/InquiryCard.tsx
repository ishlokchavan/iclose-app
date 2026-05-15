import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import type { Inquiry } from '../../types/database';

interface InquiryCardProps {
  inquiry: Inquiry;
  onPress?: () => void;
  showUser?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InquiryCard({ inquiry, onPress, showUser = false }: InquiryCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      className="bg-surface rounded-lg p-4 mb-3"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-display-md text-ink font-semibold flex-1 mr-3" numberOfLines={1}>
          {inquiry.title}
        </Text>
        <Badge label={inquiry.status.replace('_', ' ')} variant={inquiry.status} />
      </View>

      <Text className="text-body text-ink-muted mb-3" numberOfLines={2}>
        {inquiry.description}
      </Text>

      <View className="flex-row items-center gap-3 flex-wrap">
        {inquiry.area?.name ? (
          <View className="bg-accent-subtle rounded-sm px-2 py-0.5">
            <Text className="text-caption text-accent font-medium">{inquiry.area.name}</Text>
          </View>
        ) : null}

        {showUser && inquiry.user?.full_name ? (
          <Text className="text-caption text-ink-tertiary">
            By {inquiry.user.full_name}
          </Text>
        ) : null}

        <Text className="text-caption text-ink-tertiary ml-auto">
          {formatDate(inquiry.created_at)}
        </Text>
      </View>

      {inquiry.response ? (
        <View className="mt-3 pt-3 border-t border-hairline">
          <Text className="text-body-sm text-ink-muted font-medium mb-1">Response:</Text>
          <Text className="text-body-sm text-ink" numberOfLines={3}>
            {inquiry.response}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
