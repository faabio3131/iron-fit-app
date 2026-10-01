import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { iron } from '../design/iron-theme';
import { IronBrand } from './IronBrand';

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const compact = useWindowDimensions().width < 900;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <View style={[styles.layout, compact && styles.stacked]}>
      <View style={[styles.identity, compact && styles.identityCompact]}>
        {!compact && <Text style={styles.eyebrow}>GESTÃO E EVOLUÇÃO · IRON FIT CORE</Text>}
        <IronBrand />
        {!compact && <>
          <Text style={styles.title}>Sua academia.{"\n"}<Text style={styles.accent}>Toda conectada.</Text></Text>
          <Text style={styles.description}>Do primeiro treino à gestão do dia a dia. Mais clareza para sua equipe, mais evolução para seus alunos.</Text>
          <View style={styles.features}>{[
            ['barbell-outline', 'Treinos e evolução'],
            ['people-outline', 'Alunos e equipe'],
            ['calendar-outline', 'Agenda e operação'],
          ].map(([icon, label]) => <View key={label} style={styles.feature}><Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={iron.cyan} /><Text style={styles.featureText}>{label}</Text></View>)}</View>
        </>}
      </View>
      <View style={styles.form}>{children}<View style={styles.footer}><Ionicons name="shield-checkmark-outline" color={iron.cyan} size={15} /><Text style={styles.footerText}>IRON FIT CORE · by FM Tecnologia</Text></View></View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: iron.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  layout: { width: '100%', maxWidth: 1180, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 32 },
  stacked: { flexDirection: 'column', gap: 24, paddingVertical: 0 },
  identity: { flex: 1, minWidth: 0 },
  identityCompact: { flex: 0, width: '100%', maxWidth: 290 },
  eyebrow: { color: iron.cyan, fontWeight: '700', fontSize: 11, letterSpacing: 2, marginBottom: 24 },
  title: { color: iron.text, fontSize: 44, lineHeight: 49, fontWeight: '800', letterSpacing: -1.6, marginTop: 22 },
  accent: { color: iron.primary },
  description: { color: iron.muted, fontSize: 16, lineHeight: 26, maxWidth: 440, marginTop: 18 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 28 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featureText: { color: iron.muted, fontSize: 12 },
  form: { width: '100%', maxWidth: 480, flexShrink: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 22, alignItems: 'center' },
  footerText: { color: iron.muted, fontSize: 11, letterSpacing: .4 },
});
