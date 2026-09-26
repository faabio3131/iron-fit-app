import React, { useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { TabItem } from '../components/TabItem';
import { useAuth } from '../context/AuthContext';
import { EvolutionScreen } from '../screens/EvolutionScreen';
import { FinancialScreen } from '../screens/FinancialScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PasswordRecoveryScreen } from '../screens/PasswordRecoveryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SchedulesScreen } from '../screens/SchedulesScreen';
import { TenantSelectionScreen } from '../screens/TenantSelectionScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { CommercialWebApp } from '../web/CommercialWebApp';
import { WebAuthEntry } from '../web/WebAuthEntry';

type Tab = 'treino' | 'agenda' | 'progresso' | 'financeiro' | 'perfil';

function isStudentProfile(profile: any) {
  return Array.isArray(profile?.roles) && profile.roles.includes('STUDENT');
}

export function RootNavigator() {
  const { sessionReady, session, profile, pendingTenantSelection } = useAuth();
  const [tab, setTab] = useState<Tab>('treino');
  const [recoveryMode, setRecoveryMode] = useState(false);

  if (!sessionReady) {
    return <View style={styles.boot}><StatusBar barStyle="light-content" backgroundColor="#0a0e1a" /><ActivityIndicator size="large" color="#8b5cf6" /></View>;
  }

  if (!session && pendingTenantSelection) return <TenantSelectionScreen />;
  if (!session && Platform.OS !== 'web' && recoveryMode) {
    return <PasswordRecoveryScreen onBack={() => setRecoveryMode(false)} />;
  }
  if (!session) {
    return Platform.OS === 'web'
      ? <WebAuthEntry />
      : <LoginScreen onForgotPassword={() => setRecoveryMode(true)} />;
  }

  if (Platform.OS === 'web' && profile && !isStudentProfile(profile)) {
    return <CommercialWebApp />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      <View style={styles.screen}>
        {tab === 'treino' ? <WorkoutsScreen /> : null}
        {tab === 'agenda' ? <SchedulesScreen /> : null}
        {tab === 'progresso' ? <EvolutionScreen /> : null}
        {tab === 'financeiro' ? <FinancialScreen /> : null}
        {tab === 'perfil' ? <ProfileScreen /> : null}
      </View>
      <View style={styles.tabBar}>
        <TabItem active={tab === 'treino'} icon="barbell" label="Treino" onPress={() => setTab('treino')} />
        <TabItem active={tab === 'agenda'} icon="calendar" label="Agenda" onPress={() => setTab('agenda')} />
        <TabItem active={tab === 'progresso'} icon="trending-up" label="Evolução" onPress={() => setTab('progresso')} />
        <TabItem active={tab === 'financeiro'} icon="wallet" label="Plano" onPress={() => setTab('financeiro')} />
        <TabItem active={tab === 'perfil'} icon="person" label="Perfil" onPress={() => setTab('perfil')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  boot: { flex: 1, backgroundColor: '#0a0e1a', alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#131826', borderTopWidth: 1, borderTopColor: '#252d47', paddingBottom: 16 },
});
