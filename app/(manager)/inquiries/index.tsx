import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchAllInquiries } from '../../../lib/supabase/queries/inquiries';
import { InquiryCard } from '../../../features/inquiries/InquiryCard';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import type { InquiryStatus } from '../../../types/database';

const STATUS_TABS: { label: string; value: InquiryStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export default function ManagerInquiriesScreen() {
  const [activeStatus, setActiveStatus] = useState<InquiryStatus | 'all'>('all');

  const { data: inquiries = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allInquiries', activeStatus],
    queryFn: () =>
      fetchAllInquiries(activeStatus !== 'all' ? { status: activeStatus } : undefined),
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader title="Inquiries" subtitle={`${inquiries.length} total`} />
      </View>

      {/* Status tabs */}
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
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No inquiries"
          description="Inquiries from learners will appear here."
        />
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InquiryCard inquiry={item} showUser />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />
          }
        />
      )}
    </SafeAreaView>
  );
}
