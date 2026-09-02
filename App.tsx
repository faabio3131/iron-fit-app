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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://gym-saas-backend-t9ej.onrender.com/api/v1';

const COLORS = {
  bg: '#0a0e1a',
  surface: '#131826',
  card: '#1a2035',
  cardBorder: '#252d47',
  primary: '#8b5cf6',
  primaryDark: '#6d28d9',
  accent: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
};

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

function fmtDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('pt-BR');
}

function fmtMoney(v?: any) {
  const n = Number(v ?? 0);
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (token) {
      api('/me/profile', token).then(setProfile).catch(() => null);
    } else {
      setProfile(null);
    }
  }, [token]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {!token ? (
        <Login onLogin={setToken} />
      ) : (
        <Main token={token} profile={profile} onLogout={() => setToken(null)} />
      )}
    </SafeAreaView>
  );
}

// ============ LOGIN ============
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
      setError('Credenciais inválidas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.loginContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="cloud" size={48} color={COLORS.text} />
            <Ionicons name="barbell" size={28} color={COLORS.primary} style={styles.logoBarbell} />
          </View>
          <Text style={styles.logoTitle}>IronCloud</Text>
          <Text style={styles.logoTagline}>A força da sua academia,{'\n'}na nuvem.</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginWelcome}>Bem-vindo de volta</Text>
          <Text style={styles.loginSub}>Entre para acessar seus treinos</Text>

          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholder="Email"
              placeholderTextColor={COLORS.textDim}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor={COLORS.textDim}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Entrar</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.text} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>área do aluno</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>

        <Text style={styles.footerText}>IronCloud © 2026</Text>
      </View>
    </ScrollView>
  );
}

// ============ MAIN ============
type Tab = 'treino' | 'agenda' | 'progresso' | 'financeiro' | 'perfil';

function Main({
  token,
  profile,
  onLogout,
}: {
  token: string;
  profile: any;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('treino');

  return (
    <View style={styles.mainContainer}>
      {tab === 'treino' && <TreinoScreen token={token} profile={profile} />}
      {tab === 'agenda' && <AgendaScreen token={token} />}
      {tab === 'progresso' && <ProgressoScreen token={token} />}
      {tab === 'financeiro' && <FinanceiroScreen token={token} />}
      {tab === 'perfil' && <PerfilScreen token={token} profile={profile} onLogout={onLogout} />}

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

function TabItem({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={active ? COLORS.primary : COLORS.textDim} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

// ============ TREINO ============
function TreinoScreen({ token, profile }: { token: string; profile: any }) {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me/workouts', token)
      .then(setWorkouts)
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Olá, {profile?.name?.split(' ')[0] || 'Atleta'}</Text>
          <Text style={styles.headerSub}>Bora treinar hoje? 💪</Text>
        </View>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={COLORS.primary} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard icon="barbell" value={String(workouts.length)} label="Treinos" color={COLORS.primary} />
        <StatCard
          icon="calendar"
          value={String(workouts.reduce((acc, w) => acc + (w.weeklyFrequency || 0), 0))}
          label="Dias/semana"
          color={COLORS.accent}
        />
      </View>

      <Text style={styles.sectionTitle}>Seus Treinos</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : workouts.length === 0 ? (
        <EmptyState icon="barbell-outline" title="Nenhum treino ainda" subtitle="Seu instrutor ainda não liberou treinos para você." />
      ) : (
        workouts.map((w) => (
          <View key={w.id} style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <View style={styles.workoutBadge}>
                <Ionicons name="barbell" size={16} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutTitle}>{w.goal || 'Treino Personalizado'}</Text>
                <Text style={styles.workoutMeta}>
                  {w.weeklyFrequency || 0}x por semana · Status: {w.status}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.statusText}>Aprovado</Text>
              </View>
            </View>

            {(w.sessions || []).map((s: any) => (
              <View key={s.id} style={styles.sessionBlock}>
                <Text style={styles.sessionTitle}>{s.name}</Text>
                {(s.exercises || []).map((ex: any, i: number) => (
                  <View key={ex.id} style={styles.exerciseRow}>
                    <View style={styles.exerciseNumber}>
                      <Text style={styles.exerciseNumberText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.exercise?.name}</Text>
                      <View style={styles.exerciseDetailsRow}>
                        {ex.sets && ex.reps && (
                          <View style={styles.chip}>
                            <Ionicons name="repeat" size={12} color={COLORS.textMuted} />
                            <Text style={styles.chipText}>{ex.sets}x{ex.reps}</Text>
                          </View>
                        )}
                        {ex.restSeconds && (
                          <View style={styles.chip}>
                            <Ionicons name="time" size={12} color={COLORS.textMuted} />
                            <Text style={styles.chipText}>{ex.restSeconds}s</Text>
                          </View>
                        )}
                        {ex.suggestedLoad && (
                          <View style={[styles.chip, styles.chipAccent]}>
                            <Ionicons name="fitness" size={12} color={COLORS.accent} />
                            <Text style={[styles.chipText, styles.chipTextAccent]}>{ex.suggestedLoad}</Text>
                          </View>
                        )}
                      </View>
                      {ex.exercise?.videoUrl && (
                        <TouchableOpacity
                          style={styles.videoBtn}
                          onPress={() => Linking.openURL(ex.exercise.videoUrl)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="play-circle" size={16} color={COLORS.primary} />
                          <Text style={styles.videoBtnText}>Ver vídeo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ============ AGENDA + CHECK-IN ============
function AgendaScreen({ token }: { token: string }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api('/me/schedules', token)
      .then((d) => setSchedules(Array.isArray(d) ? d : []))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCheckIn() {
    setCheckingIn(true);
    setCheckinMsg(null);
    try {
      await api('/me/check-in', token, { method: 'POST', body: JSON.stringify({}) });
      setCheckinMsg({ type: 'ok', text: 'Check-in registrado! Bom treino 💪' });
    } catch (e: any) {
      setCheckinMsg({ type: 'err', text: e.message || 'Não foi possível registrar o check-in.' });
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Agenda</Text>
          <Text style={styles.headerSub}>Suas aulas e entradas 📅</Text>
        </View>
        <View style={styles.avatar}>
          <Ionicons name="calendar" size={24} color={COLORS.accent} />
        </View>
      </View>

      <TouchableOpacity style={styles.checkinCard} onPress={handleCheckIn} disabled={checkingIn} activeOpacity={0.8}>
        <View style={styles.checkinIconBox}>
          <Ionicons name="qr-code" size={32} color={COLORS.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkinTitle}>Check-in na academia</Text>
          <Text style={styles.checkinSub}>Toque para registrar sua entrada</Text>
        </View>
        {checkingIn ? <ActivityIndicator color={COLORS.text} /> : <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />}
      </TouchableOpacity>

      {checkinMsg ? (
        <View style={[styles.checkinMsg, { backgroundColor: (checkinMsg.type === 'ok' ? COLORS.success : COLORS.danger) + '20', borderColor: (checkinMsg.type === 'ok' ? COLORS.success : COLORS.danger) + '50' }]}>
          <Ionicons name={checkinMsg.type === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={18} color={checkinMsg.type === 'ok' ? COLORS.success : COLORS.danger} />
          <Text style={{ color: checkinMsg.type === 'ok' ? COLORS.success : COLORS.danger, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>{checkinMsg.text}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Horários reservados</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : schedules.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nenhum horário reservado" subtitle="Quando sua academia abrir a agenda, suas reservas aparecem aqui." />
      ) : (
        schedules.map((s: any, idx: number) => (
          <View key={s.id || idx} style={styles.agendaCard}>
            <View style={styles.agendaDateBox}>
              <Text style={styles.agendaDateText}>{fmtDate(s.slot?.date || s.date || s.createdAt).slice(0, 5)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agendaTitle}>{s.slot?.name || s.name || 'Aula / Horário'}</Text>
              <Text style={styles.agendaMeta}>
                {s.slot?.startTime || s.startTime ? `🕐 ${s.slot?.startTime || s.startTime}` : ''}
                {s.status ? ` · ${s.status}` : ''}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ============ FINANCEIRO ============
function FinanceiroScreen({ token }: { token: string }) {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me/charges', token)
      .then((d) => setCharges(Array.isArray(d) ? d : []))
      .catch(() => setCharges([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Meu Plano</Text>
          <Text style={styles.headerSub}>Mensalidades e pagamentos 💳</Text>
        </View>
        <View style={styles.avatar}>
          <Ionicons name="wallet" size={24} color={COLORS.success} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Cobranças</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : charges.length === 0 ? (
        <EmptyState icon="card-outline" title="Nenhuma cobrança" subtitle="Suas mensalidades aparecem aqui." />
      ) : (
        charges.map((c: any, idx: number) => {
          const st = chargeStatusInfo(c.status);
          return (
            <View key={c.id || idx} style={styles.chargeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chargeTitle}>{c.description || 'Mensalidade'}</Text>
                <Text style={styles.chargeMeta}>Vencimento: {fmtDate(c.dueDate) || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.chargeAmount}>{fmtMoney(c.amount ?? c.value)}</Text>
                <View style={[styles.chargeBadge, { backgroundColor: st.color + '20' }]}>
                  <Text style={{ color: st.color, fontSize: 11, fontWeight: '700' }}>{st.label}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.pixTeaser}>
        <Ionicons name="flash" size={20} color={COLORS.accent} />
        <Text style={styles.pixTeaserText}>Pagamento via PIX chegando em breve ⚡</Text>
      </View>
    </ScrollView>
  );
}

function chargeStatusInfo(status?: string) {
  const s = (status || '').toUpperCase();
  if (s.includes('PAID') || s.includes('PAGO')) return { label: 'Pago', color: COLORS.success };
  if (s.includes('OVER') || s.includes('ATRAS')) return { label: 'Atrasado', color: COLORS.danger };
  if (s.includes('PEND') || s.includes('OPEN')) return { label: 'Pendente', color: COLORS.accent };
  return { label: status || '—', color: COLORS.textMuted };
}

// ============ PROGRESSO ============
function ProgressoScreen({ token, profile }: { token: string; profile: any }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me/assessments', token)
      .then((d) => setAssessments(Array.isArray(d) ? d : []))
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Sua evolução</Text>
          <Text style={styles.headerSub}>Acompanhe seu progresso 📈</Text>
        </View>
        <View style={styles.avatar}>
          <Ionicons name="trending-up" size={24} color={COLORS.accent} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Avaliações Físicas</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : assessments.length === 0 ? (
        <EmptyState icon="analytics-outline" title="Nenhuma avaliação" subtitle="Peça ao seu instrutor para fazer sua avaliação física." />
      ) : (
        assessments.map((a) => (
          <View key={a.id} style={styles.progressCard}>
            <View style={styles.progressDate}>
              <Ionicons name="calendar" size={14} color={COLORS.textMuted} />
              <Text style={styles.progressDateText}>{fmtDate(a.createdAt)}</Text>
            </View>
            <View style={styles.progressGrid}>
              <Metric label="Peso" value={a.weight ? `${a.weight} kg` : '—'} icon="scale" />
              <Metric label="IMC" value={a.bmi ? Number(a.bmi).toFixed(1) : '—'} icon="body" />
              <Metric label="Gordura" value={a.bodyFatPercent ? `${a.bodyFatPercent}%` : '—'} icon="flame" />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.metricBox}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ============ PERFIL ============
function PerfilScreen({
  token,
  profile,
  onLogout,
}: {
  token: string;
  profile: any;
  onLogout: () => void;
}) {
  return (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.profileName}>{profile?.name || '—'}</Text>
        <Text style={styles.profileEmail}>{profile?.email || '—'}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="business" label="Academia" value={profile?.gym?.name || '—'} />
        <InfoRow icon="flag" label="Objetivo" value={profile?.goal || '—'} />
        <InfoRow icon="trophy" label="Nível" value={profile?.level || '—'} />
        <InfoRow icon="pulse" label="Status" value={profile?.status || '—'} highlight />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.text} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>IronCloud v0.2.0</Text>
    </ScrollView>
  );
}

// ============ AUXILIARES ============
function StatCard({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={64} color={COLORS.textDim} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, highlight && { color: COLORS.success, fontWeight: '700' }]}>{value}</Text>
      </View>
    </View>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  loginContainer: { flexGrow: 1 },
  loginContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBadge: {
    width: 110, height: 110, borderRadius: 30, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  logoBarbell: { position: 'absolute', bottom: 22 },
  logoTitle: { color: COLORS.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  logoTagline: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  loginCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.cardBorder },
  loginWelcome: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  loginSub: { color: COLORS.textMuted, fontSize: 14, marginBottom: 24 },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontSize: 15 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger + '15',
    borderWidth: 1, borderColor: COLORS.danger + '40', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 13, marginLeft: 8, flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginRight: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerText: { color: COLORS.textDim, fontSize: 11, textTransform: 'uppercase', paddingHorizontal: 12, letterSpacing: 1 },
  footerText: { color: COLORS.textDim, textAlign: 'center', marginTop: 24, fontSize: 12 },

  mainContainer: { flex: 1 },
  scrollContent: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 100 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerGreeting: { color: COLORS.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  statIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12, letterSpacing: -0.3 },

  workoutCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  workoutHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  workoutBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  workoutTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  workoutMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: COLORS.success, fontSize: 11, fontWeight: '600', marginLeft: 4 },

  sessionBlock: { marginBottom: 12 },
  sessionTitle: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  exerciseRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  exerciseNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  exerciseNumberText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  exerciseName: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 6 },
  exerciseDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  chipAccent: { backgroundColor: COLORS.accent + '20' },
  chipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  chipTextAccent: { color: COLORS.accent },

  videoBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15',
    borderWidth: 1, borderColor: COLORS.primary + '40', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, gap: 6,
  },
  videoBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  checkinCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    borderRadius: 16, padding: 18, marginBottom: 16, gap: 14,
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  checkinIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#ffffff25', alignItems: 'center', justifyContent: 'center' },
  checkinTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  checkinSub: { color: '#ffffffcc', fontSize: 12, marginTop: 2 },
  checkinMsg: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },

  agendaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.cardBorder, gap: 12 },
  agendaDateBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  agendaDateText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  agendaTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  agendaMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  chargeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.cardBorder },
  chargeTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  chargeMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  chargeAmount: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  chargeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pixTeaser: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent + '15', borderWidth: 1, borderColor: COLORS.accent + '40', borderRadius: 12, padding: 12, marginTop: 8, gap: 8 },
  pixTeaserText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },

  progressCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  progressDate: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  progressDateText: { color: COLORS.textMuted, fontSize: 12 },
  progressGrid: { flexDirection: 'row', gap: 8 },
  metricBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  metricValue: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  metricLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  profileHeader: { alignItems: 'center', marginBottom: 24 },
  profileAvatar: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  profileAvatarText: { color: COLORS.text, fontSize: 36, fontWeight: '800' },
  profileName: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  profileEmail: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  infoCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  infoValue: { color: COLORS.text, fontSize: 15, fontWeight: '600' },

  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger, paddingVertical: 14, borderRadius: 12, gap: 8 },
  logoutText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  versionText: { color: COLORS.textDim, textAlign: 'center', fontSize: 11, marginTop: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingBottom: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: '600', marginTop: 4 },
  tabLabelActive: { color: COLORS.primary },
  tabIndicator: { position: 'absolute', top: 0, width: 24, height: 3, borderRadius: 2, backgroundColor: COLORS.primary },
});
