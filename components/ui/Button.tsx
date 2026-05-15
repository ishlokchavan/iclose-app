import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: 'bg-accent rounded-lg items-center justify-center',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-transparent border border-accent rounded-lg items-center justify-center',
    text: 'text-accent font-semibold',
  },
  ghost: {
    container: 'bg-transparent rounded-lg items-center justify-center',
    text: 'text-accent font-semibold',
  },
  destructive: {
    container: 'bg-destructive rounded-lg items-center justify-center',
    text: 'text-white font-semibold',
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-4 py-2', text: 'text-body-sm' },
  md: { container: 'px-6 py-3', text: 'text-body' },
  lg: { container: 'px-8 py-4', text: 'text-body-lg' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  disabled,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...props}
      disabled={isDisabled}
      className={`${v.container} ${s.container} ${isDisabled ? 'opacity-50' : ''}`}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? '#ffffff' : '#0071e3'}
        />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
