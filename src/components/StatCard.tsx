import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function StatCard({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#1a2035', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#252d47' },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  value: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
});
