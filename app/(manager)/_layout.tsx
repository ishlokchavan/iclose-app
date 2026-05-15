import React, { useState } from 'react';
import {
  Platform,
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MORE_ITEMS: {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  {
    label: 'Educators',
    description: 'View and manage educator profiles',
    icon: 'people-outline',
    route: '/(manager)/educators',
  },
  {
    label: 'Taxonomy',
    description: 'Areas, property types & subtypes',
    icon: 'layers-outline',
    route: '/(manager)/taxonomy',
  },
  {
    label: 'Users',
    description: 'Manage user roles and access',
    icon: 'person-outline',
    route: '/(manager)/users',
  },
];

export default function ManagerLayout() {
  const [moreVisible, setMoreVisible] = useState(false);
  const router = useRouter();

  const handleMoreItem = (route: string) => {
    setMoreVisible(false);
    // Small delay so the sheet closes before the screen pushes
    setTimeout(() => router.push(route as any), 50);
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0071e3',
          tabBarInactiveTintColor: '#6e6e73',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#d2d2d7',
            borderTopWidth: 0.5,
            paddingBottom: Platform.OS === 'ios' ? 0 : 4,
            height: Platform.OS === 'ios' ? 83 : 60,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Overview',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="topics/index"
          options={{
            title: 'Topics',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="play-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="inquiries/index"
          options={{
            title: 'Inquiries',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />
        {/* More tab — intercept press, show bottom sheet instead of navigating */}
        <Tabs.Screen
          name="educators/index"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ellipsis-horizontal" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreVisible(true);
            },
          }}
        />
        {/* Hidden stack screens */}
        <Tabs.Screen name="taxonomy/index" options={{ href: null }} />
        <Tabs.Screen name="users/index" options={{ href: null }} />
        <Tabs.Screen name="topics/new" options={{ href: null }} />
        <Tabs.Screen name="topics/[slug]/index" options={{ href: null }} />
        <Tabs.Screen name="topics/[slug]/edit" options={{ href: null }} />
      </Tabs>

      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreVisible(false)}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setMoreVisible(false)}
        />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.sectionLabel}>MORE</Text>

          {MORE_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => handleMoreItem(item.route)}
              style={[styles.row, index > 0 && styles.rowBorder]}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color="#0071e3" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
            </TouchableOpacity>
          ))}

          <View style={{ height: Platform.OS === 'ios' ? 34 : 16 }} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d2d2d7',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9a9aa5',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d2d2d7',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e8f1fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1d1d1f',
  },
  rowDesc: {
    fontSize: 13,
    color: '#6e6e73',
    marginTop: 1,
  },
});
