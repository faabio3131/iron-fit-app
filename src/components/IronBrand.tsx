import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export function IronBrand({ compact = false, mobile = false }: { compact?: boolean; mobile?: boolean }) {
  return <View style={[styles.frame, compact && styles.compact, mobile && styles.mobile]}>
    <Image source={require('../../assets/brand/iron-fit-core-blue.webp')}
      accessibilityLabel="IRON FIT CORE — by FM Tecnologia"
      resizeMode="contain" style={styles.image} />
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 480, aspectRatio: 520 / 308, alignSelf: 'center', overflow: 'hidden', borderRadius: 20 },
  compact: { width: 160, maxWidth: 160, borderRadius: 8 },
  mobile: { width: 118, maxWidth: 118, borderRadius: 8 },
  image: { width: '100%', height: '100%' },
});
