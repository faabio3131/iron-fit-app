import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';

const API_URL = 'http://192.168.100.16:3333/api/v1';

async function api(path: string, token?: string, options?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro inesperado');
  }
  return res.json();
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  if (!token) {
    return <Login onLogin={setToken} />;
  }
  return <Main token={token} onLogout={() => setToken(null)} />;
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [email, setEmail] = useState('joao.silva@email.com');
  const [password, setPassword] = useState('aluno123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.access_token);
    } catch (e: any) {
      setError('Falha no login. Verifique email e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.loginBox}>
        <Text style={styles.logo}>GYM SAAS</Text>
        <Text style={styles.subtitle}>Area do Aluno</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="Email"
          placeholderTextColor="#888"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Senha"
          placeholderTextColor="#888"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Main({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<'treino' | 'progresso' | 'perfil'>('treino');

  return (
    <SafeAreaView style={styles.screen}>
      {tab === 'treino' && <TreinoScreen token={token} />}
      {tab === 'progresso' && <ProgressoScreen token={token} />}
      {tab === 'perfil' && <PerfilScreen token={token} onLogout={onLogout} />}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('treino')}>
          <Text style={[styles.tabText, tab === 'treino' && styles.tabActive]}>Treino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('progresso')}>
          <Text style={[styles.tabText, tab === 'progresso' && styles.tabActive]}>Progresso</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('perfil')}>
          <Text style={[styles.tabText, tab === 'perfil' && styles.tabActive]}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TreinoScreen({ token }: { token: string }) {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me/workouts', token)
      .then(setWorkouts)
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} color="#7c3aed" />;
  }

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Meus Treinos</Text>
      {workouts.length === 0 ? <Text style={styles.empty}>Nenhum treino aprovado ainda.</Text> : null}
      {workouts.map((w) => (
        <View key={w.id} style={styles.card}>
          <Text style={styles.cardTitle}>{w.goal || 'Treino'}</Text>
          <Text style={styles.cardSub}>
            {w.weeklyFrequency ? `${w.weeklyFrequency}x por semana | ` : ''}{w.status}
          </Text>
          {(w.sessions || []).map((s: any) => (
            <View key={s.id} style={styles.session}>
              <Text style={styles.sessionTitle}>{s.name}</Text>
              {(s.exercises || []).map((ex: any, i: number) => (
                <View key={ex.id} style={styles.exercise}>
                  <Text style={styles.exerciseName}>
                    {i + 1}. {ex.exercise?.name}
                  </Text>
                  <Text style={styles.exerciseDetail}>
                    {ex.sets ? `${ex.sets} series` : ''} {ex.reps ? `x ${ex.reps} reps` : ''}
                    {ex.restSeconds ? ` | descanso ${ex.restSeconds}s` : ''}
                  </Text>
                  {ex.suggestedLoad ? (
                    <Text style={styles.exerciseDetail}>Carga sugerida: {ex.suggestedLoad}</Text>
                  ) : null}
                  {ex.equipment?.name ? (
                    <Text style={styles.exerciseDetail}>Aparelho: {ex.equipment.name}</Text>
                  ) : null}
                  {ex.exercise?.videoUrl ? (
                    <TouchableOpacity
                      style={styles.videoButton}
                      onPress={() => Linking.openURL(ex.exercise.videoUrl)}
                    >
                      <Text style={styles.videoText}>Ver video</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ProgressoScreen({ token }: { token: string }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me/assessments', token)
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} color="#7c3aed" />;
  }

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Minha Evolucao</Text>
      {assessments.length === 0 ? <Text style={styles.empty}>Nenhuma avaliacao ainda.</Text> : null}
      {assessments.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {a.weight ? `${a.weight} kg` : '--'} | IMC {a.bmi ?? '--'}
          </Text>
          <Text style={styles.cardSub}>
            {a.bodyFatPercent ? `Gordura: ${a.bodyFatPercent}%` : ''}
          </Text>
          <Text style={styles.exerciseDetail}>
            {new Date(a.createdAt).toLocaleDateString('pt-BR')}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function PerfilScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api('/me/profile', token).then(setProfile).catch(() => null);
  }, [token]);

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Meu Perfil</Text>
      {profile ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{profile.name}</Text>
          <Text style={styles.cardSub}>{profile.email}</Text>
          <Text style={styles.exerciseDetail}>Academia: {profile.gym?.name}</Text>
          <Text style={styles.exerciseDetail}>Objetivo: {profile.goal || '--'}</Text>
          <Text style={styles.exerciseDetail}>Nivel: {profile.level || '--'}</Text>
          <Text style={styles.exerciseDetail}>Status: {profile.status}</Text>
        </View>
      ) : null}
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#7c3aed', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  error: { color: '#f87171', marginBottom: 8, textAlign: 'center' },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 80 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  empty: { color: '#94a3b8' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardSub: { color: '#94a3b8', marginBottom: 8 },
  session: { marginTop: 8 },
  sessionTitle: { color: '#7c3aed', fontWeight: '700', marginBottom: 4 },
  exercise: { borderBottomColor: '#334155', borderBottomWidth: 1, paddingVertical: 8 },
  exerciseName: { color: '#fff', fontWeight: '600' },
  exerciseDetail: { color: '#94a3b8', fontSize: 12 },
  videoButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  videoText: { color: '#7c3aed', fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', marginTop: 100 },
  tabBar: {
    flexDirection: 'row',
    borderTopColor: '#1e293b',
    borderTopWidth: 1,
    backgroundColor: '#0f172a',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { color: '#64748b', fontWeight: '700' },
  tabActive: { color: '#7c3aed' },
});
