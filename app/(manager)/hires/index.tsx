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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchHireApplications, updateHireStatus } from '../../../lib/supabase/queries/hires';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import type { HireApplication } from '../../../types/database';

const { width: SCREEN_W } = Dimensions.get('window');

type StatusFilter = 'all' | 'pending' | 'reviewing' | 'shortlisted' | 'hired' | 'rejected';
type Period = 'all' | 'today' | 'week' | 'month' | '3months';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Pending',     value: 'pending' },
  { label: 'Reviewing',   value: 'reviewing' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Hired',       value: 'hired' },
  { label: 'Rejected',    value: 'rejected' },
];

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'All time',   value: 'all' },
  { label: 'Today',      value: 'today' },
  { label: 'This week',  value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Last 3 mo',  value: '3months' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:     { color: '#d97706', label: 'Pending' },
  reviewing:   { color: '#0071e3', label: 'Reviewing' },
  shortlisted: { color: '#7c3aed', label: 'Shortlisted' },
  hired:       { color: '#16a34a', label: 'Hired' },
  approved:    { color: '#16a34a', label: 'Approved' },
  rejected:    { color: '#b81c3a', label: 'Rejected' },
};

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d;
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === '3months') return new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

// ─── Period picker modal ────────────────────────────────────────────────────

function PeriodPicker({
  value, onChange,
}: { value: Period; onChange: (v: Period) => void }) {
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
              <TouchableOpacity
                key={opt.value}
                style={styles.pickerItem}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                activeOpacity={0.7}
              >
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

// ─── Applicant row ──────────────────────────────────────────────────────────

function ApplicantRow({ item, onPress }: { item: HireApplication; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? { color: '#9a9aa5', label: item.status };
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowAvatar}>
        <Text style={styles.rowAvatarText}>{initials(item.first_name, item.last_name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {`${item.first_name} ${item.last_name}`.trim() || 'Unknown'}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.rowStatus, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.rowDot}>·</Text>
          <Text style={styles.rowDate}>{fmtDate(item.created_at)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
    </TouchableOpacity>
  );
}

// ─── Detail screen ──────────────────────────────────────────────────────────

function DetailRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const NEXT_STATUSES: Record<string, string[]> = {
  pending:     ['reviewing', 'rejected'],
  reviewing:   ['shortlisted', 'rejected'],
  shortlisted: ['hired', 'rejected'],
  hired:       [],
  rejected:    ['reviewing'],
};

function HireDetailScreen({
  item,
  onClose,
}: {
  item: HireApplication | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const [cached, setCached] = useState<HireApplication | null>(null);

  useEffect(() => {
    if (item) {
      setCached(item);
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [item?.id]);

  const handleClose = () => {
    Animated.timing(translateX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(() => onClose());
  };

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => updateHireStatus(cached!.id, cached!.kind, newStatus),
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['hireApplications'] });
      setCached((prev) => prev ? { ...prev, status: newStatus } : prev);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update status.'),
  });

  const cfg = cached ? (STATUS_CONFIG[cached.status] ?? { color: '#9a9aa5', label: cached.status }) : null;
  const nextStatuses = cached ? (NEXT_STATUSES[cached.status] ?? []) : [];

  const handleStatusChange = (newStatus: string) => {
    const label = STATUS_CONFIG[newStatus]?.label ?? newStatus;
    Alert.alert('Update status', `Move to "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => statusMutation.mutate(newStatus) },
    ]);
  };

  const name = cached ? `${cached.first_name} ${cached.last_name}`.trim() || 'Unknown' : '';

  return (
    <Modal visible={!!item} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>
        {/* Nav */}
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Hires</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>{name}</Text>
          <View style={{ width: 72 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {/* Identity */}
          <View style={styles.detailIdentity}>
            <View style={styles.detailAvatar}>
              <Text style={styles.detailAvatarText}>
                {cached ? initials(cached.first_name, cached.last_name) : ''}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.detailName}>{name}</Text>
              <Text style={styles.detailEmail}>{cached?.email ?? ''}</Text>
              {cfg ? (
                <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.kindTag}>
              <Text style={styles.kindTagText}>
                {cached?.kind === 'intern' ? 'Intern' : 'Specialist'}
              </Text>
            </View>
          </View>

          {/* Contact */}
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.card}>
            <DetailRow label="Email"  value={cached?.email ?? '—'} />
            <DetailRow label="Phone"  value={cached?.phone ?? '—'} />
            {cached?.kind === 'intern' && cached.instagram ? (
              <DetailRow label="Instagram" value={cached.instagram} />
            ) : null}
            <DetailRow label="Applied" value={cached ? fmtDateTime(cached.created_at) : '—'} isLast />
          </View>

          {/* Message */}
          {cached?.message ? (
            <>
              <Text style={styles.sectionLabel}>MESSAGE</Text>
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 20 }}>{cached.message}</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Status actions */}
          {nextStatuses.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
              <View style={styles.statusActions}>
                {nextStatuses.map((s) => {
                  const scfg = STATUS_CONFIG[s] ?? { color: '#6e6e73', label: s };
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusActionBtn, { borderColor: scfg.color }]}
                      onPress={() => handleStatusChange(s)}
                      disabled={statusMutation.isPending}
                      activeOpacity={0.8}
                    >
                      {statusMutation.isPending
                        ? <ActivityIndicator size="small" color={scfg.color} />
                        : <Text style={[styles.statusActionText, { color: scfg.color }]}>
                            Move to {scfg.label}
                          </Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HiresScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [period,       setPeriod]       = useState<Period>('all');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<HireApplication | null>(null);

  const { data: applications = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['hireApplications'],
    queryFn: fetchHireApplications,
  });

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of applications) {
      c.all++;
      c[a.status] = (c[a.status] ?? 0) + 1;
    }
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    const from = periodStart(period);
    const q = search.trim().toLowerCase();
    return applications
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .filter((a) => !from || new Date(a.created_at) >= from)
      .filter((a) => !q ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      );
  }, [applications, statusFilter, period, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PLATFORM</Text>
        <Text style={styles.title}>Hires</Text>
        <Text style={styles.subtitle}>Intern and specialist applications submitted through the platform.</Text>
      </View>

      {/* Search + period */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#6e6e73" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email or status…"
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
        <PeriodPicker value={period} onChange={setPeriod} />
      </View>

      {/* Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {STATUS_FILTERS.map((sf) => {
          const active = statusFilter === sf.value;
          const count  = statusCounts[sf.value] ?? 0;
          return (
            <TouchableOpacity
              key={sf.value}
              onPress={() => setStatusFilter(sf.value)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sf.label}</Text>
              {count > 0 || sf.value === 'all' ? (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {sf.value === 'all' ? statusCounts.all : count}
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
      ) : isError ? (
        <EmptyState icon="lock-closed-outline" title="Access restricted" description="You may not have permission to view hire applications." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="briefcase-outline" title="No applications" description="No applications match the current filters." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
          ListHeaderComponent={
            <View style={styles.listCardHeader}>
              <Text style={styles.listCardHeaderText}>APPLICANT</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.listCardFooter}>
              <Text style={styles.listCardFooterText}>
                {filtered.length} applicant{filtered.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <ApplicantRow
              item={item}
              onPress={() => setSelected(item)}
            />
          )}
          style={styles.listCard}
        />
      )}

      <HireDetailScreen item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.8, marginBottom: 2 },
  title:   { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 13, color: '#6e6e73', marginTop: 3, lineHeight: 18 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 10, paddingVertical: 9,
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
    backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 300,
    overflow: 'hidden', paddingVertical: 4,
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5',
  },
  pickerItemText:   { fontSize: 15, color: '#1d1d1f' },
  pickerItemActive: { color: '#0071e3', fontWeight: '600' },

  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 44 },
  chipsRow: {
    paddingHorizontal: 16, gap: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  chipActive:         { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText:           { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  chipTextActive:     { color: '#ffffff', fontWeight: '600' },
  chipBadge:          { backgroundColor: '#ebebed', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  chipBadgeActive:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText:      { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  chipBadgeTextActive:{ color: '#ffffff' },

  list:           { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },
  listCard:       { marginHorizontal: 0 },
  listCardHeader: {
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderBottomWidth: 0,
    marginHorizontal: 16,
  },
  listCardHeaderText: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.6 },
  listCardFooter: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderTopWidth: 0,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  listCardFooterText: { fontSize: 13, color: '#9a9aa5' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    borderTopWidth: 0,
    marginHorizontal: 16,
  },
  rowAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center',
  },
  rowAvatarText: { fontSize: 14, fontWeight: '700', color: '#6e6e73' },
  rowBody:  { flex: 1, marginLeft: 12 },
  rowName:  { fontSize: 15, fontWeight: '600', color: '#1d1d1f' },
  rowMeta:  { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  rowStatus: { fontSize: 12, fontWeight: '500' },
  rowDot:   { fontSize: 12, color: '#9a9aa5' },
  rowDate:  { fontSize: 12, color: '#9a9aa5' },

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
  detailAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarText: { fontSize: 18, fontWeight: '700', color: '#6e6e73' },
  detailName:  { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  detailEmail: { fontSize: 13, color: '#6e6e73', marginTop: 2 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '600' },

  kindTag: {
    backgroundColor: '#e8f1fb', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  kindTagText: { fontSize: 11, fontWeight: '600', color: '#0071e3' },

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
  detailLabel: { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  detailValue: { fontSize: 14, color: '#1d1d1f', fontWeight: '500', textAlign: 'right', flex: 1 },

  statusActions: { paddingHorizontal: 16, gap: 8 },
  statusActionBtn: {
    borderRadius: 12, borderWidth: 1.5,
    paddingVertical: 13, alignItems: 'center',
  },
  statusActionText: { fontSize: 15, fontWeight: '600' },
});
