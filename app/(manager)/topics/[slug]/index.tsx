import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import { fetchTopic, updateTopic } from '../../../../lib/supabase/queries/topics';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { Spinner } from '../../../../components/ui/Spinner';

export default function ManagerTopicDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: topic, isLoading } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => fetchTopic(slug),
    enabled: !!slug,
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'published' | 'archived' | 'draft') =>
      updateTopic(topic!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', slug] });
      queryClient.invalidateQueries({ queryKey: ['allTopics'] });
    },
  });

  const handlePublish = () => {
    Alert.alert('Publish Topic', 'Make this topic visible to all learners?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Publish', onPress: () => statusMutation.mutate('published') },
    ]);
  };

  const handleArchive = () => {
    Alert.alert('Archive Topic', 'Hide this topic from learners?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => statusMutation.mutate('archived') },
    ]);
  };

  const handleUnpublish = () => {
    Alert.alert('Revert to Draft', 'Move this topic back to draft?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revert', onPress: () => statusMutation.mutate('draft') },
    ]);
  };

  if (isLoading) return <Spinner fullScreen />;
  if (!topic) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-body text-ink-muted">Topic not found.</Text>
      </SafeAreaView>
    );
  }

  const educatorName = topic.educator?.profile?.full_name ?? 'Unknown Educator';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-hairline bg-surface">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Ionicons name="arrow-back" size={24} color="#1d1d1f" />
        </TouchableOpacity>
        <Text className="flex-1 text-display-md text-ink font-semibold" numberOfLines={1}>
          {topic.title}
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/(manager)/topics/${slug}/edit`)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil-outline" size={22} color="#0071e3" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Video */}
        {topic.youtube_id ? (
          <View className="bg-black">
            <YoutubeIframe height={220} videoId={topic.youtube_id} />
          </View>
        ) : null}

        <View className="p-4">
          {/* Status + tags */}
          <View className="flex-row gap-2 mb-3 flex-wrap">
            <Badge label={topic.status} variant={topic.status} />
            {topic.area?.name ? (
              <View className="bg-accent-subtle rounded-sm px-2 py-0.5">
                <Text className="text-caption font-medium text-accent">{topic.area.name}</Text>
              </View>
            ) : null}
          </View>

          <Text className="text-display-xl text-ink font-bold mb-1">{topic.title}</Text>
          <Text className="text-body-sm text-ink-muted mb-4">By {educatorName}</Text>

          {topic.description ? (
            <Card className="mb-4">
              <Text className="text-body-sm font-semibold text-ink mb-2">Description</Text>
              <Text className="text-body text-ink-muted">{topic.description}</Text>
            </Card>
          ) : null}

          {topic.resources && topic.resources.length > 0 ? (
            <Card className="mb-4">
              <Text className="text-body-sm font-semibold text-ink mb-3">
                Resources ({topic.resources.length})
              </Text>
              {topic.resources.map((resource, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(resource.url)}
                  className="flex-row items-center py-2 border-b border-hairline"
                >
                  <Ionicons name="link-outline" size={16} color="#0071e3" />
                  <Text className="flex-1 text-body-sm text-accent ml-2" numberOfLines={1}>
                    {resource.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          ) : null}

          {/* Actions */}
          <View className="gap-3">
            {topic.status !== 'published' && (
              <Button
                label="Publish Topic"
                variant="primary"
                size="lg"
                onPress={handlePublish}
                loading={statusMutation.isPending}
              />
            )}
            {topic.status === 'published' && (
              <Button
                label="Revert to Draft"
                variant="secondary"
                size="lg"
                onPress={handleUnpublish}
                loading={statusMutation.isPending}
              />
            )}
            {topic.status !== 'archived' && (
              <Button
                label="Archive Topic"
                variant="destructive"
                size="lg"
                onPress={handleArchive}
                loading={statusMutation.isPending}
              />
            )}
            {topic.status === 'archived' && (
              <Button
                label="Restore to Draft"
                variant="secondary"
                size="lg"
                onPress={() => statusMutation.mutate('draft')}
                loading={statusMutation.isPending}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
