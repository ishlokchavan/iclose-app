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
          {inquiry.description}
        </Text>
        <Badge label={inquiry.status.replace('_', ' ')} variant={inquiry.status} />
      </View>

      <View className="flex-row items-center gap-3 flex-wrap">
        {inquiry.area?.name ? (
          <View className="bg-accent-subtle rounded-sm px-2 py-0.5">
            <Text className="text-caption text-accent font-medium">{inquiry.area.name}</Text>
          </View>
        ) : null}

        {showUser && inquiry.learner?.full_name ? (
          <Text className="text-caption text-ink-tertiary">
            By {inquiry.learner.full_name}
          </Text>
        ) : null}

        <Text className="text-caption text-ink-tertiary ml-auto">
          {formatDate(inquiry.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
