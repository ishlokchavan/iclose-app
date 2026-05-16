import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchAllInquiries,
  updateInquiryStatus,
} from '../../../lib/supabase/queries/inquiries';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import type { Inquiry, InquiryStatus } from '../../../types/database';

const { width: SCREEN_W } = Dimensions.get('window');

type StatusFilter = 'all' | InquiryStatus | 'assigned';
type Period = 'all' | 'today' | 'week' | 'month' | '3months';

const ALL_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'open',        label: 'Open',        color: '#d97706' },
  { value: 'assigned',    label: 'Assigned',    color: '#0071e3' },
  { value: 'in_progress', label: 'In Progress', color: '#7c3aed' },
  { value: 'closed',      label: 'Closed',      color: '#6e6e73' },
];

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Open',        value: 'open' },
  { label: 'Assigned',    value: 'assigned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Closed',      value: 'closed' },
];

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'All time',  value: 'all' },
  { label: 'Today',     value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month',value: 'month' },
  { label: 'Last 3 mo', value: '3months' },
];

function statusCfg(s: string) {
  return ALL_STATUSES.find((x) => x.value === s) ?? { label: s, color: '#9a9aa5' };
}

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === '3months') return new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return null;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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
                <Text style={[styles.pickerItemText, value === opt.value && styles.pickerItemActive]}>{opt.label}</Text>
                {value === opt.value ? <Ionicons name="checkmark" size={16} color="#0071e3" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Status picker modal ──────────────────────────────────────────────────────

function StatusPickerModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean; current: string; onSelect: (s: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Update status</Text>
          {ALL_STATUSES.map((s) => {
            const isCurrent = s.value === current;
            return (
              <TouchableOpacity key={s.value} style={styles.pickerItem}
                onPress={() => { onSelect(s.value); onClose(); }} activeOpacity={0.7} disabled={isCurrent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.pickerItemText, { color: isCurrent ? '#9a9aa5' : '#1d1d1f' }]}>{s.label}</Text>
                </View>
                {isCurrent ? <Text style={styles.currentLabel}>current</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Inquiry card ─────────────────────────────────────────────────────────────

function InquiryCard({
  inquiry,
  onPress,
  onStatusChange,
}: {
  inquiry: Inquiry;
  onPress: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const cfg = statusCfg(inquiry.status);

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
        {/* Top row: badge + time | status dropdown */}
        <View style={styles.cardTopRow}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.cardTime}>{fmtShort(inquiry.created_at)}</Text>
          <TouchableOpacity
            style={styles.statusDropdownBtn}
            onPress={(e) => { e.stopPropagation?.(); setPickerVisible(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.statusDropdownBtnText}>{cfg.label}</Text>
            <Ionicons name="chevron-down" size={13} color="#6e6e73" />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <Text style={styles.cardDesc} numberOfLines={2}>{inquiry.description}</Text>

        {/* User */}
        <View style={styles.cardMeta}>
          {inquiry.learner?.full_name ? (
            <View style={styles.cardMetaItem}>
              <Ionicons name="person-outline" size={12} color="#6e6e73" />
              <Text style={styles.cardMetaText} numberOfLines={1}>{inquiry.learner.full_name}</Text>
            </View>
          ) : inquiry.email ? (
            <View style={styles.cardMetaItem}>
              <Ionicons name="mail-outline" size={12} color="#6e6e73" />
              <Text style={styles.cardMetaText} numberOfLines={1}>{inquiry.email}</Text>
            </View>
          ) : null}
          {inquiry.learner?.email && inquiry.learner?.full_name ? (
            <View style={styles.cardMetaItem}>
              <Ionicons name="mail-outline" size={12} color="#6e6e73" />
              <Text style={styles.cardMetaText} numberOfLines={1}>{inquiry.learner.email}</Text>
            </View>
          ) : null}
        </View>

        {/* Area + type */}
        {(inquiry.area || inquiry.property_type) ? (
          <View style={[styles.cardMeta, { marginTop: 4 }]}>
            {inquiry.area ? (
              <View style={styles.cardMetaItem}>
                <Ionicons name="location-outline" size={12} color="#6e6e73" />
                <Text style={styles.cardMetaText} numberOfLines={1}>{inquiry.area.name}</Text>
              </View>
            ) : null}
            {inquiry.property_type ? (
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>{inquiry.property_type.name}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>

      <StatusPickerModal
        visible={pickerVisible}
        current={inquiry.status}
        onSelect={(s) => onStatusChange(inquiry.id, s)}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

// ─── Detail screen ────────────────────────────────────────────────────────────

function InquiryDetailScreen({
  inquiry,
  onClose,
}: {
  inquiry: Inquiry | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const [cached, setCached] = useState<Inquiry | null>(null);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);

  useEffect(() => {
    if (inquiry) {
      setCached(inquiry);
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [inquiry?.id]);

  const handleClose = () => {
    Animated.timing(translateX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(() => onClose());
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      updateInquiryStatus(cached!.id, status as InquiryStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['allInquiries'] });
      setCached(updated);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update.'),
  });

  const cfg = cached ? statusCfg(cached.status) : null;

  return (
    <Modal visible={!!inquiry} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>
        {/* Nav */}
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Inquiries</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>Inquiry</Text>
          <View style={{ width: 88 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 50}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

            {/* Identity row */}
            <View style={styles.detailIdentity}>
              <View style={{ flex: 1 }}>
                {cfg ? (
                  <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color, alignSelf: 'flex-start', marginBottom: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                  </View>
                ) : null}
                <Text style={styles.detailDesc}>{cached?.description ?? ''}</Text>
              </View>
            </View>

            {/* User */}
            {cached?.learner ? (
              <>
                <Text style={styles.sectionLabel}>FROM</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>{cached.learner.full_name ?? '—'}</Text>
                  </View>
                  <View style={[styles.infoRow, styles.infoRowBorder]}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{cached.learner.email ?? '—'}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {/* Context */}
            {(cached?.area || cached?.property_type) ? (
              <>
                <Text style={styles.sectionLabel}>CONTEXT</Text>
                <View style={styles.infoCard}>
                  {cached?.area ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Area</Text>
                      <Text style={styles.infoValue}>{cached.area.name}</Text>
                    </View>
                  ) : null}
                  {cached?.property_type ? (
                    <View style={[styles.infoRow, cached?.area ? styles.infoRowBorder : undefined]}>
                      <Text style={styles.infoLabel}>Type</Text>
                      <Text style={styles.infoValue}>{cached.property_type.name}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Status */}
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={styles.infoCard}>
              <TouchableOpacity style={styles.statusDropdownFull} onPress={() => setStatusPickerVisible(true)}
                disabled={statusMutation.isPending} activeOpacity={0.8}>
                {statusMutation.isPending
                  ? <ActivityIndicator size="small" color="#6e6e73" />
                  : <>
                      <Text style={styles.statusDropdownFullText}>{cfg?.label ?? cached?.status ?? ''}</Text>
                      <Ionicons name="chevron-down" size={16} color="#6e6e73" />
                    </>}
              </TouchableOpacity>
            </View>

            {/* Meta */}
            <Text style={styles.sectionLabel}>META</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Submitted</Text>
                <Text style={styles.infoValue}>{cached ? fmtDateTime(cached.created_at) : '—'}</Text>
              </View>
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>Updated</Text>
                <Text style={styles.infoValue}>{cached ? fmtDateTime(cached.updated_at) : '—'}</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      <StatusPickerModal
        visible={statusPickerVisible}
        current={cached?.status ?? ''}
        onSelect={(s) => statusMutation.mutate(s)}
        onClose={() => setStatusPickerVisible(false)}
      />
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ManagerInquiriesScreen() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Inquiry | null>(null);

  const { data: inquiries = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allInquiries'],
    queryFn: () => fetchAllInquiries(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateInquiryStatus(id, status as InquiryStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allInquiries'] }),
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update status.'),
  });


  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: inquiries.length };
    for (const inq of inquiries) c[inq.status] = (c[inq.status] ?? 0) + 1;
    return c;
  }, [inquiries]);

  const filtered = useMemo(() => {
    const from = periodStart(period);
    const q = search.trim().toLowerCase();
    return inquiries
      .filter((i) => statusFilter === 'all' || i.status === statusFilter)
      .filter((i) => !from || new Date(i.created_at) >= from)
      .filter((i) => !q ||
        i.description.toLowerCase().includes(q) ||
        i.learner?.full_name?.toLowerCase().includes(q) ||
        i.learner?.email?.toLowerCase().includes(q) ||
        i.email?.toLowerCase().includes(q) ||
        i.area?.name?.toLowerCase().includes(q)
      );
  }, [inquiries, statusFilter, period, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTENT</Text>
        <Text style={styles.title}>Inquiries</Text>
        <Text style={styles.subtitle}>All inquiries from learners. Respond, follow up, or close.</Text>
      </View>

      {/* Search + period */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#6e6e73" />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search description, user or area…"
            placeholderTextColor="#9a9aa5" style={styles.searchInput}
            autoCorrect={false} autoCapitalize="none"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9a9aa5" />
            </TouchableOpacity>
          ) : null}
        </View>
        <PeriodPicker value={period} onChange={setPeriod} />
      </View>

      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
        {STATUS_FILTERS.map((sf) => {
          const active = statusFilter === sf.value;
          const count  = statusCounts[sf.value] ?? 0;
          return (
            <TouchableOpacity key={sf.value} onPress={() => setStatusFilter(sf.value)}
              style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sf.label}</Text>
              {(count > 0 || sf.value === 'all') ? (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {sf.value === 'all' ? inquiries.length : count}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : filtered.length === 0 ? (
        <EmptyState icon="list-outline" title="No inquiries"
          description={search ? 'Try a different search term.' : 'Inquiries from learners will appear here.'} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
          renderItem={({ item }) => (
            <InquiryCard
              inquiry={item}
              onPress={() => setSelected(item)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          )}
        />
      )}

      <InquiryDetailScreen inquiry={selected} onClose={() => setSelected(null)} />
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

  periodBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', paddingHorizontal: 12, paddingVertical: 9 },
  periodBtnText: { fontSize: 13, fontWeight: '500', color: '#1d1d1f' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  pickerCard:     { backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 320, overflow: 'hidden', paddingVertical: 4 },
  pickerTitle:    { fontSize: 13, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  pickerItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5' },
  pickerItemText: { fontSize: 15, color: '#1d1d1f' },
  pickerItemActive: { color: '#0071e3', fontWeight: '600' },
  currentLabel:   { fontSize: 11, color: '#9a9aa5' },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },

  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 44 },
  chipsRow:    { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  chipActive:          { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText:            { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  chipTextActive:      { color: '#ffffff', fontWeight: '600' },
  chipBadge:           { backgroundColor: '#ebebed', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  chipBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText:       { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  chipBadgeTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 10 },

  // ── Card ──
  card: {
    backgroundColor: '#ffffff', borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    padding: 14,
  },
  cardTopRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  statusBadge:  { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardTime:     { fontSize: 12, color: '#9a9aa5', flex: 1 },
  statusDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f5f5f7', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  statusDropdownBtnText: { fontSize: 12, fontWeight: '500', color: '#1d1d1f' },
  cardDesc:     { fontSize: 14, color: '#3d3d42', lineHeight: 20, marginBottom: 8 },
  cardMeta:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: '#6e6e73' },
  typeTag:      { backgroundColor: '#e8f1fb', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeTagText:  { fontSize: 11, fontWeight: '600', color: '#0071e3' },

  // ── Detail ──
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

  detailIdentity: { backgroundColor: '#ffffff', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7' },
  detailDesc:     { fontSize: 15, color: '#1d1d1f', lineHeight: 22 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5 },
  infoCard: { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d2d2d7' },
  infoLabel:     { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  infoValue:     { fontSize: 14, color: '#1d1d1f', fontWeight: '500', flex: 1, textAlign: 'right' },

  statusDropdownFull: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  statusDropdownFullText: { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },

});
