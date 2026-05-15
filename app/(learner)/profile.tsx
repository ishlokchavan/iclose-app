import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/context';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RoleBadge } from '../../components/shell/RoleBadge';
import { Brand } from '../../components/shell/Brand';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
}

function InfoRow({ icon, label, value }: RowProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-hairline last:border-b-0">
      <View className="w-8 items-center mr-3">
        <Ionicons name={icon} size={20} color="#6e6e73" />
      </View>
      <View className="flex-1">
        <Text className="text-caption text-ink-tertiary mb-0.5">{label}</Text>
        <Text className="text-body text-ink">{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, user, signOut, role } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-6 items-center">
          <Avatar
            name={profile?.full_name}
            imageUrl={profile?.avatar_url}
            size={80}
          />
          <Text className="text-display-xl text-ink font-bold mt-3 mb-1">
            {profile?.full_name ?? 'User'}
          </Text>
          <Text className="text-body text-ink-muted mb-3">
            {user?.email}
          </Text>
          {role ? <RoleBadge role={role} /> : null}
        </View>

        {/* Info card */}
        <View className="px-4 mb-4">
          <Card>
            <Text className="text-body-sm font-semibold text-ink-muted mb-1">Account Info</Text>
            <InfoRow icon="person-outline" label="Full Name" value={profile?.full_name ?? undefined} />
            <InfoRow icon="mail-outline" label="Email" value={user?.email ?? undefined} />
            <InfoRow
              icon="calendar-outline"
              label="Member Since"
              value={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : undefined
              }
            />
          </Card>
        </View>

        {/* Sign out */}
        <View className="px-4 mb-8">
          <Button
            label="Sign Out"
            variant="destructive"
            size="lg"
            onPress={handleSignOut}
          />
        </View>

        {/* Brand footer */}
        <View className="items-center opacity-40">
          <Brand size="sm" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
