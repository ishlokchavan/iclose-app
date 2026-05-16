import React, { useState, useCallback } from 'react';
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
import { fetchTopic, saveTopic, unsaveTopic, isTopicSaved } from '../../../lib/supabase/queries/topics';
import { useAuth } from '../../../lib/auth/context';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { Card } from '../../../components/ui/Card';

export default function TopicDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [videoReady, setVideoReady] = useState(false);

  const { data: topic, isLoading } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => fetchTopic(slug),
    enabled: !!slug,
  });

  const { data: saved = false } = useQuery({
    queryKey: ['saved', user?.id, topic?.id],
    queryFn: () => isTopicSaved(user!.id, topic!.id),
    enabled: !!user && !!topic,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saved ? unsaveTopic(user!.id, topic!.id) : saveTopic(user!.id, topic!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved', user?.id, topic?.id] });
      queryClient.invalidateQueries({ queryKey: ['savedTopics', user?.id] });
    },
  });

  const handlePostInquiry = useCallback(() => {
    router.push({
      pathname: '/(learner)/inquiries/new',
      params: { topicId: topic?.id },
    });
  }, [router, topic?.id]);

  if (isLoading) return <Spinner fullScreen />;
  if (!topic) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-body text-ink-muted">Topic not found.</Text>
      </SafeAreaView>
    );
  }

  const educatorName = topic.educator?.name ?? 'Unknown Educator';

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
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={saved ? '#0071e3' : '#6e6e73'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Video player */}
        {topic.youtube_id ? (
          <View className="bg-black">
            <YoutubeIframe
              height={220}
              videoId={topic.youtube_id}
              onReady={() => setVideoReady(true)}
            />
          </View>
        ) : null}

        <View className="p-4">
          {/* Tags */}
          <View className="flex-row gap-2 mb-3 flex-wrap">
            {topic.area?.name ? (
              <View className="bg-accent-subtle rounded-sm px-2 py-1">
                <Text className="text-caption font-medium text-accent">{topic.area.name}</Text>
              </View>
            ) : null}
            {topic.property_type?.name ? (
              <View className="bg-surface-subtle rounded-sm px-2 py-1">
                <Text className="text-caption font-medium text-ink-muted">
                  {topic.property_type.name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          <Text className="text-display-xl text-ink font-bold mb-1">{topic.title}</Text>
          <Text className="text-body-sm text-ink-muted mb-4">By {educatorName}</Text>

          {/* Description */}
          {topic.description ? (
            <Card className="mb-4">
              <Text className="text-body-sm font-semibold text-ink mb-2">About this topic</Text>
              <Text className="text-body text-ink-muted leading-relaxed">{topic.description}</Text>
            </Card>
          ) : null}

          {/* Resources */}
          {topic.resources && topic.resources.length > 0 ? (
            <Card className="mb-4">
              <Text className="text-body-sm font-semibold text-ink mb-3">Resources</Text>
              {topic.resources.map((resource, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(resource.url)}
                  className="flex-row items-center py-2 border-b border-hairline last:border-b-0"
                >
                  <Ionicons
                    name={
                      resource.type === 'pdf'
                        ? 'document-outline'
                        : resource.type === 'video'
                        ? 'play-circle-outline'
                        : 'link-outline'
                    }
                    size={18}
                    color="#0071e3"
                  />
                  <Text className="flex-1 text-body text-accent ml-2" numberOfLines={1}>
                    {resource.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9a9aa5" />
                </TouchableOpacity>
              ))}
            </Card>
          ) : null}

          {/* Post Inquiry button */}
          <Button
            label="Post an Inquiry"
            variant="secondary"
            size="lg"
            onPress={handlePostInquiry}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
