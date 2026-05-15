import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchHireApplications } from '../../../lib/supabase/queries/hires';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { Card } from '../../../components/ui/Card';
import type { HireApplication, HireKind } from '../../../types/database';

type HireTab = 'all' | HireKind;

const TABS: { label: string; value: HireTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Interns', value: 'intern' },
  { label: 'Specialists', value: 'specialist' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  approved: '#16a34a',
  rejected: '#b81c3a',
  hired: '#0071e3',
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? '#6e6e73';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function HireCard({ item }: { item: HireApplication }) {
  const name = `${item.first_name} ${item.last_name}`.trim();
  const color = statusColor(item.status);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.kindBadge}>
          <Text style={styles.kindText}>
            {item.kind === 'intern' ? 'Intern' : 'Specialist'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
          <Text style={[styles.statusText, { color }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.name}>{name || 'Unknown'}</Text>
      <Text style={styles.email}>{item.email}</Text>
      {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}

      {item.message ? (
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
      ) : null}

      <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
    </Card>
  );
}

export default function HiresScreen() {
  const [activeTab, setActiveTab] = useState<HireTab>('all');

  const {
    data: applications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['hireApplications'],
    queryFn: fetchHireApplications,
  });

  const filtered = useMemo(() => {
    if (activeTab === 'all') return applications;
    return applications.filter((a) => a.kind === activeTab);
  }, [applications, activeTab]);

  const counts = useMemo(() => {
    const c: Record<HireTab, number> = { all: applications.length, intern: 0, specialist: 0 };
    for (const a of applications) {
      if (a.kind === 'intern') c.intern++;
      else c.specialist++;
    }
    return c;
  }, [applications]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Hires</Text>
        <Text style={styles.subtitle}>
          {applications.length} application{applications.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
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
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                {counts[tab.value]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : isError ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Access restricted"
          description="You may not have permission to view hire applications."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="No applications"
          description="Hire applications will appear here once submitted."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0071e3"
            />
          }
          renderItem={({ item }) => <HireCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 14, color: '#6e6e73', marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
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
  tabCount: { fontSize: 12, fontWeight: '600', color: '#9a9aa5' },
  tabCountActive: { color: '#0071e3' },

  card: { marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kindBadge: {
    backgroundColor: '#e8f1fb',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindText: { fontSize: 11, fontWeight: '600', color: '#0071e3' },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#1d1d1f' },
  email: { fontSize: 13, color: '#6e6e73', marginTop: 2 },
  phone: { fontSize: 13, color: '#6e6e73', marginTop: 1 },
  message: {
    fontSize: 13,
    color: '#6e6e73',
    marginTop: 8,
    fontStyle: 'italic',
  },
  date: {
    fontSize: 12,
    color: '#9a9aa5',
    marginTop: 8,
    textAlign: 'right',
  },
});
