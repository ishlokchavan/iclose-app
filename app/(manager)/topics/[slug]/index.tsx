import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchTopic, updateTopic, deleteTopic } from '../../../../lib/supabase/queries/topics';
import { Spinner } from '../../../../components/ui/Spinner';
import type { TopicStatus } from '../../../../types/database';

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  published: { label: 'PUBLISHED', color: '#1a9e5c' },
  draft:     { label: 'DRAFT',     color: '#d97706' },
  archived:  { label: 'ARCHIVED',  color: '#6e6e73' },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ManagerTopicDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: topic, isLoading } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => fetchTopic(slug),
    enabled: !!slug,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TopicStatus) => updateTopic(topic!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', slug] });
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTopic(topic!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
      router.back();
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete.'),
  });

  const handlePublish = () =>
    Alert.alert('Publish Topic', 'Make this topic visible to all learners?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Publish', onPress: () => statusMutation.mutate('published') },
    ]);

  const handleArchive = () =>
    Alert.alert('Archive Topic', 'This topic will be hidden from learners.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => statusMutation.mutate('archived') },
    ]);

  const handleDelete = () =>
    Alert.alert('Delete Topic', 'This will permanently delete the topic. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);

  if (isLoading) return <Spinner fullScreen />;
  if (!topic) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <TouchableOpacity style={[styles.nav, { paddingTop: insets.top + 6 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#0071e3" />
          <Text style={styles.navBackText}>Topics</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#6e6e73' }}>Topic not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CFG[topic.status] ?? { label: topic.status.toUpperCase(), color: '#9a9aa5' };
  const thumbnail = topic.cover_url ??
    (topic.youtube_id ? `https://img.youtube.com/vi/${topic.youtube_id}/mqdefault.jpg` : null);
  const educatorName = topic.educator?.name ?? null;
  const isPending = statusMutation.isPending || deleteMutation.isPending;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#0071e3" />
          <Text style={styles.navBackText}>Topics</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Topic</Text>
        <TouchableOpacity
          style={styles.navEdit}
          onPress={() => router.push(`/(manager)/topics/${slug}/edit`)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={20} color="#0071e3" />
          <Text style={styles.navEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* Cover / thumbnail */}
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.cover} resizeMode="cover" />
        ) : null}

        {/* Title block */}
        <View style={styles.titleBlock}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          {topic.description ? (
            <Text style={styles.topicDesc}>{topic.description}</Text>
          ) : null}
        </View>

        {/* Status actions */}
        <Text style={styles.sectionLabel}>ACTIONS</Text>
        <View style={styles.actionsCard}>
          {topic.status !== 'published' ? (
            <TouchableOpacity
              style={[styles.actionRow, styles.actionPublish]}
              onPress={handlePublish}
              disabled={isPending}
              activeOpacity={0.8}
            >
              {statusMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="eye-outline" size={18} color="#fff" />
                    <Text style={styles.actionPublishText}>Publish</Text>
                  </>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionRow, styles.actionSecondary]}
              onPress={() => Alert.alert('Revert to Draft', 'Move this topic back to draft?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revert', onPress: () => statusMutation.mutate('draft') },
              ])}
              disabled={isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo-outline" size={18} color="#1d1d1f" />
              <Text style={styles.actionSecondaryText}>Revert to Draft</Text>
            </TouchableOpacity>
          )}

          {topic.status !== 'archived' ? (
            <TouchableOpacity
              style={[styles.actionRow, styles.infoRowBorder, styles.actionSecondary]}
              onPress={handleArchive}
              disabled={isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="archive-outline" size={18} color="#1d1d1f" />
              <Text style={styles.actionSecondaryText}>Archive</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionRow, styles.infoRowBorder, styles.actionSecondary]}
              onPress={() => statusMutation.mutate('draft')}
              disabled={isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color="#1d1d1f" />
              <Text style={styles.actionSecondaryText}>Restore to Draft</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionRow, styles.infoRowBorder]}
            onPress={handleDelete}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {deleteMutation.isPending
              ? <ActivityIndicator size="small" color="#b81c3a" />
              : <>
                  <Ionicons name="trash-outline" size={18} color="#b81c3a" />
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </>}
          </TouchableOpacity>
        </View>

        {/* Details */}
        {(educatorName || topic.area || topic.property_type) ? (
          <>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <View style={styles.infoCard}>
              {educatorName ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Educator</Text>
                  <Text style={styles.infoValue}>{educatorName}</Text>
                </View>
              ) : null}
              {topic.area ? (
                <View style={[styles.infoRow, educatorName ? styles.infoRowBorder : undefined]}>
                  <Text style={styles.infoLabel}>Area</Text>
                  <Text style={styles.infoValue}>{topic.area.name}</Text>
                </View>
              ) : null}
              {topic.property_type ? (
                <View style={[styles.infoRow, (educatorName || topic.area) ? styles.infoRowBorder : undefined]}>
                  <Text style={styles.infoLabel}>Type</Text>
                  <Text style={styles.infoValue}>{topic.property_type.name}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Resources */}
        {topic.resources && topic.resources.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RESOURCES</Text>
            <View style={styles.infoCard}>
              {topic.resources.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.infoRow, i > 0 && styles.infoRowBorder]}
                  onPress={() => Linking.openURL(r.url)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="link-outline" size={14} color="#0071e3" style={{ marginRight: 6 }} />
                  <Text style={[styles.infoValue, { color: '#0071e3', textAlign: 'left' }]} numberOfLines={1}>{r.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {/* Meta */}
        <Text style={styles.sectionLabel}>META</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{fmtDateTime(topic.created_at)}</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Updated</Text>
            <Text style={styles.infoValue}>{fmtDateTime(topic.updated_at)}</Text>
          </View>
          {topic.youtube_id ? (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>YouTube ID</Text>
              <Text style={styles.infoValue}>{topic.youtube_id}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10, paddingTop: 6,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  navBack:     { flexDirection: 'row', alignItems: 'center', width: 88, paddingLeft: 4 },
  navBackText: { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  navTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },
  navEdit:     { flexDirection: 'row', alignItems: 'center', gap: 4, width: 88, justifyContent: 'flex-end', paddingRight: 8 },
  navEditText: { fontSize: 17, color: '#0071e3' },

  cover: { width: '100%', height: 200, backgroundColor: '#1d1d1f' },

  titleBlock: {
    backgroundColor: '#ffffff', padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7', gap: 8,
  },
  statusBadge:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  topicTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1f', lineHeight: 26 },
  topicDesc:  { fontSize: 14, color: '#6e6e73', lineHeight: 20 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5 },

  actionsCard: { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  actionRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  actionPublish:      { backgroundColor: '#0071e3' },
  actionPublishText:  { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  actionSecondary:    {},
  actionSecondaryText:{ fontSize: 15, color: '#1d1d1f' },
  actionDeleteText:   { fontSize: 15, color: '#b81c3a' },

  infoCard:      { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7' },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d2d2d7' },
  infoLabel:     { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  infoValue:     { fontSize: 14, color: '#1d1d1f', fontWeight: '500', flex: 1, textAlign: 'right' },
});
