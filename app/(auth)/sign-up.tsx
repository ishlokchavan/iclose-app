import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '../../components/shell/Brand';
import { SignUpForm } from '../../features/auth/SignUpForm';

export default function SignUpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 py-10">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-6 self-start"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1d1d1f" />
            </TouchableOpacity>

            <View className="items-center mb-8">
              <Brand size="md" />
              <Text className="text-display-2xl text-ink font-bold mt-8 mb-2">
                Create account
              </Text>
              <Text className="text-body text-ink-muted text-center">
                Join iClose Academy today
              </Text>
            </View>

            <SignUpForm />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
