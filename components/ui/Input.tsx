import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="mb-4">
      {label ? (
        <Text className="text-body-sm font-medium text-ink mb-1.5">{label}</Text>
      ) : null}
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={[
          'bg-surface border rounded-lg px-4 py-3 text-body text-ink',
          focused ? 'border-accent' : error ? 'border-destructive' : 'border-hairline',
        ].join(' ')}
        placeholderTextColor="#9a9aa5"
      />
      {error ? (
        <Text className="text-caption text-destructive mt-1">{error}</Text>
      ) : hint ? (
        <Text className="text-caption text-ink-tertiary mt-1">{hint}</Text>
      ) : null}
    </View>
  );
}
