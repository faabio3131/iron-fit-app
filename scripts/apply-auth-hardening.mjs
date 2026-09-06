import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

let app = read('App.tsx');

const legacyApi = `import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://gym-saas-backend-t9ej.onrender.com/api/v1';

const COLORS = {`;
const hardenedImports = `import { Ionicons } from '@expo/vector-icons';
import { api, logoutSession, setSessionInvalidatedHandler } from './src/api';
import { AuthSession, restoreSession, saveSession } from './src/auth-session';

const COLORS = {`;
if (!app.includes(legacyApi)) throw new Error('Legacy API URL/import anchor not found');
app = app.replace(legacyApi, hardenedImports);

const legacyApiFunction = `async function api(path: string, token?: string, options?: any) {
  const res = await fetch(\`\${API_URL}\${path}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro inesperado');
  }
  return res.json();
}

`;
if (!app.includes(legacyApiFunction)) throw new Error('Legacy api() function anchor not found');
app = app.replace(legacyApiFunction, '');

const appStart = app.indexOf('export default function App() {');
const loginMarker = app.indexOf('// ============ LOGIN ============');
if (appStart < 0 || loginMarker < 0 || loginMarker <= appStart) throw new Error('App/Login anchors not found');
const hardenedApp = `export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    setSessionInvalidatedHandler(() => {
      if (!mounted) return;
      setToken(null);
      setProfile(null);
    });

    restoreSession()
      .then((session) => {
        if (mounted) setToken(session?.accessToken ?? null);
      })
      .finally(() => {
        if (mounted) setSessionReady(true);
      });

    return () => {
      mounted = false;
      setSessionInvalidatedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (token) {
      api('/me/profile', token).then(setProfile).catch(() => null);
    } else {
      setProfile(null);
    }
  }, [token]);

  async function handleAuthenticated(session: AuthSession) {
    await saveSession(session);
    setToken(session.accessToken);
  }

  async function handleLogout() {
    try {
      await logoutSession();
    } finally {
      setToken(null);
      setProfile(null);
    }
  }

  if (!sessionReady) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.sessionBoot}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {!token ? (
        <Login onLogin={handleAuthenticated} />
      ) : (
        <Main token={token} profile={profile} onLogout={handleLogout} />
      )}
    </SafeAreaView>
  );
}

`;
app = app.slice(0, appStart) + hardenedApp + app.slice(loginMarker);

const mainMarker = app.indexOf('// ============ MAIN ============');
const loginStart = app.indexOf('// ============ LOGIN ============');
if (loginStart < 0 || mainMarker < 0 || mainMarker <= loginStart) throw new Error('Login/Main anchors not found');
const hardenedLogin = `// ============ LOGIN ============
type TenantOption = { id: string; name: string };

function Login({ onLogin }: { onLogin: (session: AuthSession) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function resetTenantSelection() {
    setTenants([]);
    setSelectedGymId(null);
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Informe email e senha.');
      return;
    }
    if (tenants.length > 0 && !selectedGymId) {
      setError('Selecione a sua unidade.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/login', undefined, {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false,
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(selectedGymId ? { gymId: selectedGymId } : {}),
        }),
      });

      if (data?.requires_tenant_selection === true) {
        const available = Array.isArray(data.tenants)
          ? data.tenants.filter((tenant: any) => tenant && typeof tenant.id === 'string' && typeof tenant.name === 'string')
          : [];
        if (available.length === 0) throw new Error('Nenhuma unidade disponível para esta conta.');
        setTenants(available);
        setSelectedGymId(null);
        return;
      }

      if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
        throw new Error('Resposta de autenticação incompleta.');
      }

      await onLogin({ accessToken: data.access_token, refreshToken: data.refresh_token });
    } catch (e: any) {
      setError(e?.message || 'Não foi possível autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const loginDisabled = loading || !email.trim() || !password || (tenants.length > 0 && !selectedGymId);

  return (
    <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.loginContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="cloud" size={48} color={COLORS.text} />
            <Ionicons name="barbell" size={28} color={COLORS.primary} style={styles.logoBarbell} />
          </View>
          <Text style={styles.logoTitle}>IronCloud</Text>
          <Text style={styles.logoTagline}>A força da sua academia,{'\\n'}na nuvem.</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginWelcome}>Bem-vindo de volta</Text>
          <Text style={styles.loginSub}>Entre para acessar seus treinos</Text>

          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                resetTenantSelection();
              }}
              autoCapitalize="none"
              autoCorrect={false}
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
              onChangeText={(value) => {
                setPassword(value);
                resetTenantSelection();
              }}
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor={COLORS.textDim}
            />
          </View>

          {tenants.length > 0 ? (
            <View style={styles.tenantSelector}>
              <Text style={styles.tenantTitle}>Escolha sua unidade</Text>
              <Text style={styles.tenantHint}>Sua conta possui acesso a mais de uma academia.</Text>
              {tenants.map((tenant) => {
                const selected = selectedGymId === tenant.id;
                return (
                  <TouchableOpacity
                    key={tenant.id}
                    style={[styles.tenantOption, selected && styles.tenantOptionSelected]}
                    onPress={() => {
                      setSelectedGymId(tenant.id);
                      setError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="business-outline" size={20} color={selected ? COLORS.primary : COLORS.textMuted} />
                    <Text style={[styles.tenantOptionText, selected && styles.tenantOptionTextSelected]}>{tenant.name}</Text>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? COLORS.primary : COLORS.textDim} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loginDisabled && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loginDisabled}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>{tenants.length > 0 ? 'Entrar nesta unidade' : 'Entrar'}</Text>
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

`;
app = app.slice(0, loginStart) + hardenedLogin + app.slice(mainMarker);

const styleAnchor = `  screen: { flex: 1, backgroundColor: COLORS.bg },\n\n`;
const sessionStyle = `  screen: { flex: 1, backgroundColor: COLORS.bg },\n  sessionBoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },\n\n`;
if (!app.includes(styleAnchor)) throw new Error('screen style anchor not found');
app = app.replace(styleAnchor, sessionStyle);

const loginStyleAnchor = `  loginSub: { color: COLORS.textMuted, fontSize: 14, marginBottom: 24 },\n`;
const tenantStyles = `  loginSub: { color: COLORS.textMuted, fontSize: 14, marginBottom: 24 },\n  tenantSelector: { marginBottom: 16 },\n  tenantTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },\n  tenantHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 },\n  tenantOption: {\n    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,\n    borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, marginBottom: 8, gap: 10,\n  },\n  tenantOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },\n  tenantOptionText: { flex: 1, color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },\n  tenantOptionTextSelected: { color: COLORS.text },\n`;
if (!app.includes(loginStyleAnchor)) throw new Error('login style anchor not found');
app = app.replace(loginStyleAnchor, tenantStyles);

write('App.tsx', app);

write('src/config.ts', `declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };\n\nconst configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();\n\nif (!configuredApiUrl) {\n  throw new Error('EXPO_PUBLIC_API_URL não configurada. Defina a URL base da API no ambiente do app.');\n}\n\nexport const API_URL = configuredApiUrl.replace(/\\/+$/, '');\n`);

write('src/auth-session.ts', `import { Platform } from 'react-native';\nimport * as SecureStore from 'expo-secure-store';\n\nexport interface AuthSession {\n  accessToken: string;\n  refreshToken: string;\n}\n\nconst SESSION_STORAGE_KEY = 'ironcloud.auth.session.v1';\nlet currentSession: AuthSession | null = null;\n\nfunction isSession(value: unknown): value is AuthSession {\n  if (!value || typeof value !== 'object') return false;\n  const session = value as Partial<AuthSession>;\n  return typeof session.accessToken === 'string' && session.accessToken.length > 0\n    && typeof session.refreshToken === 'string' && session.refreshToken.length > 0;\n}\n\nexport function getSession(): AuthSession | null {\n  return currentSession;\n}\n\nexport async function restoreSession(): Promise<AuthSession | null> {\n  if (Platform.OS === 'web') return currentSession;\n\n  try {\n    const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);\n    if (!raw) return null;\n    const parsed: unknown = JSON.parse(raw);\n    if (!isSession(parsed)) {\n      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);\n      currentSession = null;\n      return null;\n    }\n    currentSession = parsed;\n    return currentSession;\n  } catch {\n    currentSession = null;\n    return null;\n  }\n}\n\nexport async function saveSession(session: AuthSession): Promise<void> {\n  if (!isSession(session)) throw new Error('Sessão de autenticação inválida.');\n  currentSession = { ...session };\n  if (Platform.OS !== 'web') {\n    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(currentSession));\n  }\n}\n\nexport async function clearSession(): Promise<void> {\n  currentSession = null;\n  if (Platform.OS !== 'web') {\n    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY).catch(() => undefined);\n  }\n}\n`);

write('src/api.ts', `import { API_URL } from './config';\nimport { AuthSession, clearSession, getSession, saveSession } from './auth-session';\n\ntype ApiOptions = {\n  method?: string;\n  body?: any;\n  headers?: Record<string, string>;\n  auth?: boolean;\n  retryOnUnauthorized?: boolean;\n};\n\nlet refreshInFlight: Promise<AuthSession | null> | null = null;\nlet sessionInvalidatedHandler: (() => void) | null = null;\n\nexport function setSessionInvalidatedHandler(handler: (() => void) | null) {\n  sessionInvalidatedHandler = handler;\n}\n\nasync function parseBody(response: Response) {\n  const text = await response.text();\n  if (!text) return null;\n  try {\n    return JSON.parse(text);\n  } catch {\n    return text;\n  }\n}\n\nfunction apiError(status: number, payload: any) {\n  const message = typeof payload?.message === 'string'\n    ? payload.message\n    : typeof payload === 'string' && payload\n      ? payload\n      : 'Erro inesperado';\n  const error = new Error(message) as Error & { status?: number };\n  error.status = status;\n  return error;\n}\n\nasync function invalidateSession() {\n  await clearSession();\n  sessionInvalidatedHandler?.();\n}\n\nasync function refreshSession(): Promise<AuthSession | null> {\n  if (refreshInFlight) return refreshInFlight;\n\n  refreshInFlight = (async () => {\n    const current = getSession();\n    if (!current?.refreshToken) return null;\n\n    try {\n      const response = await fetch(\`\${API_URL}/auth/refresh\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ refreshToken: current.refreshToken }),\n      });\n      const payload = await parseBody(response);\n      if (!response.ok\n        || typeof payload?.access_token !== 'string'\n        || typeof payload?.refresh_token !== 'string') {\n        await invalidateSession();\n        return null;\n      }\n\n      const next = { accessToken: payload.access_token, refreshToken: payload.refresh_token };\n      await saveSession(next);\n      return next;\n    } catch {\n      await invalidateSession();\n      return null;\n    }\n  })();\n\n  try {\n    return await refreshInFlight;\n  } finally {\n    refreshInFlight = null;\n  }\n}\n\nasync function request(path: string, options: ApiOptions, allowRefresh: boolean): Promise<any> {\n  const auth = options.auth !== false;\n  const current = getSession();\n  const response = await fetch(\`\${API_URL}\${path}\`, {\n    method: options.method,\n    body: options.body,\n    headers: {\n      'Content-Type': 'application/json',\n      ...(options.headers ?? {}),\n      ...(auth && current?.accessToken ? { Authorization: \`Bearer \${current.accessToken}\` } : {}),\n    },\n  });\n\n  if (response.status === 401\n    && auth\n    && allowRefresh\n    && options.retryOnUnauthorized !== false\n    && current?.refreshToken) {\n    const refreshed = await refreshSession();\n    if (refreshed) return request(path, { ...options, retryOnUnauthorized: false }, false);\n  }\n\n  const payload = await parseBody(response);\n  if (!response.ok) throw apiError(response.status, payload);\n  return payload;\n}\n\n// The token parameter is retained only for compatibility with existing screen calls.\n// Authorization always uses the centrally managed, rotatable session instead of a stale prop token.\nexport async function api(path: string, _legacyAccessToken?: string, options: ApiOptions = {}) {\n  return request(path, options, true);\n}\n\nexport async function logoutSession(): Promise<void> {\n  const current = getSession();\n  let failure: Error | null = null;\n\n  try {\n    if (current?.refreshToken) {\n      const response = await fetch(\`\${API_URL}/auth/logout\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ refreshToken: current.refreshToken }),\n      });\n      if (!response.ok) {\n        failure = apiError(response.status, await parseBody(response));\n      }\n    }\n  } catch (error: any) {\n    failure = error instanceof Error ? error : new Error('Falha ao revogar a sessão no servidor.');\n  } finally {\n    await invalidateSession();\n  }\n\n  if (failure) throw failure;\n}\n`);

write('.env.example', `# URL base da API, incluindo o prefixo de versão.\nEXPO_PUBLIC_API_URL=https://api.example.com/api/v1\n`);

let gitignore = read('.gitignore');
if (!gitignore.includes('!.env.example')) {
  gitignore = gitignore.replace('# local env files\n.env*.local', '# local env files\n.env\n.env.*\n!.env.example');
  write('.gitignore', gitignore);
}

write('test/auth-session-hardening.test.mjs', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst app = fs.readFileSync('App.tsx', 'utf8');\nconst api = fs.readFileSync('src/api.ts', 'utf8');\nconst session = fs.readFileSync('src/auth-session.ts', 'utf8');\nconst config = fs.readFileSync('src/config.ts', 'utf8');\nconst envExample = fs.readFileSync('.env.example', 'utf8');\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\n\ntest('login starts without demo credentials', () => {\n  assert.doesNotMatch(app, /joao\\.silva@email\\.com|aluno123/);\n  assert.match(app, /useState\\(''\\)/);\n});\n\ntest('multi-tenant login selects tenant and resubmits gymId', () => {\n  assert.match(app, /requires_tenant_selection/);\n  assert.match(app, /data\\.tenants/);\n  assert.match(app, /gymId: selectedGymId/);\n  assert.match(app, /Escolha sua unidade/);\n});\n\ntest('mobile session persists both access and refresh tokens in SecureStore', () => {\n  assert.match(session, /expo-secure-store/);\n  assert.match(session, /accessToken: string/);\n  assert.match(session, /refreshToken: string/);\n  assert.match(session, /SecureStore\\.setItemAsync/);\n  assert.equal(pkg.dependencies['expo-secure-store'], '~57.0.3');\n});\n\ntest('401 path rotates refresh token once and retries the original request', () => {\n  assert.match(api, /response\\.status === 401/);\n  assert.match(api, /\\/auth\\/refresh/);\n  assert.match(api, /refreshInFlight/);\n  assert.match(api, /retryOnUnauthorized: false/);\n  assert.match(api, /payload\\.refresh_token/);\n});\n\ntest('logout revokes refresh session at backend before local cleanup', () => {\n  assert.match(api, /\\/auth\\/logout/);\n  assert.match(api, /JSON\\.stringify\\(\\{ refreshToken: current\\.refreshToken \\}\\)/);\n  assert.match(api, /finally \\{[\\s\\S]*invalidateSession/);\n});\n\ntest('backend URL is centralized in EXPO_PUBLIC_API_URL and production URL is not hardcoded', () => {\n  assert.match(config, /EXPO_PUBLIC_API_URL/);\n  assert.match(envExample, /EXPO_PUBLIC_API_URL=/);\n  assert.doesNotMatch(app + config + api, /gym-saas-backend-t9ej\\.onrender\\.com/);\n});\n`);

const pkg = JSON.parse(read('package.json'));
pkg.scripts = {
  ...pkg.scripts,
  typecheck: 'tsc --noEmit --pretty false',
  test: 'node --test test/*.test.mjs',
};
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Auth/session hardening source patch applied.');
