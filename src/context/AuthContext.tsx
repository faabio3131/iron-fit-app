import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { api, logoutSession, setSessionInvalidatedHandler } from '../services/api';
import { AuthSession, restoreSession, saveSession } from '../storage/token-storage';

export type TenantOption = { id: string; name: string };

type PendingTenantSelection = {
  email: string;
  password: string;
  tenants: TenantOption[];
  requiresMfa: boolean;
};

export type LoginResult = {
  requiresTenantSelection: boolean;
  requiresMfa: boolean;
};

type AuthContextValue = {
  sessionReady: boolean;
  session: AuthSession | null;
  profile: any;
  activeTenantId: string | null;
  pendingTenantSelection: PendingTenantSelection | null;
  login: (
    email: string,
    password: string,
    gymId?: string,
    mfaCode?: string,
    recoveryCode?: string,
  ) => Promise<LoginResult>;
  selectTenant: (
    gymId: string,
    mfaCode?: string,
    recoveryCode?: string,
  ) => Promise<LoginResult>;
  cancelTenantSelection: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function tenantIdFrom(value: any): string | null {
  const candidate = value?.activeGymId ?? value?.gymId ?? value?.gym?.id;
  return typeof candidate === 'string' && candidate ? candidate : null;
}

function hasStudentRole(profile: any): boolean {
  return Array.isArray(profile?.roles) && profile.roles.includes('STUDENT');
}

export function SafeAreaProvider({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [pendingTenantSelection, setPendingTenantSelection] =
    useState<PendingTenantSelection | null>(null);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setProfile(null);
    setActiveTenantId(null);
    setPendingTenantSelection(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const authProfile = await api('/auth/me');
      let nextProfile = authProfile;

      if (hasStudentRole(authProfile)) {
        try {
          const studentProfile = await api('/me/profile');
          nextProfile = {
            ...authProfile,
            ...studentProfile,
            roles: authProfile.roles,
            permissions: authProfile.permissions,
            activeGymId:
              authProfile.activeGymId ??
              authProfile.gymId ??
              studentProfile?.gym?.id,
            gymId:
              authProfile.gymId ??
              authProfile.activeGymId ??
              studentProfile?.gym?.id,
            isSuperAdmin: authProfile.isSuperAdmin,
            scope: authProfile.scope,
            mfaEnabled: authProfile.mfaEnabled,
            emailVerified: authProfile.emailVerified,
          };
        } catch {
          // A identidade JWT continua sendo a autoridade; enriquecimento de aluno é opcional.
        }
      }

      setProfile(nextProfile);
      setActiveTenantId(tenantIdFrom(nextProfile));
    } catch {
      // 401 é tratado pelo cliente HTTP. Falhas não inventam perfil local.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setSessionInvalidatedHandler(() => {
      if (mounted) clearAuthState();
    });

    restoreSession()
      .then(async (restored) => {
        if (!mounted || !restored) return;
        setSession(restored);
        await refreshProfile();
      })
      .finally(() => {
        if (mounted) setSessionReady(true);
      });

    return () => {
      mounted = false;
      setSessionInvalidatedHandler(null);
    };
  }, [clearAuthState, refreshProfile]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      gymId?: string,
      mfaCode?: string,
      recoveryCode?: string,
    ): Promise<LoginResult> => {
      const normalizedEmail = email.trim();
      if (!normalizedEmail || !password) throw new Error('Informe email e senha.');

      const data = await api('/auth/login', undefined, {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false,
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          ...(gymId ? { gymId } : {}),
          ...(mfaCode?.trim() ? { mfaCode: mfaCode.trim() } : {}),
          ...(recoveryCode?.trim()
            ? { recoveryCode: recoveryCode.trim().toUpperCase() }
            : {}),
        }),
      });

      if (data?.requires_tenant_selection === true) {
        const tenants = Array.isArray(data.tenants)
          ? data.tenants.filter(
              (tenant: any) =>
                tenant &&
                typeof tenant.id === 'string' &&
                typeof tenant.name === 'string',
            )
          : [];
        if (tenants.length === 0) {
          throw new Error('Nenhuma unidade disponível para esta conta.');
        }
        setPendingTenantSelection({
          email: normalizedEmail,
          password,
          tenants,
          requiresMfa: data?.requires_mfa === true,
        });
        return {
          requiresTenantSelection: true,
          requiresMfa: data?.requires_mfa === true,
        };
      }

      if (data?.requires_mfa === true) {
        return { requiresTenantSelection: false, requiresMfa: true };
      }

      if (
        typeof data?.access_token !== 'string' ||
        typeof data?.refresh_token !== 'string'
      ) {
        throw new Error('Resposta de autenticação incompleta.');
      }

      const nextSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
      await saveSession(nextSession);
      setSession(nextSession);
      setPendingTenantSelection(null);
      setProfile(data?.user ?? null);
      setActiveTenantId(tenantIdFrom(data?.user) ?? gymId ?? null);
      await refreshProfile();
      return { requiresTenantSelection: false, requiresMfa: false };
    },
    [refreshProfile],
  );

  const selectTenant = useCallback(
    async (
      gymId: string,
      mfaCode?: string,
      recoveryCode?: string,
    ): Promise<LoginResult> => {
      if (!pendingTenantSelection) {
        throw new Error('Seleção de unidade expirada. Faça login novamente.');
      }
      return login(
        pendingTenantSelection.email,
        pendingTenantSelection.password,
        gymId,
        mfaCode,
        recoveryCode,
      );
    },
    [login, pendingTenantSelection],
  );

  const cancelTenantSelection = useCallback(() => {
    setPendingTenantSelection(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionReady,
      session,
      profile,
      activeTenantId,
      pendingTenantSelection,
      login,
      selectTenant,
      cancelTenantSelection,
      logout,
      refreshProfile,
    }),
    [
      activeTenantId,
      cancelTenantSelection,
      login,
      logout,
      pendingTenantSelection,
      profile,
      refreshProfile,
      selectTenant,
      session,
      sessionReady,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0e1a' },
});
