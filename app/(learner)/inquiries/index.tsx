import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchMyInquiries } from '../../../lib/supabase/queries/inquiries';
import { useAuth } from '../../../lib/auth/context';
import { InquiryCard } from '../../../features/inquiries/InquiryCard';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';

export default function LearnerInquiriesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: inquiries = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myInquiries', user?.id],
    queryFn: () => fetchMyInquiries(user!.id),
    enabled: !!user,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader
          title="My Inquiries"
          actionLabel="New"
          onAction={() => router.push('/(learner)/inquiries/new')}
        />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title="No inquiries yet"
          description="Have a question? Post your first inquiry and get help from our team."
          actionLabel="Post Inquiry"
          onAction={() => router.push('/(learner)/inquiries/new')}
        />
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InquiryCard inquiry={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0071e3"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
