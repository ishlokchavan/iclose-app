import React from 'react';
import { View, Text } from 'react-native';
import type { InquiryStatus, TopicStatus, UserRole } from '../../types/database';

type BadgeVariant =
  | TopicStatus
  | InquiryStatus
  | UserRole
  | 'default'
  | 'success'
  | 'warning'
  | 'error';

const variantMap: Record<string, { bg: string; text: string }> = {
  // Topic statuses
  draft: { bg: 'bg-surface-subtle', text: 'text-ink-muted' },
  published: { bg: 'bg-green-100', text: 'text-green-700' },
  archived: { bg: 'bg-surface-subtle', text: 'text-ink-tertiary' },
  // Inquiry statuses
  open: { bg: 'bg-accent-subtle', text: 'text-accent' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-surface-subtle', text: 'text-ink-tertiary' },
  // Roles
  learner: { bg: 'bg-accent-subtle', text: 'text-accent' },
  educator: { bg: 'bg-purple-100', text: 'text-purple-700' },
  manager: { bg: 'bg-amber-100', text: 'text-amber-700' },
  admin: { bg: 'bg-red-100', text: 'text-red-700' },
  // Generic
  default: { bg: 'bg-surface-subtle', text: 'text-ink-muted' },
  success: { bg: 'bg-green-100', text: 'text-green-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  error: { bg: 'bg-red-100', text: 'text-red-700' },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const styles = variantMap[variant] ?? variantMap.default;

  return (
    <View className={`${styles.bg} rounded-sm px-2 py-0.5 self-start`}>
      <Text className={`${styles.text} text-caption font-medium`}>{label}</Text>
    </View>
  );
}
