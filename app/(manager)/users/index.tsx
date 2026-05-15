import React from 'react';
import { View, Text, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllProfiles, updateUserRole } from '../../../lib/supabase/queries/profiles';
import { useAuth } from '../../../lib/auth/context';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Avatar } from '../../../components/ui/Avatar';
import { RoleBadge } from '../../../components/shell/RoleBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { isAdmin } from '../../../lib/auth/guards';
import type { Profile, UserRole } from '../../../types/database';

const ROLES: UserRole[] = ['learner', 'educator', 'manager', 'admin'];

function UserCard({
  profile,
  canEdit,
  onRoleChange,
}: {
  profile: Profile;
  canEdit: boolean;
  onRoleChange: (userId: string, role: UserRole) => void;
}) {
  const handleRolePress = () => {
    if (!canEdit) return;
    Alert.alert(
      'Change Role',
      `Update role for ${profile.full_name ?? profile.email}`,
      [
        ...ROLES.map((role) => ({
          text: role.charAt(0).toUpperCase() + role.slice(1),
          onPress: () => onRoleChange(profile.id, role),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <Card className="mb-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size={44} />
        <View className="flex-1">
          <Text className="text-display-md text-ink font-semibold">
            {profile.full_name ?? 'Unnamed User'}
          </Text>
          <Text className="text-body-sm text-ink-muted">{profile.email}</Text>
        </View>
        <View onTouchEnd={handleRolePress}>
          <RoleBadge role={profile.role} />
        </View>
      </View>
      {canEdit && (
        <Text className="text-caption text-ink-tertiary mt-2 text-right">
          Tap role badge to change
        </Text>
      )}
    </Card>
  );
}

export default function UsersScreen() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = isAdmin(role);

  const { data: profiles = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: fetchAllProfiles,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: UserRole }) =>
      updateUserRole(userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Failed to update role.');
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-4 pb-2">
        <PageHeader
          title="Users"
          subtitle={`${profiles.length} member${profiles.length !== 1 ? 's' : ''}`}
        />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No users found"
          description="Registered users will appear here."
        />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserCard
              profile={item}
              canEdit={canEdit}
              onRoleChange={(userId, newRole) =>
                roleMutation.mutate({ userId, newRole })
              }
            />
          )}
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
