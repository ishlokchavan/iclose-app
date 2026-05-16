import React, { useState } from 'react';
import {
  Platform,
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type SheetItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

type SheetSection = {
  title: string;
  items: SheetItem[];
};

const SHEET_SECTIONS: SheetSection[] = [
  {
    title: 'Navigate',
    items: [
      { label: 'Overview', icon: 'grid-outline', route: '/(manager)' },
      { label: 'Topics', icon: 'play-circle-outline', route: '/(manager)/topics' },
      { label: 'Inquiries', icon: 'list-outline', route: '/(manager)/inquiries' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Educators', icon: 'people-outline', route: '/(manager)/educators' },
      { label: 'Categories', icon: 'layers-outline', route: '/(manager)/taxonomy' },
      { label: 'Hires', icon: 'briefcase-outline', route: '/(manager)/hires' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Users', icon: 'person-outline', route: '/(manager)/users' },
      { label: 'Profile', icon: 'id-card-outline', route: '/(manager)/profile' },
    ],
  },
];

export default function ManagerLayout() {
  const [moreVisible, setMoreVisible] = useState(false);
  const router = useRouter();

  const handleItem = (route: string) => {
    setMoreVisible(false);
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
          name="topics"
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
        {/* More tab — intercepts press, shows comprehensive sheet */}
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
        {/* Hidden screens */}
        <Tabs.Screen name="taxonomy/index" options={{ href: null }} />
        <Tabs.Screen name="users/index" options={{ href: null }} />
        <Tabs.Screen name="hires/index" options={{ href: null }} />
        <Tabs.Screen name="settings/index" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setMoreVisible(false)} />

          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 34 : 20 }}
            >
              {SHEET_SECTIONS.map((section, si) => (
                <View key={section.title}>
                  {si > 0 && <View style={styles.sectionDivider} />}

                  <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>

                  <View style={styles.sectionCard}>
                    {section.items.map((item, ii) => (
                      <TouchableOpacity
                        key={item.route}
                        onPress={() => handleItem(item.route)}
                        style={[styles.row, ii > 0 && styles.rowBorder]}
                        activeOpacity={0.7}
                      >
                        <View style={styles.iconWrap}>
                          <Ionicons name={item.icon} size={19} color="#0071e3" />
                        </View>
                        <Text style={styles.rowLabel}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#9a9aa5" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f5f5f7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
  sectionDivider: {
    height: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9a9aa5',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d2d2d7',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e8f1fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1d1d1f',
  },
});
