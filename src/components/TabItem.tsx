import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TabItem({ active, icon, label, onPress }: { active: boolean; icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={active ? '#8b5cf6' : '#64748b'} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active ? <View style={styles.tabIndicator} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabLabel: { color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 4 },
  tabLabelActive: { color: '#8b5cf6' },
  tabIndicator: { position: 'absolute', top: 0, width: 24, height: 3, borderRadius: 2, backgroundColor: '#8b5cf6' },
});
