import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchEducators } from '../../../lib/supabase/queries/educators';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Avatar } from '../../../components/ui/Avatar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import type { Educator } from '../../../types/database';

function EducatorCard({ educator }: { educator: Educator }) {
  const name = educator.profile?.full_name ?? 'Unknown';
  const email = educator.profile?.email ?? '';
  const bio = educator.bio ?? 'No bio provided.';
  const specs = educator.specializations ?? [];

  return (
    <Card className="mb-3">
      <View className="flex-row items-start gap-3">
        <Avatar name={name} imageUrl={educator.profile?.avatar_url} size={48} />
        <View className="flex-1">
          <Text className="text-display-md text-ink font-semibold">{name}</Text>
          {email ? (
            <Text className="text-body-sm text-ink-muted mb-1">{email}</Text>
          ) : null}
          <Text className="text-body-sm text-ink-muted mb-2" numberOfLines={2}>
            {bio}
          </Text>
          {specs.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {specs.map((s, i) => (
                <View key={i} className="bg-accent-subtle rounded-sm px-2 py-0.5">
                  <Text className="text-caption text-accent font-medium">{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function EducatorsScreen() {
  const { data: educators = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['educators'],
    queryFn: fetchEducators,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader title="Educators" subtitle={`${educators.length} educator${educators.length !== 1 ? 's' : ''}`} />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : educators.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No educators yet"
          description="Educators will appear here once their profiles are created."
        />
      ) : (
        <FlatList
          data={educators}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EducatorCard educator={item} />}
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
