import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="bg-surface-subtle rounded-xl w-20 h-20 items-center justify-center mb-4">
        <Ionicons name={icon} size={36} color="#6e6e73" />
      </View>
      <Text className="text-display-md text-ink font-semibold text-center mb-2">{title}</Text>
      {description ? (
        <Text className="text-body text-ink-muted text-center mb-6">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" size="md" />
      ) : null}
    </View>
  );
}
