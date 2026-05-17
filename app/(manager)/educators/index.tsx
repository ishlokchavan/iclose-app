import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  fetchEducators,
  addEducator,
  updateEducator,
  deleteEducator,
  type Educator,
} from '../../../lib/supabase/queries/educators';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';

const { width: SCREEN_W } = Dimensions.get('window');

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function avatarInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

// ─── Add Educator Modal ───────────────────────────────────────────────────────

function AddEducatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName]   = useState('');
  const [lastName,  setLastName]    = useState('');
  const [email,     setEmail]       = useState('');
  const [phone,     setPhone]       = useState('');
  const [expertise, setExpertise]   = useState('');
  const [bio,       setBio]         = useState('');

  const reset = () => { setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setExpertise(''); setBio(''); };

  const addMutation = useMutation({
    mutationFn: () => addEducator({ first_name: firstName, last_name: lastName, email, phone, expertise, bio }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['educators'] }); reset(); onClose(); },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to add educator.'),
  });

  const handleAdd = () => {
    if (!firstName.trim()) { Alert.alert('Validation', 'First name is required.'); return; }
    if (!email.trim())     { Alert.alert('Validation', 'Email is required.'); return; }
    addMutation.mutate();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add educator</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color="#6e6e73" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Educators appear on topic cards and detail pages.</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>First name</Text>
                <TextInput style={styles.fieldInput} value={firstName} onChangeText={setFirstName}
                  placeholder="Test" placeholderTextColor="#9a9aa5" autoCapitalize="words" autoCorrect={false} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Last name</Text>
                <TextInput style={styles.fieldInput} value={lastName} onChangeText={setLastName}
                  placeholder="User" placeholderTextColor="#9a9aa5" autoCapitalize="words" autoCorrect={false} />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.fieldInput} value={email} onChangeText={setEmail}
              placeholder="educator@company.ae" placeholderTextColor="#9a9aa5"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone}
              placeholder="+971 50 000 0000" placeholderTextColor="#9a9aa5" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Expertise <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={styles.fieldInput} value={expertise} onChangeText={setExpertise}
              placeholder="e.g. Luxury Residential" placeholderTextColor="#9a9aa5" autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Bio <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={[styles.fieldInput, styles.fieldInputMulti]} value={bio} onChangeText={setBio}
              placeholder="Short bio…" placeholderTextColor="#9a9aa5" multiline numberOfLines={3}
              textAlignVertical="top" />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, addMutation.isPending && { opacity: 0.7 }]}
              onPress={handleAdd}
              disabled={addMutation.isPending}
              activeOpacity={0.8}
            >
              {addMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSubmitText}>Add educator</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ paddingVertical: 12 }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Educator Detail Screen ───────────────────────────────────────────────────

function EducatorDetailScreen({
  educator,
  onClose,
}: {
  educator: Educator | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const [cached, setCached] = useState<Educator | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName,  setEditLastName]  = useState('');
  const [editEmail,     setEditEmail]     = useState('');
  const [editPhone,     setEditPhone]     = useState('');
  const [editExpertise, setEditExpertise] = useState('');
  const [editBio,       setEditBio]       = useState('');
  const [editPhotoUrl,  setEditPhotoUrl]  = useState('');

  useEffect(() => {
    if (educator) {
      setCached(educator);
      setMode('view');
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [educator?.id]);

  useEffect(() => {
    if (cached) {
      setEditFirstName(cached.first_name ?? '');
      setEditLastName(cached.last_name  ?? '');
      setEditEmail(cached.email         ?? '');
      setEditPhone(cached.phone         ?? '');
      setEditExpertise(cached.expertise ?? '');
      setEditBio(cached.bio             ?? '');
      setEditPhotoUrl(cached.photo_url  ?? '');
    }
  }, [cached?.id]);

  const handleClose = () => {
    Animated.timing(translateX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(() => onClose());
  };

  const updateMutation = useMutation({
    mutationFn: () => updateEducator(cached!.id, {
      first_name: editFirstName, last_name: editLastName,
      email: editEmail, phone: editPhone,
      expertise: editExpertise, bio: editBio, photo_url: editPhotoUrl,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['educators'] });
      const name = [editFirstName, editLastName].filter(Boolean).join(' ').trim() || cached!.name;
      setCached((prev) => prev ? {
        ...prev, name,
        first_name: editFirstName, last_name: editLastName,
        email: editEmail, phone: editPhone,
        expertise: editExpertise || null, bio: editBio || null,
        photo_url: editPhotoUrl || null,
      } : prev);
      setMode('view');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update educator.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEducator(cached!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['educators'] }); handleClose(); },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete educator.'),
  });

  const handleDelete = () => {
    Alert.alert('Delete Educator', `Remove ${cached?.name ?? 'this educator'}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const displayName = cached?.name || [cached?.first_name, cached?.last_name].filter(Boolean).join(' ') || 'Unnamed';
  const displayNamePreview = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(' ');

  return (
    <Modal visible={!!educator} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>
        {/* Nav */}
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Educators</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>{displayName}</Text>
          <View style={{ width: 88 }} />
        </View>

        {/* Identity */}
        <View style={styles.detailIdentity}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityAvatarText}>{avatarInitials(displayName)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.identityName}>{displayName}</Text>
            {cached?.email ? <Text style={styles.identityEmail}>{cached.email}</Text> : null}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {mode === 'view' ? (
            <>
              <Text style={styles.sectionLabel}>CONTACT</Text>
              <View style={styles.card}>
                <DetailRow label="Email" value={cached?.email ?? '—'} />
                <DetailRow label="Phone" value={cached?.phone ?? '—'} isLast />
              </View>

              <Text style={styles.sectionLabel}>PROFILE</Text>
              <View style={styles.card}>
                <DetailRow label="Expertise" value={cached?.expertise ?? '—'} />
                <DetailRow label="Bio"       value={cached?.bio       ?? '—'} isLast />
              </View>

              <Text style={styles.sectionLabel}>META</Text>
              <View style={styles.card}>
                <DetailRow label="Added"        value={cached ? fmtDate(cached.created_at) : '—'} />
                <DetailRow label="Last updated" value={cached ? fmtDate(cached.updated_at) : '—'} isLast />
              </View>

              <View style={styles.viewActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => setMode('edit')} activeOpacity={0.75}>
                  <Text style={styles.editBtnText}>Edit details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteTouchable}
                  onPress={handleDelete}
                  disabled={deleteMutation.isPending}
                  activeOpacity={0.75}
                >
                  <Text style={styles.deleteText}>
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete educator…'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>EDITING DETAILS</Text>
              <View style={styles.editSection}>
                <View style={styles.editRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.editFieldLabel}>First name</Text>
                    <TextInput style={styles.editInput} value={editFirstName} onChangeText={setEditFirstName}
                      placeholder="First name" placeholderTextColor="#9a9aa5" autoCapitalize="words" autoCorrect={false} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editFieldLabel}>Last name</Text>
                    <TextInput style={styles.editInput} value={editLastName} onChangeText={setEditLastName}
                      placeholder="Last name" placeholderTextColor="#9a9aa5" autoCapitalize="words" autoCorrect={false} />
                  </View>
                </View>

                {displayNamePreview ? (
                  <Text style={styles.displayNameHint}>
                    Display name will be <Text style={{ fontWeight: '700' }}>{displayNamePreview}</Text>
                  </Text>
                ) : null}

                <Text style={styles.editFieldLabel}>Email</Text>
                <TextInput style={styles.editInput} value={editEmail} onChangeText={setEditEmail}
                  placeholder="Email" placeholderTextColor="#9a9aa5" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

                <Text style={styles.editFieldLabel}>Phone</Text>
                <TextInput style={styles.editInput} value={editPhone} onChangeText={setEditPhone}
                  placeholder="Phone" placeholderTextColor="#9a9aa5" keyboardType="phone-pad" />

                <Text style={styles.editFieldLabel}>Expertise <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput style={styles.editInput} value={editExpertise} onChangeText={setEditExpertise}
                  placeholder="e.g. Luxury Residential" placeholderTextColor="#9a9aa5" autoCapitalize="words" />

                <Text style={styles.editFieldLabel}>Bio <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput style={[styles.editInput, styles.editInputMulti]} value={editBio} onChangeText={setEditBio}
                  placeholder="Short bio…" placeholderTextColor="#9a9aa5" multiline numberOfLines={3} textAlignVertical="top" />

                <Text style={styles.editFieldLabel}>Photo URL <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput style={styles.editInput} value={editPhotoUrl} onChangeText={setEditPhotoUrl}
                  placeholder="https://…" placeholderTextColor="#9a9aa5" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.7 }]}
                  onPress={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  activeOpacity={0.8}
                >
                  {updateMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Save changes</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('view')} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
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

export default function EducatorsScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Educator | null>(null);
  const [addVisible, setAddVisible] = useState(false);

  const { data: educators = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['educators'],
    queryFn: fetchEducators,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return educators;
    return educators.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.expertise?.toLowerCase().includes(q)
    );
  }, [educators, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTENT</Text>
        <Text style={styles.title}>Educators</Text>
        <Text style={styles.subtitle}>Specialists who appear on topic cards and detail pages.</Text>
      </View>

      {/* Search + add */}
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
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9a9aa5" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.addIconBtn} onPress={() => setAddVisible(true)} activeOpacity={0.8}>
          <Ionicons name="person-add-outline" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={search ? 'No results' : 'No educators yet'}
          description={search ? 'Try a different search term.' : 'Add an educator to get started.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
          ListHeaderComponent={
            <View style={styles.listCardHeader}>
              <Text style={styles.listCardHeaderText}>EDUCATOR</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.listCardFooter}>
              <Text style={styles.listCardFooterText}>
                {filtered.length} educator{filtered.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(item)} activeOpacity={0.7}>
              <View style={styles.rowAvatar}>
                <Text style={styles.rowAvatarText}>{avatarInitials(item.name)}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                {item.email ? <Text style={styles.rowSub} numberOfLines={1}>{item.email}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
            </TouchableOpacity>
          )}
        />
      )}

      <EducatorDetailScreen educator={selected} onClose={() => setSelected(null)} />
      <AddEducatorModal visible={addVisible} onClose={() => setAddVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  eyebrow:  { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.8, marginBottom: 2 },
  title:    { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 13, color: '#6e6e73', marginTop: 3, lineHeight: 18 },

  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 10, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1d1d1f', marginLeft: 6 },
  addIconBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0071e3', alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },
  listCardHeader: {
    backgroundColor: '#f5f5f7', paddingHorizontal: 16, paddingVertical: 8,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderBottomWidth: 0,
  },
  listCardHeaderText: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.6 },
  listCardFooter: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
    backgroundColor: '#ffffff',
  },
  listCardFooterText: { fontSize: 13, color: '#9a9aa5' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
  },
  rowAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { fontSize: 14, fontWeight: '700', color: '#6e6e73' },
  rowBody:       { flex: 1, marginLeft: 12 },
  rowName:       { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },
  rowSub:        { fontSize: 13, color: '#6e6e73', marginTop: 1 },

  // ── Detail screen ──
  detailScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f5f5f7' },
  detailNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  detailNavBack:     { flexDirection: 'row', alignItems: 'center', width: 88, paddingLeft: 4 },
  detailNavBackText: { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  detailNavTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },

  detailIdentity: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
    backgroundColor: '#ffffff',
  },
  identityAvatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center' },
  identityAvatarText: { fontSize: 18, fontWeight: '700', color: '#6e6e73' },
  identityName:       { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  identityEmail:      { fontSize: 13, color: '#6e6e73', marginTop: 2 },

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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 11,
  },
  detailRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7' },
  detailLabel:     { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  detailValue:     { fontSize: 14, color: '#1d1d1f', fontWeight: '500', flex: 1, textAlign: 'right' },

  viewActions:     { paddingHorizontal: 16, paddingTop: 20 },
  editBtn:         { backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  editBtnText:     { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },
  deleteTouchable: { alignItems: 'center', paddingVertical: 14 },
  deleteText:      { fontSize: 15, color: '#b81c3a', fontWeight: '500' },

  // ── Edit form ──
  editSection:       { paddingHorizontal: 16 },
  editRow:           { flexDirection: 'row' },
  editFieldLabel:    { fontSize: 13, fontWeight: '500', color: '#6e6e73', marginBottom: 6, marginTop: 12 },
  editInput: {
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1d1d1f',
  },
  editInputMulti:  { minHeight: 80, textAlignVertical: 'top' },
  displayNameHint: { fontSize: 13, color: '#6e6e73', marginTop: 8, lineHeight: 18 },
  optional:        { fontWeight: '400', color: '#9a9aa5' },
  editActions:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  saveBtn:         { backgroundColor: '#0071e3', borderRadius: 22, paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center' },
  saveBtnText:     { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  cancelText:      { fontSize: 15, color: '#6e6e73' },

  // ── Add modal ──
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:       { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle:      { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  modalCloseBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center' },
  modalSubtitle:   { fontSize: 14, color: '#6e6e73', marginBottom: 16, lineHeight: 20 },
  modalRow:        { flexDirection: 'row', marginBottom: 0 },
  fieldLabel:      { fontSize: 13, fontWeight: '500', color: '#6e6e73', marginBottom: 6, marginTop: 10 },
  fieldInput: {
    backgroundColor: '#f5f5f7', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1d1d1f',
  },
  fieldInputMulti: { minHeight: 70, textAlignVertical: 'top' },
  modalActions:    { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  modalSubmitBtn:  { backgroundColor: '#0071e3', borderRadius: 22, paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center' },
  modalSubmitText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  modalCancelText: { fontSize: 15, color: '#6e6e73' },
});
