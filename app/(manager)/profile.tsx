import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/context';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RoleBadge } from '../../components/shell/RoleBadge';
import { Brand } from '../../components/shell/Brand';

function Row({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color="#6e6e73" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function ManagerProfileScreen() {
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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Identity */}
        <View style={styles.identity}>
          <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={80} />
          <Text style={styles.name}>{profile?.full_name ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {role ? (
            <View style={{ marginTop: 8 }}>
              <RoleBadge role={role} />
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Card>
            <Text style={styles.cardTitle}>Account Info</Text>
            <Row icon="person-outline" label="Full Name" value={profile?.full_name ?? undefined} />
            <Row icon="mail-outline" label="Email" value={user?.email ?? undefined} />
            <Row
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
        <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
          <Button label="Sign Out" variant="destructive" size="lg" onPress={handleSignOut} />
        </View>

        <View style={styles.brand}>
          <Brand size="sm" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },
  identity: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#1d1d1f', marginTop: 12 },
  email: { fontSize: 14, color: '#6e6e73', marginTop: 4 },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6e6e73',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d2d2d7',
    gap: 12,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowLabel: { fontSize: 12, color: '#9a9aa5' },
  rowValue: { fontSize: 15, color: '#1d1d1f', marginTop: 1 },
  brand: { alignItems: 'center', opacity: 0.4 },
});
