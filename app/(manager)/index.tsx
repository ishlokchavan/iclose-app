import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchAllTopics } from '../../lib/supabase/queries/topics';
import { fetchAllInquiries } from '../../lib/supabase/queries/inquiries';
import { useAuth } from '../../lib/auth/context';
import { Card } from '../../components/ui/Card';
import { Brand } from '../../components/shell/Brand';
import { RoleBadge } from '../../components/shell/RoleBadge';
import { Spinner } from '../../components/ui/Spinner';

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

function StatCard({ label, value, color = '#1d1d1f' }: StatCardProps) {
  return (
    <Card className="flex-1 items-center py-4">
      <Text style={{ color, fontSize: 32, fontWeight: '700' }}>{value}</Text>
      <Text className="text-caption text-ink-muted mt-1 text-center">{label}</Text>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { profile, role } = useAuth();

  const {
    data: topics = [],
    isLoading: topicsLoading,
    refetch: refetchTopics,
    isRefetching: topicsRefetching,
  } = useQuery({
    queryKey: ['allTopics'],
    queryFn: () => fetchAllTopics(),
  });

  const {
    data: inquiries = [],
    isLoading: inquiriesLoading,
    refetch: refetchInquiries,
    isRefetching: inquiriesRefetching,
  } = useQuery({
    queryKey: ['allInquiries'],
    queryFn: () => fetchAllInquiries(),
  });

  const isLoading = topicsLoading || inquiriesLoading;
  const isRefreshing = topicsRefetching || inquiriesRefetching;

  const handleRefresh = () => {
    refetchTopics();
    refetchInquiries();
  };

  const topicStats = {
    total: topics.length,
    published: topics.filter((t) => t.status === 'published').length,
    draft: topics.filter((t) => t.status === 'draft').length,
    archived: topics.filter((t) => t.status === 'archived').length,
  };

  const inquiryStats = {
    total: inquiries.length,
    open: inquiries.filter((i) => i.status === 'open').length,
    inProgress: inquiries.filter((i) => i.status === 'in_progress').length,
    resolved: inquiries.filter((i) => i.status === 'closed').length,
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0071e3" />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Brand size="md" />
          {role ? <RoleBadge role={role} /> : null}
        </View>

        <View className="mb-2">
          <Text className="text-display-2xl text-ink font-bold">
            Hello, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
          </Text>
          <Text className="text-body text-ink-muted mt-1">Here's your academy overview</Text>
        </View>

        {isLoading ? (
          <View className="mt-8">
            <Spinner />
          </View>
        ) : (
          <>
            {/* Topics section */}
            <View className="mt-6 mb-4">
              <Text className="text-display-md text-ink font-semibold mb-3">Topics</Text>
              <View className="flex-row gap-3 mb-3">
                <StatCard label="Total" value={topicStats.total} />
                <StatCard label="Published" value={topicStats.published} color="#16a34a" />
              </View>
              <View className="flex-row gap-3">
                <StatCard label="Draft" value={topicStats.draft} color="#d97706" />
                <StatCard label="Archived" value={topicStats.archived} color="#9a9aa5" />
              </View>
            </View>

            {/* Inquiries section */}
            <View className="mt-2">
              <Text className="text-display-md text-ink font-semibold mb-3">Inquiries</Text>
              <View className="flex-row gap-3 mb-3">
                <StatCard label="Total" value={inquiryStats.total} />
                <StatCard label="Open" value={inquiryStats.open} color="#0071e3" />
              </View>
              <View className="flex-row gap-3">
                <StatCard label="In Progress" value={inquiryStats.inProgress} color="#d97706" />
                <StatCard label="Resolved" value={inquiryStats.resolved} color="#16a34a" />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
