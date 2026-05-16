import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchAllProfiles,
  fetchFullUserProfile,
  deleteProfile,
  upsertUserLead,
  inviteTeamMember,
} from '../../../lib/supabase/queries/profiles';
import { useAuth } from '../../../lib/auth/context';
import { Avatar } from '../../../components/ui/Avatar';
import { RoleBadge } from '../../../components/shell/RoleBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { isAdmin } from '../../../lib/auth/guards';
import type { Profile, UserRole } from '../../../types/database';

const { width: SCREEN_W } = Dimensions.get('window');

type UserTab = 'learners' | 'staff' | 'admin';
type DetailMode = 'view' | 'edit';
type Period = 'all' | 'today' | 'week' | 'month' | '3months';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'All time',    value: 'all' },
  { label: 'Today',       value: 'today' },
  { label: 'This week',   value: 'week' },
  { label: 'This month',  value: 'month' },
  { label: 'Last 3 mo',  value: '3months' },
];

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === '3months') {
    return new Date(now.getFullYear(), now.getMonth() - 3, 1);
  }
  return null;
}

const TAB_CONFIG: { label: string; value: UserTab; roles: UserRole[] }[] = [
  { label: 'Learners', value: 'learners', roles: ['learner'] },
  { label: 'Staff',    value: 'staff',    roles: ['educator', 'manager'] },
  { label: 'Admin',    value: 'admin',    roles: ['admin'] },
];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function UserRow({ user, onPress }: { user: Profile; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={user.full_name} imageUrl={user.avatar_url} size={42} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{user.full_name ?? 'Unnamed'}</Text>
        {user.email ? <Text style={styles.rowEmail} numberOfLines={1}>{user.email}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
    </TouchableOpacity>
  );
}

function DetailRow({
  label, value, isLast, verified,
}: {
  label: string; value: string; isLast?: boolean; verified?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {verified ? (
          <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
        ) : null}
        <Text style={[styles.detailValue, verified && { color: '#16a34a' }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>;
}

function EditField({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={styles.editFieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9a9aa5"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Period picker ────────────────────────────────────────────────────────────

function PeriodPicker({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const [open, setOpen] = useState(false);
  const label = PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? 'All time';
  return (
    <>
      <TouchableOpacity style={styles.periodBtn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.periodBtnText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color="#6e6e73" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerCard}>
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value} style={styles.pickerItem}
                onPress={() => { onChange(opt.value); setOpen(false); }} activeOpacity={0.7}>
                <Text style={[styles.pickerItemText, value === opt.value && styles.pickerItemActive]}>
                  {opt.label}
                </Text>
                {value === opt.value ? <Ionicons name="checkmark" size={16} color="#0071e3" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  const inviteMutation = useMutation({
    mutationFn: () => inviteTeamMember(email.trim(), name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      Alert.alert('Invitation sent', `An invite email has been sent to ${email.trim()}.`);
      setName(''); setEmail('');
      onClose();
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to send invitation.'),
  });

  const handleSend = () => {
    if (!email.trim()) { Alert.alert('Validation', 'Email is required.'); return; }
    inviteMutation.mutate();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.inviteBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.inviteCard}>
          <View style={styles.inviteCardHeader}>
            <Text style={styles.inviteTitle}>Invite team member</Text>
            <TouchableOpacity style={styles.inviteCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color="#6e6e73" />
            </TouchableOpacity>
          </View>
          <Text style={styles.inviteSubtitle}>
            They'll receive a "Set your password" email and can sign in right away.
          </Text>
          <EditField label="Full name" value={name} onChangeText={setName} placeholder="Sarah Al-Mansouri" autoCapitalize="words" />
          <EditField label="Email" value={email} onChangeText={setEmail} placeholder="sarah@company.ae" keyboardType="email-address" />
          <Text style={styles.inviteNote}>
            Invitee will be added as a <Text style={{ fontWeight: '700' }}>Manager</Text>.
          </Text>
          <TouchableOpacity
            style={[styles.inviteSendBtn, inviteMutation.isPending && { opacity: 0.7 }]}
            onPress={handleSend}
            disabled={inviteMutation.isPending}
            activeOpacity={0.8}
          >
            {inviteMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.inviteSendText}>Send invitation</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.inviteCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── User Detail Screen (full-screen, slides in from right) ───────────────────

interface UserDetailProps {
  user: Profile | null;
  currentUserId: string | null;
  canEditContact: boolean;
  onClose: () => void;
}

function UserDetailScreen({ user, currentUserId, canEditContact, onClose }: UserDetailProps) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const [cachedUser, setCachedUser] = useState<Profile | null>(null);
  const [mode, setMode] = useState<DetailMode>('view');

  // Staff = manager / admin / educator — simplified view, no contact section
  const isStaffUser = !!cachedUser && cachedUser.role !== 'learner';
  const isSelf      = !!cachedUser && cachedUser.id === currentUserId;

  // Edit state
  const [editFullName,  setEditFullName]  = useState(''); // staff: single full-name field
  const [editFirstName, setEditFirstName] = useState(''); // learner
  const [editLastName,  setEditLastName]  = useState(''); // learner
  const [editPhone,     setEditPhone]     = useState(''); // learner
  const [editEmail,     setEditEmail]     = useState('');

  // Slide in when a new user is selected
  useEffect(() => {
    if (user) {
      setCachedUser(user);
      setMode('view');
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    }
  }, [user?.id]);

  const handleClose = () => {
    Animated.timing(translateX, {
      toValue: SCREEN_W, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  };

  // Fetch enriched profile (profiles + leads join)
  const { data: full, isLoading: fullLoading } = useQuery({
    queryKey: ['fullUserProfile', cachedUser?.id],
    queryFn: () => fetchFullUserProfile(cachedUser!.id),
    enabled: !!cachedUser,
    staleTime: 1000 * 60 * 2,
  });

  // Populate edit fields when data arrives
  useEffect(() => {
    if (cachedUser) {
      setEditFullName(cachedUser.full_name ?? '');
      setEditEmail(cachedUser.email ?? '');
    }
  }, [cachedUser?.id]);

  useEffect(() => {
    if (full && !isStaffUser) {
      setEditFirstName(full.first_name ?? '');
      setEditLastName(full.last_name ?? '');
      setEditPhone(full.phone ?? '');
      setEditEmail(full.email ?? cachedUser?.email ?? '');
    }
  }, [full]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editEmail.trim()) throw new Error('Email cannot be empty.');
      if (isStaffUser) {
        await upsertUserLead(cachedUser!.id, {
          first_name: editFullName.trim(),
          last_name:  '',
          phone:      '',
          email:      editEmail.trim(),
        });
      } else {
        await upsertUserLead(cachedUser!.id, {
          first_name: editFirstName.trim(),
          last_name:  editLastName.trim(),
          phone:      editPhone.trim(),
          email:      editEmail.trim(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['fullUserProfile', cachedUser?.id] });
      setCachedUser((prev) =>
        prev ? {
          ...prev,
          email: editEmail.trim() || prev.email,
          full_name: isStaffUser
            ? (editFullName.trim() || prev.full_name)
            : ([editFirstName, editLastName].filter(Boolean).join(' ') || prev.full_name),
        } : prev,
      );
      setMode('view');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProfile(cachedUser!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      handleClose();
    },
    onError: (err: any) =>
      Alert.alert('Cannot Delete', err?.message ?? 'Failed to delete. User may have associated data.'),
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete User',
      `Remove ${cachedUser?.full_name ?? 'this user'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const displayName = full && !isStaffUser
    ? [full.first_name, full.last_name].filter(Boolean).join(' ') || full.full_name || 'Unnamed'
    : cachedUser?.full_name ?? 'Unnamed';

  return (
    <Modal visible={!!user} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>

        {/* Navigation bar */}
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Users</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>{displayName}</Text>
          <View style={{ width: 72 }} />
        </View>

        {/* Compact horizontal identity */}
        <View style={styles.detailIdentity}>
          <Avatar name={cachedUser?.full_name} imageUrl={cachedUser?.avatar_url} size={52} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.detailName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.detailEmail} numberOfLines={1}>{cachedUser?.email ?? '—'}</Text>
            {cachedUser?.role ? <View style={{ marginTop: 5 }}><RoleBadge role={cachedUser.role} /></View> : null}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {fullLoading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color="#0071e3" />
            </View>
          ) : mode === 'view' ? (
            <>
              {/* ── Learner: full contact section ── */}
              {!isStaffUser ? (
                <>
                  <SectionLabel title="Contact" />
                  <View style={styles.card}>
                    <DetailRow label="First name" value={full?.first_name ?? '—'} />
                    <DetailRow label="Last name"  value={full?.last_name  ?? '—'} />
                    <DetailRow label="Email"      value={cachedUser?.email ?? '—'} />
                    <DetailRow label="Phone"      value={full?.phone ?? '—'} />
                    <DetailRow label="Plan"       value={capitalize(cachedUser?.plan_key ?? 'free')} />
                    <DetailRow
                      label="Verified"
                      verified={!!full?.is_verified}
                      value={
                        full?.is_verified && full.verified_at
                          ? fmtDateTime(full.verified_at)
                          : full?.is_verified ? 'Yes'
                          : full != null ? 'Not verified' : '—'
                      }
                    />
                    <DetailRow
                      label="Registered"
                      value={full?.lead_created_at ? fmtDateTime(full.lead_created_at) : '—'}
                    />
                    <DetailRow
                      label="Source"
                      value={full?.source ? capitalize(full.source.replace(/_/g, ' ')) : '—'}
                    />
                    <DetailRow
                      label="Marketing"
                      value={full?.consent_marketing == null ? '—' : full.consent_marketing ? 'Opted in' : 'Opted out'}
                      isLast
                    />
                  </View>

                  <SectionLabel title="Account" />
                  <View style={styles.card}>
                    <DetailRow label="Role"         value={cachedUser ? capitalize(cachedUser.role) : '—'} />
                    <DetailRow label="Joined"       value={cachedUser ? fmtDateTime(cachedUser.created_at) : '—'} />
                    <DetailRow label="Last updated" value={cachedUser ? fmtDateTime(cachedUser.updated_at) : '—'} isLast />
                  </View>
                </>
              ) : (
                /* ── Staff: compact account section only ── */
                <>
                  <SectionLabel title="Account" />
                  <View style={styles.card}>
                    <DetailRow label="Email"        value={cachedUser?.email ?? '—'} />
                    <DetailRow label="Role"         value={cachedUser ? capitalize(cachedUser.role) : '—'} />
                    <DetailRow label="Joined"       value={cachedUser ? fmtDateTime(cachedUser.created_at) : '—'} />
                    <DetailRow label="Last updated" value={cachedUser ? fmtDateTime(cachedUser.updated_at) : '—'} isLast />
                  </View>
                </>
              )}

              {/* Actions */}
              {canEditContact ? (
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setMode('edit')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionBtnText}>Edit details</Text>
                  </TouchableOpacity>
                  {!isSelf ? (
                    <TouchableOpacity
                      style={styles.deleteTouchable}
                      onPress={handleDelete}
                      disabled={deleteMutation.isPending}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.deleteText}>
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete user…'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            /* ── Edit mode ── */
            <>
              {isStaffUser ? (
                <>
                  <SectionLabel title="Details" />
                  <View style={styles.editCard}>
                    <EditField label="Full name" value={editFullName} onChangeText={setEditFullName} autoCapitalize="words" />
                    <EditField label="Email" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />
                  </View>
                </>
              ) : (
                <>
                  <SectionLabel title="Contact" />
                  <View style={styles.editCard}>
                    <EditField label="First name" value={editFirstName} onChangeText={setEditFirstName} autoCapitalize="words" />
                    <EditField label="Last name"  value={editLastName}  onChangeText={setEditLastName}  autoCapitalize="words" />
                    <EditField label="Phone"      value={editPhone}     onChangeText={setEditPhone}     keyboardType="phone-pad" />
                    <EditField label="Email"      value={editEmail}     onChangeText={setEditEmail}     keyboardType="email-address" />
                  </View>
                </>
              )}

              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  activeOpacity={0.8}
                >
                  {updateMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.actionBtnPrimaryText}>Save changes</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteTouchable} onPress={() => setMode('view')} activeOpacity={0.75}>
                  <Text style={{ fontSize: 15, color: '#6e6e73' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { role: currentRole, user: currentUser } = useAuth();
  const canEditContact = currentRole === 'manager' || isAdmin(currentRole);

  const [activeTab,     setActiveTab]     = useState<UserTab>('learners');
  const [search,        setSearch]        = useState('');
  const [period,        setPeriod]        = useState<Period>('all');
  const [selectedUser,  setSelectedUser]  = useState<Profile | null>(null);
  const [inviteVisible, setInviteVisible] = useState(false);

  const { data: allProfiles = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: fetchAllProfiles,
  });

  const tabCounts = useMemo(() => {
    const c: Record<UserTab, number> = { learners: 0, staff: 0, admin: 0 };
    for (const p of allProfiles) {
      if      (p.role === 'learner')                           c.learners++;
      else if (p.role === 'educator' || p.role === 'manager')  c.staff++;
      else if (p.role === 'admin')                             c.admin++;
    }
    return c;
  }, [allProfiles]);

  const filtered = useMemo(() => {
    const roles = TAB_CONFIG.find((t) => t.value === activeTab)?.roles ?? [];
    const q = search.trim().toLowerCase();
    const from = periodStart(period);
    return allProfiles
      .filter((p) => roles.includes(p.role))
      .filter((p) => !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .filter((p) => !from || new Date(p.created_at) >= from);
  }, [allProfiles, activeTab, search, period]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>Manage accounts, roles, and team members.</Text>
        </View>
        {canEditContact ? (
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteVisible(true)} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={16} color="#ffffff" />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search + period */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#6e6e73" />
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
              <Ionicons name="close-circle" size={16} color="#9a9aa5" />
            </TouchableOpacity>
          ) : null}
        </View>
        <PeriodPicker value={period} onChange={setPeriod} />
      </View>

      {/* Tabs */}
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
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                  {tabCounts[tab.value]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="person-outline"
          title={search ? 'No results' : `No ${activeTab}`}
          description={search ? 'Try a different search term.' : 'No users in this category yet.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
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

      <UserDetailScreen
        user={selectedUser}
        currentUserId={currentUser?.id ?? null}
        canEditContact={canEditContact}
        onClose={() => setSelectedUser(null)}
      />

      <InviteModal visible={inviteVisible} onClose={() => setInviteVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 14, color: '#6e6e73', marginTop: 2 },

  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0071e3', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  inviteBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1d1d1f', marginLeft: 6 },

  periodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  periodBtnText: { fontSize: 13, fontWeight: '500', color: '#1d1d1f' },

  pickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  pickerCard: {
    backgroundColor: '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 300, overflow: 'hidden', paddingVertical: 4,
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5',
  },
  pickerItemText:   { fontSize: 15, color: '#1d1d1f' },
  pickerItemActive: { color: '#0071e3', fontWeight: '600' },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#ebebed', borderRadius: 12, padding: 3,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 7, borderRadius: 10, gap: 5,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 2,
  },
  tabLabel:           { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  tabLabelActive:     { color: '#1d1d1f', fontWeight: '600' },
  tabBadge:           { backgroundColor: '#d2d2d7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeActive:     { backgroundColor: '#0071e3' },
  tabBadgeText:       { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  tabBadgeTextActive: { color: '#ffffff' },

  list:      { paddingHorizontal: 16, paddingBottom: 32 },
  listCount: { fontSize: 12, color: '#9a9aa5', marginBottom: 6, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  rowBody:  { flex: 1, marginLeft: 12 },
  rowName:  { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },
  rowEmail: { fontSize: 13, color: '#6e6e73', marginTop: 1 },

  // ── Detail screen ──
  detailScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f5f5f7' },

  detailNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  detailNavBack:     { flexDirection: 'row', alignItems: 'center', width: 72, paddingLeft: 4 },
  detailNavBackText: { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  detailNavTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },

  detailIdentity: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
    backgroundColor: '#ffffff',
  },
  detailName:  { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  detailEmail: { fontSize: 13, color: '#6e6e73', marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5,
  },

  card: {
    backgroundColor: '#ffffff', marginHorizontal: 16,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11,
  },
  detailRowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7' },
  detailLabel:      { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  detailValueWrap:  { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  detailValue:      { fontSize: 14, color: '#1d1d1f', fontWeight: '500', textAlign: 'right' },

  detailActions: { paddingHorizontal: 16, paddingTop: 16, gap: 2 },
  actionBtn: {
    backgroundColor: '#ffffff', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    marginBottom: 2,
  },
  actionBtnText:        { fontSize: 16, fontWeight: '500', color: '#1d1d1f' },
  actionBtnPrimary:     { backgroundColor: '#0071e3', borderColor: '#0071e3' },
  actionBtnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  deleteTouchable: { alignItems: 'center', paddingVertical: 12 },
  deleteText:      { fontSize: 15, color: '#b81c3a', fontWeight: '500' },

  // ── Edit form ──
  editCard: {
    backgroundColor: '#ffffff', marginHorizontal: 16,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 16, paddingVertical: 4,
  },
  editField:      { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5' },
  editFieldLabel: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.3, marginBottom: 3 },
  editFieldInput: { fontSize: 15, color: '#1d1d1f', paddingVertical: 0 },

  // ── Invite modal ──
  inviteBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  inviteCard:       { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  inviteCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  inviteTitle:      { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  inviteCloseBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center' },
  inviteSubtitle:   { fontSize: 14, color: '#6e6e73', marginBottom: 20, lineHeight: 20 },
  inviteNote:       { fontSize: 13, color: '#6e6e73', marginTop: 4, marginBottom: 20 },
  inviteSendBtn:    { backgroundColor: '#0071e3', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 4 },
  inviteSendText:   { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  inviteCancelBtn:  { paddingVertical: 10, alignItems: 'center' },
  inviteCancelText: { fontSize: 15, color: '#6e6e73' },
});
