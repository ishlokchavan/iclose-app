import React from 'react';
import { View, Text, Image } from 'react-native';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, imageUrl, size = 40 }: AvatarProps) {
  const initials = name ? getInitials(name) : '?';
  const fontSize = Math.round(size * 0.38);

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#ebebed',
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#e8f1fb',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize,
          fontWeight: '600',
          color: '#0071e3',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
