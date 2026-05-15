import React from 'react';
import { ScrollView, TouchableOpacity, Text, View } from 'react-native';

interface FilterChip {
  label: string;
  value: string;
}

interface TopicFiltersProps {
  chips: FilterChip[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function TopicFilters({ chips, selected, onSelect }: TopicFiltersProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      className="bg-background"
    >
      <TouchableOpacity
        onPress={() => onSelect(null)}
        className={`px-4 py-2 rounded-lg border ${
          selected === null
            ? 'bg-accent border-accent'
            : 'bg-surface border-hairline'
        }`}
        activeOpacity={0.75}
      >
        <Text
          className={`text-body-sm font-medium ${
            selected === null ? 'text-white' : 'text-ink-muted'
          }`}
        >
          All
        </Text>
      </TouchableOpacity>

      {chips.map((chip) => {
        const isSelected = selected === chip.value;
        return (
          <TouchableOpacity
            key={chip.value}
            onPress={() => onSelect(isSelected ? null : chip.value)}
            className={`px-4 py-2 rounded-lg border ${
              isSelected ? 'bg-accent border-accent' : 'bg-surface border-hairline'
            }`}
            activeOpacity={0.75}
          >
            <Text
              className={`text-body-sm font-medium ${
                isSelected ? 'text-white' : 'text-ink-muted'
              }`}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
