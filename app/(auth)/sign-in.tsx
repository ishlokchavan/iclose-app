import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/shell/Brand';
import { SignInForm } from '../../features/auth/SignInForm';

export default function SignInScreen() {
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
            <View className="items-center mb-10">
              <Brand size="lg" />
              <Text className="text-display-2xl text-ink font-bold mt-8 mb-2">
                Welcome back
              </Text>
              <Text className="text-body text-ink-muted text-center">
                Sign in to continue learning
              </Text>
            </View>

            <SignInForm />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
