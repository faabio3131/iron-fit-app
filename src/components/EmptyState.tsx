import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#9fb0c5" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  title: { color: '#eef7ff', fontSize: 17, fontWeight: '700', marginTop: 16 },
  subtitle: { color: '#9fb0c5', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
