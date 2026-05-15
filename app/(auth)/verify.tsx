import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OtpForm } from '../../features/auth/OtpForm';
import { useAuth } from '../../lib/auth/context';
import { getHomeRoute } from '../../lib/auth/guards';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { role } = useAuth();

  const handleSuccess = () => {
    router.replace(getHomeRoute(role) as any);
  };

  if (!email) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 py-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-6 self-start"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1d1d1f" />
        </TouchableOpacity>

        <View className="items-center mb-8">
          <View className="bg-accent-subtle rounded-xl w-16 h-16 items-center justify-center mb-4">
            <Ionicons name="mail-outline" size={32} color="#0071e3" />
          </View>
          <Text className="text-display-xl text-ink font-bold mb-2">
            Verify your email
          </Text>
          <Text className="text-body text-ink-muted text-center">
            We sent a verification code to your inbox
          </Text>
        </View>

        <OtpForm email={email} onSuccess={handleSuccess} />
      </View>
    </SafeAreaView>
  );
}
