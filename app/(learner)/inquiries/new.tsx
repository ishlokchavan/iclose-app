import React from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { InquiryForm } from '../../../features/inquiries/InquiryForm';
import { useAuth } from '../../../lib/auth/context';

export default function NewInquiryScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId?: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['myInquiries', user?.id] });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-hairline bg-surface">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-3"
          >
            <Ionicons name="close" size={24} color="#1d1d1f" />
          </TouchableOpacity>
          <Text className="flex-1 text-display-md text-ink font-semibold">Post Inquiry</Text>
        </View>

        <View className="flex-1 px-4 pt-4">
          <InquiryForm topicId={topicId} onSuccess={handleSuccess} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
