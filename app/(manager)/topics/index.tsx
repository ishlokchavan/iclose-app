import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchAllTopics } from '../../../lib/supabase/queries/topics';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import type { Topic, TopicStatus } from '../../../types/database';

type StatusFilter = 'all' | TopicStatus;
type Period = 'all' | 'today' | 'week' | 'month' | '3months';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Drafts',    value: 'draft' },
  { label: 'Archived',  value: 'archived' },
];

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  published: { label: 'PUBLISHED', color: '#1a9e5c' },
  draft:     { label: 'DRAFT',     color: '#d97706' },
  archived:  { label: 'ARCHIVED',  color: '#6e6e73' },
};

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'All time',   value: 'all' },
  { label: 'Today',      value: 'today' },
  { label: 'This week',  value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Last 3 mo',  value: '3months' },
];

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === '3months') return new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return null;
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function educatorDisplay(topic: Topic): string | null {
  if (!topic.educator) return null;
  return topic.educator?.name ?? null;
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

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, onPress }: { topic: Topic; onPress: () => void }) {
  const cfg = STATUS_CFG[topic.status] ?? { label: topic.status.toUpperCase(), color: '#9a9aa5' };
  const thumbnail = topic.cover_image_url ??
    (topic.youtube_id ? `https://img.youtube.com/vi/${topic.youtube_id}/mqdefault.jpg` : null);
  const educator = educatorDisplay(topic);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="play-circle-outline" size={28} color="#c7c7cc" />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.cardBadgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          {topic.property_type ? (
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{topic.property_type.name}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{topic.title}</Text>

        {(educator || topic.area) ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[educator, topic.area?.name].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <Text style={styles.cardDate}>Updated {fmtShort(topic.updated_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ManagerTopicsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');

  const { data: topics = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['allTopics'],
    queryFn: () => fetchAllTopics(),
  });

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: topics.length };
    for (const t of topics) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [topics]);

  const filtered = useMemo(() => {
    const from = periodStart(period);
    const q = search.trim().toLowerCase();
    return topics
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => !from || new Date(t.updated_at) >= from)
      .filter((t) => !q ||
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.area?.name?.toLowerCase().includes(q) ||
        t.property_type?.name?.toLowerCase().includes(q) ||
        educatorDisplay(t)?.toLowerCase().includes(q)
      );
  }, [topics, statusFilter, period, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CONTENT</Text>
          <Text style={styles.title}>Topics</Text>
          <Text style={styles.subtitle}>All published and draft topics. Create, edit, and manage the content library.</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(manager)/topics/new')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search + period */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#6e6e73" />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search topics, area or educator…"
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
          const count = statusCounts[sf.value] ?? 0;
          return (
            <TouchableOpacity key={sf.value} onPress={() => setStatusFilter(sf.value)}
              style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sf.label}</Text>
              {(count > 0 || sf.value === 'all') ? (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {sf.value === 'all' ? topics.length : count}
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
        <EmptyState icon="document-text-outline" title="No topics"
          description={search ? 'Try a different search term.' : 'Create your first topic to get started.'}
          actionLabel={search ? undefined : 'New topic'}
          onAction={search ? undefined : () => router.push('/(manager)/topics/new')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
          renderItem={({ item }) => (
            <TopicCard
              topic={item}
              onPress={() => router.push(`/(manager)/topics/${item.slug}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  eyebrow:  { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.8, marginBottom: 2 },
  title:    { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 13, color: '#6e6e73', marginTop: 3, lineHeight: 18 },
  addBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0071e3', alignItems: 'center', justifyContent: 'center', marginTop: 28 },

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
  pickerItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5' },
  pickerItemText: { fontSize: 15, color: '#1d1d1f' },
  pickerItemActive: { color: '#0071e3', fontWeight: '600' },

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

  card: {
    backgroundColor: '#ffffff', borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    padding: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  thumbnail:           { width: 72, height: 72, borderRadius: 10, backgroundColor: '#f0f0f5' },
  thumbnailPlaceholder:{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#f0f0f5', alignItems: 'center', justifyContent: 'center' },

  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  statusBadge:  { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  typeTag:      { backgroundColor: '#e8f1fb', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeTagText:  { fontSize: 10, fontWeight: '600', color: '#0071e3' },

  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1d1d1f', lineHeight: 20, marginBottom: 3 },
  cardMeta:  { fontSize: 12, color: '#6e6e73', marginBottom: 2 },
  cardDate:  { fontSize: 11, color: '#9a9aa5' },
});
