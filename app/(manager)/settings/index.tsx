import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Platform configuration</Text>
      </View>

      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Ionicons name="settings-outline" size={36} color="#9a9aa5" />
        </View>
        <Text style={styles.emptyTitle}>Coming soon</Text>
        <Text style={styles.emptyDesc}>
          Platform settings will be available here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 14, color: '#6e6e73', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#ebebed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1d1d1f', marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: '#6e6e73', textAlign: 'center' },
});
