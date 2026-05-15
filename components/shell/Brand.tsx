import React from 'react';
import { View, Text } from 'react-native';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { badge: 28, badgeText: 12, wordmark: 14 },
  md: { badge: 36, badgeText: 15, wordmark: 18 },
  lg: { badge: 48, badgeText: 20, wordmark: 22 },
};

export function Brand({ size = 'md' }: BrandProps) {
  const s = sizeMap[size];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: s.badge,
          height: s.badge,
          borderRadius: s.badge * 0.28,
          backgroundColor: '#0071e3',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: s.badgeText }}>iC</Text>
      </View>
      <Text style={{ color: '#1d1d1f', fontWeight: '700', fontSize: s.wordmark }}>
        iClose Academy
      </Text>
    </View>
  );
}
