import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function InfoRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color="#2f91ff" />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#203b55' },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2f91ff15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  content: { flex: 1 },
  label: { color: '#9fb0c5', fontSize: 11, marginBottom: 2 },
  value: { color: '#eef7ff', fontSize: 15, fontWeight: '600' },
  highlight: { color: '#10b981', fontWeight: '700' },
});
