import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Product wordmark follows the FM Tecnologia IRON page's native palette.
 * No recolored or filtered legacy blue asset.
 */
export function IronBrand({ compact = false, mobile = false }: { compact?: boolean; mobile?: boolean }) {
  return (
    <View
      accessibilityLabel="IRON FIT CORE — by FM Tecnologia"
      style={[styles.frame, compact && styles.compact, mobile && styles.mobile]}
    >
      <Text style={[styles.name, compact && styles.nameCompact, mobile && styles.nameMobile]}>
        IRON <Text style={styles.accent}>FIT</Text> CORE
      </Text>
      <Text style={[styles.attribution, compact && styles.attributionCompact, mobile && styles.attributionMobile]}>
        BY FM TECNOLOGIA
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', paddingVertical: 18 },
  compact: { width: 160, maxWidth: 160, paddingVertical: 4, alignItems: 'flex-start' },
  mobile: { width: 118, maxWidth: 118, paddingVertical: 4 },
  name: { color: '#EEF1F5', fontSize: 32, fontWeight: '900', letterSpacing: 0.5 },
  nameCompact: { fontSize: 15, letterSpacing: 0.2 },
  nameMobile: { fontSize: 12, letterSpacing: 0.1 },
  accent: { color: '#2BF47A' },
  attribution: { marginTop: 4, color: '#A1A6AE', fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },
  attributionCompact: { marginTop: 2, fontSize: 8, letterSpacing: 1.4 },
  attributionMobile: { fontSize: 7, letterSpacing: 1.1 },
});
