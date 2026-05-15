import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase/client';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: 'icloseacademy://reset-password',
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err?.message ?? 'Failed to send reset email.');
    }
  };

  if (submitted) {
    return (
      <View className="items-center py-8">
        <View className="bg-green-100 rounded-full w-16 h-16 items-center justify-center mb-4">
          <Ionicons name="mail-outline" size={32} color="#16a34a" />
        </View>
        <Text className="text-display-md text-ink font-semibold text-center mb-2">
          Check your inbox
        </Text>
        <Text className="text-body text-ink-muted text-center">
          We've sent a password reset link to your email. Follow the link to create a new password.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-body text-ink-muted mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            error={errors.email?.message}
          />
        )}
      />

      {serverError ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-body-sm text-destructive">{serverError}</Text>
        </View>
      ) : null}

      <Button
        label="Send Reset Link"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        size="lg"
      />
    </View>
  );
}
