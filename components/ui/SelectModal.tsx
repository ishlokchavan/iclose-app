import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalProps {
  title: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchable?: boolean;
  noneLabel?: string;
}

export function SelectModal({
  title,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  noneLabel = 'None',
}: SelectModalProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = searchable && query.length > 0
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (val: string | null) => {
    onChange(val);
    setVisible(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        style={styles.trigger}
      >
        <Text style={[styles.triggerText, !selected && styles.triggerPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6e6e73" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => { setVisible(false); setQuery(''); }}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => { setVisible(false); setQuery(''); }}
        />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity
              onPress={() => { setVisible(false); setQuery(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color="#1d1d1f" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          {searchable ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#9a9aa5" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search…"
                placeholderTextColor="#9a9aa5"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
          ) : null}

          {/* Options */}
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* None option */}
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handleSelect(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, !value && styles.optionSelected]}>{noneLabel}</Text>
              {!value ? <Ionicons name="checkmark" size={18} color="#0071e3" /> : null}
            </TouchableOpacity>

            {filtered.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, styles.optionBorder]}
                onPress={() => handleSelect(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, value === opt.value && styles.optionSelected]} numberOfLines={1}>
                  {opt.label}
                </Text>
                {value === opt.value ? <Ionicons name="checkmark" size={18} color="#0071e3" /> : null}
              </TouchableOpacity>
            ))}

            {filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No results for "{query}"</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d2d2d7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#ffffff',
  },
  triggerText:        { flex: 1, fontSize: 15, color: '#1d1d1f' },
  triggerPlaceholder: { color: '#9a9aa5' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d2d2d7',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d2d2d7',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: '#1d1d1f', paddingVertical: 9 },

  list: { flexGrow: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0' },
  optionText:     { flex: 1, fontSize: 15, color: '#1d1d1f' },
  optionSelected: { color: '#0071e3', fontWeight: '600' },

  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9a9aa5' },
});
