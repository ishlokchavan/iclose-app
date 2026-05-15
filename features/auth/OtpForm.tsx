import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../../components/ui/Button';

interface OtpFormProps {
  email: string;
  onSuccess: () => void;
}

export function OtpForm({ email, onSuccess }: OtpFormProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = code.join('');
    if (token.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (verifyError) throw verifyError;
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email });
      if (otpError) throw otpError;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View>
      <Text className="text-body text-ink-muted text-center mb-6">
        Enter the 6-digit code sent to{' '}
        <Text className="font-semibold text-ink">{email}</Text>
      </Text>

      <View className="flex-row justify-center gap-3 mb-6">
        {code.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref; }}
            value={digit}
            onChangeText={(text) => handleChange(text, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            style={{
              width: 48,
              height: 56,
              borderWidth: 1.5,
              borderColor: digit ? '#0071e3' : '#d2d2d7',
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: '600',
              color: '#1d1d1f',
              backgroundColor: '#ffffff',
            }}
          />
        ))}
      </View>

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-body-sm text-destructive text-center">{error}</Text>
        </View>
      ) : null}

      <Button label="Verify Email" onPress={handleVerify} loading={loading} size="lg" />

      <View className="flex-row justify-center mt-6">
        <Text className="text-body text-ink-muted">Didn't receive a code? </Text>
        <TouchableOpacity onPress={handleResend} disabled={resending}>
          <Text className="text-body text-accent font-medium">
            {resending ? 'Sending…' : 'Resend'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
