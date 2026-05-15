import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase/client';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.replace('/(auth)/sign-in'), 2000);
    } catch (err: any) {
      setServerError(err?.message ?? 'Failed to reset password.');
    }
  };

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
            <View className="mb-8">
              <Text className="text-display-xl text-ink font-bold mb-2">
                New password
              </Text>
              <Text className="text-body text-ink-muted">
                Create a strong password for your account.
              </Text>
            </View>

            {success ? (
              <View className="items-center py-8">
                <View className="bg-green-100 rounded-full w-16 h-16 items-center justify-center mb-4">
                  <Ionicons name="checkmark-circle-outline" size={36} color="#16a34a" />
                </View>
                <Text className="text-display-md text-ink font-semibold text-center mb-2">
                  Password updated!
                </Text>
                <Text className="text-body text-ink-muted text-center">
                  Redirecting you to sign in…
                </Text>
              </View>
            ) : (
              <>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="New Password"
                      placeholder="••••••••"
                      secureTextEntry
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      error={errors.password?.message}
                      hint="Min 8 characters, one uppercase, one number"
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Confirm New Password"
                      placeholder="••••••••"
                      secureTextEntry
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      error={errors.confirmPassword?.message}
                    />
                  )}
                />

                {serverError ? (
                  <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <Text className="text-body-sm text-destructive">{serverError}</Text>
                  </View>
                ) : null}

                <Button
                  label="Update Password"
                  onPress={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  size="lg"
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
