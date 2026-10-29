import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function Metric({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={20} color="#2BF47A" />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#08080A', borderRadius: 12, padding: 12, alignItems: 'center' },
  value: { color: '#EEF1F5', fontSize: 18, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  label: { color: '#A1A6AE', fontSize: 11, marginTop: 2 },
});
