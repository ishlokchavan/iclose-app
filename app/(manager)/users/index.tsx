import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchAllProfiles,
  updateProfile,
  deleteProfile,
} from '../../../lib/supabase/queries/profiles';
import { useAuth } from '../../../lib/auth/context';
import { Avatar } from '../../../components/ui/Avatar';
import { RoleBadge } from '../../../components/shell/RoleBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { isAdmin } from '../../../lib/auth/guards';
import type { Profile, UserRole } from '../../../types/database';

const SCREEN_H = Dimensions.get('window').height;

type UserTab = 'learners' | 'staff' | 'admin';
type ModalMode = 'view' | 'edit';

const TAB_CONFIG: { label: string; value: UserTab; roles: UserRole[] }[] = [
  { label: 'Learners', value: 'learners', roles: ['learner'] },
  { label: 'Staff', value: 'staff', roles: ['educator', 'manager'] },
  { label: 'Admin', value: 'admin', roles: ['admin'] },
];

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'learner', label: 'Learner' },
  { value: 'educator', label: 'Educator' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UserRow({ user, onPress }: { user: Profile; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={user.full_name} imageUrl={user.avatar_url} size={42} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {user.full_name ?? 'Unnamed'}
        </Text>
        {user.email ? (
          <Text style={styles.rowEmail} numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
    </TouchableOpacity>
  );
}

function DetailRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );
}

// ─── User modal ───────────────────────────────────────────────────────────────

interface UserModalProps {
  user: Profile | null;
  canEdit: boolean;
  onClose: () => void;
}

function UserModal({ user, canEdit, onClose }: UserModalProps) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ModalMode>('view');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('learner');

  useEffect(() => {
    if (user) {
      setEditName(user.full_name ?? '');
      setEditRole(user.role);
      setMode('view');
    }
  }, [user?.id]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Pick<Profile, 'full_name' | 'role'>>) =>
      updateProfile(user!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      setMode('view');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Failed to update user.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProfile(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(
        'Cannot Delete',
        err?.message ?? 'Failed to delete. The user may have associated data.',
      );
    },
  });

  const handleSave = () => {
    if (!editName.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    updateMutation.mutate({ full_name: editName.trim(), role: editRole });
  };

  const handleRolePicker = () => {
    Alert.alert(
      'Change Role',
      `Current: ${capitalize(editRole)}`,
      [
        ...ALL_ROLES.map((r) => ({
          text: r.label,
          onPress: () => setEditRole(r.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete User',
      `Remove ${user?.full_name ?? 'this user'}? Their profile will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  return (
    <Modal
      visible={!!user}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        {/* Backdrop tap closes */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        {/* Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Handle + close */}
            <View style={styles.sheetHeader}>
              <View style={styles.handle} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#6e6e73" />
              </TouchableOpacity>
            </View>

            {/* User identity */}
            <View style={styles.identity}>
              <Avatar
                name={user?.full_name}
                imageUrl={user?.avatar_url}
                size={60}
              />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {user?.full_name ?? 'Unnamed'}
                </Text>
                <Text style={styles.identityEmail} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
                {user?.role ? (
                  <View style={{ marginTop: 4 }}>
                    <RoleBadge role={user.role} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: SCREEN_H * 0.55 }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {mode === 'view' ? (
                <>
                  {/* Contact */}
                  <SectionHeader title="Contact" />
                  <View style={styles.card}>
                    <DetailRow label="Full name" value={user?.full_name ?? '—'} />
                    <DetailRow label="Email" value={user?.email ?? '—'} />
                    <DetailRow
                      label="Plan"
                      value={user ? capitalize(user.plan_key ?? 'free') : '—'}
                      isLast
                    />
                  </View>

                  {/* Account */}
                  <SectionHeader title="Account" />
                  <View style={styles.card}>
                    <DetailRow
                      label="Role"
                      value={user ? capitalize(user.role) : '—'}
                    />
                    <DetailRow
                      label="Joined"
                      value={user ? fmtDate(user.created_at) : '—'}
                    />
                    <DetailRow
                      label="Last updated"
                      value={user ? fmtDate(user.updated_at) : '—'}
                      isLast
                    />
                  </View>

                  {/* Actions */}
                  {canEdit ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setMode('edit')}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.actionBtnText}>Edit details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ alignItems: 'center', paddingVertical: 14 }}
                        onPress={handleDelete}
                        disabled={deleteMutation.isPending}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.deleteText}>
                          {deleteMutation.isPending ? 'Deleting…' : 'Delete user…'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Edit form */}
                  <SectionHeader title="Editing Details" />
                  <View style={styles.editForm}>
                    <Input
                      label="Full name"
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter full name"
                      autoCapitalize="words"
                      autoFocus
                    />
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.fieldLabel}>Role</Text>
                      <TouchableOpacity
                        style={styles.rolePicker}
                        onPress={handleRolePicker}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.rolePickerText}>
                          {capitalize(editRole)}
                        </Text>
                        <Ionicons
                          name="chevron-expand"
                          size={16}
                          color="#6e6e73"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label="Save changes"
                      onPress={handleSave}
                      loading={updateMutation.isPending}
                      size="lg"
                    />
                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 14 }}
                      onPress={() => setMode('view')}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 15, color: '#6e6e73' }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { role: currentRole } = useAuth();
  const canEdit = isAdmin(currentRole);

  const [activeTab, setActiveTab] = useState<UserTab>('learners');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const { data: allProfiles = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: fetchAllProfiles,
  });

  const tabCounts = useMemo(() => {
    const c: Record<UserTab, number> = { learners: 0, staff: 0, admin: 0 };
    for (const p of allProfiles) {
      if (p.role === 'learner') c.learners++;
      else if (p.role === 'educator' || p.role === 'manager') c.staff++;
      else if (p.role === 'admin') c.admin++;
    }
    return c;
  }, [allProfiles]);

  const filtered = useMemo(() => {
    const roles =
      TAB_CONFIG.find((t) => t.value === activeTab)?.roles ?? [];
    const q = search.trim().toLowerCase();
    return allProfiles
      .filter((p) => roles.includes(p.role))
      .filter(
        (p) =>
          !q ||
          p.full_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
  }, [allProfiles, activeTab, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            {allProfiles.length} member{allProfiles.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6e6e73" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email…"
          placeholderTextColor="#9a9aa5"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9a9aa5" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              <View
                style={[styles.tabBadge, active && styles.tabBadgeActive]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    active && styles.tabBadgeTextActive,
                  ]}
                >
                  {tabCounts[tab.value]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="person-outline"
          title={search ? 'No results' : `No ${activeTab}`}
          description={
            search
              ? 'Try a different search term.'
              : 'No users in this category yet.'
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0071e3"
            />
          }
          ListHeaderComponent={
            <Text style={styles.listCount}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <UserRow user={item} onPress={() => setSelectedUser(item)} />
          )}
        />
      )}

      <UserModal
        user={selectedUser}
        canEdit={canEdit}
        onClose={() => setSelectedUser(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 14, color: '#6e6e73', marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1d1d1f',
    marginLeft: 8,
  },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#ebebed',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  tabLabelActive: { color: '#1d1d1f', fontWeight: '600' },
  tabBadge: {
    backgroundColor: '#d2d2d7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: '#0071e3' },
  tabBadgeText: { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  tabBadgeTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  listCount: {
    fontSize: 12,
    color: '#9a9aa5',
    marginBottom: 6,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d2d2d7',
  },
  rowBody: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },
  rowEmail: { fontSize: 13, color: '#6e6e73', marginTop: 1 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f5f5f7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
    position: 'relative',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d2d2d7',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ebebed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  identityName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1d1d1f',
  },
  identityEmail: {
    fontSize: 13,
    color: '#6e6e73',
    marginTop: 2,
    marginBottom: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d2d2d7',
    marginHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9a9aa5',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d2d2d7',
  },
  detailLabel: { fontSize: 14, color: '#6e6e73' },
  detailValue: {
    fontSize: 14,
    color: '#1d1d1f',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  actions: { paddingHorizontal: 16, paddingTop: 16 },
  actionBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
  },
  actionBtnText: { fontSize: 16, fontWeight: '500', color: '#1d1d1f' },
  deleteText: { fontSize: 15, color: '#b81c3a', fontWeight: '500' },

  editForm: { paddingHorizontal: 16, paddingTop: 8 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1d1d1f',
    marginBottom: 6,
  },
  rolePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d2d2d7',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rolePickerText: { fontSize: 15, color: '#1d1d1f' },
});
