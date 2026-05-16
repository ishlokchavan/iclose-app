import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllTopics } from '../../lib/supabase/queries/topics';
import { fetchAllInquiries } from '../../lib/supabase/queries/inquiries';
import { useAuth } from '../../lib/auth/context';
import { Spinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import type { Inquiry } from '../../types/database';

// ─── Header ───────────────────────────────────────────────────────────────
function Header() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>iC</Text>
        </View>
        <Text style={styles.brandText}>
          <Text style={styles.brandBold}>iClose </Text>
          <Text style={styles.brandLight}>Academy</Text>
        </Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={22} color="#0071e3" />
        </TouchableOpacity>

        <TouchableOpacity hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={22} color="#1d1d1f" />
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>8</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          hitSlop={8}
          onPress={() => router.push('/(manager)/profile' as any)}
          activeOpacity={0.7}
        >
          <Avatar name={profile?.full_name ?? '?'} size={36} />
        </TouchableOpacity>

        <TouchableOpacity hitSlop={8} onPress={signOut} style={styles.iconBtn}>
          <Ionicons name="exit-outline" size={22} color="#1d1d1f" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  tint?: 'green' | 'white' | 'red' | 'yellow';
}

const TINTS = {
  green:  { bg: '#ecfdf5', border: '#d1fae5' },
  white:  { bg: '#ffffff', border: '#d2d2d7' },
  red:    { bg: '#fef2f2', border: '#fee2e2' },
  yellow: { bg: '#fefce8', border: '#fef3c7' },
} as const;

function StatCard({ label, value, tint = 'white' }: StatCardProps) {
  const t = TINTS[tint];
  return (
    <View style={[styles.statCard, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Inquiry preview card ─────────────────────────────────────────────────
function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  const router = useRouter();
  const date = new Date(inquiry.created_at);
  const dateLabel = `${date.toLocaleDateString()}, ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })}`;

  const location = [inquiry.area?.name, inquiry.subarea].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/(manager)/inquiries/${inquiry.id}` as any)}
      style={styles.inquiryCard}
    >
      <View style={styles.inquiryHeader}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{inquiry.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.inquiryDate}>{dateLabel}</Text>
      </View>

      <Text style={styles.inquiryTitle} numberOfLines={2}>
        {inquiry.description}
      </Text>

      {location ? (
        <View style={styles.inquiryLocationRow}>
          <Ionicons name="location-outline" size={14} color="#6e6e73" />
          <Text style={styles.inquiryLocation} numberOfLines={1}>{location}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────
export default function ManagerOverview() {
  const router = useRouter();

  const {
    data: topics = [],
    isLoading: topicsLoading,
    refetch: refetchTopics,
    isRefetching: topicsRefetching,
  } = useQuery({ queryKey: ['allTopics'], queryFn: () => fetchAllTopics() });

  const {
    data: inquiries = [],
    isLoading: inquiriesLoading,
    refetch: refetchInquiries,
    isRefetching: inquiriesRefetching,
  } = useQuery({ queryKey: ['allInquiries'], queryFn: () => fetchAllInquiries() });

  const isLoading = topicsLoading || inquiriesLoading;
  const isRefreshing = topicsRefetching || inquiriesRefetching;

  const t = {
    published: topics.filter((x) => x.status === 'published').length,
    draft:     topics.filter((x) => x.status === 'draft').length,
    archived:  topics.filter((x) => x.status === 'archived').length,
  };

  const i = {
    open:   inquiries.filter((x) => x.status === 'open').length,
    closed: inquiries.filter((x) => x.status === 'closed').length,
  };

  const openInquiries = inquiries.filter((x) => x.status === 'open').slice(0, 3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { refetchTopics(); refetchInquiries(); }}
            tintColor="#0071e3"
          />
        }
      >
        <Text style={styles.eyebrow}>CONTENT MANAGER</Text>
        <Text style={styles.pageTitle}>Overview</Text>
        <Text style={styles.pageSubtitle}>
          Topics, inquiries, and platform content at a glance.
        </Text>

        {isLoading ? (
          <View style={{ marginTop: 48 }}>
            <Spinner />
          </View>
        ) : (
          <>
            {/* Topics */}
            <Text style={styles.sectionLabel}>TOPICS</Text>
            <View style={styles.cardGrid}>
              <StatCard label="Published" value={t.published} tint="green" />
              <StatCard label="Drafts"    value={t.draft}     tint="white" />
            </View>
            <View style={styles.cardGrid}>
              <StatCard label="Archived" value={t.archived} tint="red" />
              <View style={{ flex: 1 }} />
            </View>

            {/* Inquiries */}
            <Text style={styles.sectionLabel}>INQUIRIES</Text>
            <View style={styles.cardGrid}>
              <StatCard label="Open"   value={i.open}   tint="yellow" />
              <StatCard label="Closed" value={i.closed} tint="green" />
            </View>

            {/* Open inquiries list */}
            <View style={styles.openHeader}>
              <Text style={styles.sectionLabel}>OPEN INQUIRIES</Text>
              <TouchableOpacity
                onPress={() => router.push('/(manager)/inquiries' as any)}
                hitSlop={8}
              >
                <Text style={styles.viewAll}>View all →</Text>
              </TouchableOpacity>
            </View>

            {openInquiries.length === 0 ? (
              <View style={styles.emptyOpen}>
                <Text style={styles.emptyOpenText}>No open inquiries.</Text>
              </View>
            ) : (
              openInquiries.map((inq) => <InquiryRow key={inq.id} inquiry={inq} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f5f5f7' },
  scroll:  { padding: 16, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d2d2d7',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBadge: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#1d1d1f',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  brandText:  { fontSize: 16 },
  brandBold:  { color: '#1d1d1f', fontWeight: '700' },
  brandLight: { color: '#6e6e73', fontWeight: '400' },
  iconBtn:    { position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: -4, right: -6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0071e3',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Page title
  eyebrow: {
    fontSize: 11, fontWeight: '600', letterSpacing: 1.2,
    color: '#9a9aa5', marginTop: 8, marginBottom: 6,
  },
  pageTitle:    { fontSize: 34, fontWeight: '800', color: '#1d1d1f' },
  pageSubtitle: { fontSize: 15, color: '#6e6e73', marginTop: 6, marginBottom: 24 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 1.2,
    color: '#9a9aa5', marginTop: 20, marginBottom: 10,
  },

  // Stat cards
  cardGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  statLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: '#9a9aa5' },
  statValue: { fontSize: 40, fontWeight: '800', color: '#1d1d1f', marginTop: 4 },

  // Open inquiries
  openHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20, marginBottom: 10,
  },
  viewAll: { fontSize: 13, fontWeight: '500', color: '#1d1d1f' },

  inquiryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
    padding: 14,
    marginBottom: 10,
  },
  inquiryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 10, fontWeight: '700', color: '#1d1d1f', letterSpacing: 0.6 },
  inquiryDate:    { fontSize: 12, color: '#9a9aa5' },
  inquiryTitle:   { fontSize: 15, fontWeight: '600', color: '#1d1d1f' },
  inquiryLocationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  inquiryLocation: { fontSize: 13, color: '#6e6e73', flex: 1 },

  emptyOpen: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
    padding: 24, alignItems: 'center',
  },
  emptyOpenText: { fontSize: 14, color: '#9a9aa5' },
});
